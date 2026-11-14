import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Shop from "@/models/Shop";
import { invalidateCache } from "@/lib/cache";
import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH, createEmailToken, normalizeEmail } from "@/lib/authTokens";
import { appUrl, emailVerificationEnabled, sendVerificationEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { safeNextPath } from "@/lib/authRedirect";

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`register:${clientIp(request)}`, 10, 60 * 60_000)) {
      return NextResponse.json({ error: "Too many sign-ups from this network. Please try again later." }, { status: 429 });
    }

    await connectToDatabase();
    const body = await request.json();
    const { password, firstName, lastName, role, phone, location, shop } = body;
    const email = normalizeEmail(body.email);
    const next = safeNextPath(typeof body.next === "string" ? body.next : null);

    if (!email || !password || !firstName || !lastName || !role) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Admin accounts are never self-service.
    if (role !== "customer" && role !== "shop_owner") {
      return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const verify = emailVerificationEnabled();
    const verification = verify ? createEmailToken() : null;

    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      phone: phone || "",
      location: location || "",
      isVerified: false,
      emailVerified: !verify,
      ...(verification && {
        emailVerificationTokenHash: verification.hash,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60_000),
        emailVerificationSentAt: new Date(),
      }),
    });

    // A failed send must not lose the account: the user can resend from sign-in.
    let emailSent = false;
    if (verification) {
      try {
        await sendVerificationEmail(
          email,
          firstName,
          `${appUrl(request)}/verify-email?token=${verification.token}${next ? `&next=${encodeURIComponent(next)}` : ""}`
        );
        emailSent = true;
      } catch (error) {
        console.error("Verification email failed:", error);
      }
    }

    // If shop owner, create the shop (not verified by default)
    let shopData = null;
    if (role === "shop_owner" && shop) {
      shopData = await Shop.create({
        name: shop.name,
        description: shop.description,
        ownerId: user._id,
        locationId: shop.locationId || "",
        status: "pending", // NOT verified by default
        contact: {
          phone: phone || "",
          email: email,
          whatsapp: phone || "",
        },
        specialties: shop.specialties || [],
        hours: {},
        images: [],
        totalReviews: 0,
      });
      // Invalidate shops cache so new shop appears immediately
      invalidateCache("shops:");
    }

    // Send welcome notification
    const { createNotification } = await import("@/lib/notifications");
    if (role === "customer") {
      await createNotification({
        userId: user._id.toString(),
        type: "system",
        title: "Welcome to Pakalale! 🎉",
        message: `Hey ${firstName}! Start by browsing shops near you or searching for products. Tap the search bar to get started.`,
        actionUrl: "/customer",
      });
      await createNotification({
        userId: user._id.toString(),
        type: "shop",
        title: "Discover Nearby Shops",
        message: "Browse verified shops in your area. Find the best deals on products you love.",
        actionUrl: "/customer/locations",
      });
    } else if (role === "shop_owner") {
      await createNotification({
        userId: user._id.toString(),
        type: "system",
        title: "Shop Owner Welcome! 🏪",
        message: `Welcome ${firstName}! Your shop is being reviewed. You'll be notified once verified. Start adding products right away.`,
        actionUrl: "/shop/feed",
      });
    }


    return NextResponse.json(
      {
        message: "Account created successfully",
        verificationRequired: verify,
        emailSent,
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        shop: shopData ? { id: shopData._id.toString(), name: shopData.name } : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
