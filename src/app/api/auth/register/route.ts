import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import Shop from "@/models/Shop";
import { invalidateCache } from "@/lib/cache";
import { createEmailToken, normalizeEmail, MIN_PASSWORD_LENGTH } from "@/lib/authTokens";
import { appUrl, emailVerificationEnabled, sendVerificationEmail } from "@/lib/email";
import { safeNextPath } from "@/lib/authRedirect";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { password, firstName, lastName, role, phone, location, shop } = body;
    const email = normalizeEmail(body.email);

    if (!email || typeof password !== "string" || !firstName || !lastName || !["customer", "shop_owner"].includes(role)) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const verificationRequired = emailVerificationEnabled();
    const verification = verificationRequired ? createEmailToken() : null;
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      phone: phone || "",
      location: location || "",
      isVerified: false,
      emailVerified: !verificationRequired,
      ...(verification && {
        emailVerificationTokenHash: verification.hash,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60_000),
        emailVerificationSentAt: new Date(),
      }),
    });

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
        message: `Welcome ${firstName}! Your shop is being reviewed. You'll be notified once verified. Start adding products right away.`,        actionUrl: "/shop",
      });
    }

    if (verification) {
      const verifyUrl = new URL(`${appUrl(request)}/verify-email`);
      verifyUrl.searchParams.set("token", verification.token);
      const next = safeNextPath(body.next);
      if (next) verifyUrl.searchParams.set("next", next);
      await sendVerificationEmail(user.email, user.firstName, verifyUrl.toString());
    }


    return NextResponse.json(
      {
        message: "Account created successfully",
        verificationRequired,
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
