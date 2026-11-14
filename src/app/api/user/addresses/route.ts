import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { requireSession } from "@/lib/session";
import User, { type IAddress } from "@/models/User";

const MAX_ADDRESSES = 10;

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function toClient(address: IAddress) {
  return {
    id: address._id.toString(),
    label: address.label,
    recipient: address.recipient || "",
    phone: address.phone || "",
    details: address.details,
    isDefault: Boolean(address.isDefault),
  };
}

async function listFor(userId: string) {
  const user = await User.findById(userId).select("addresses").lean();
  return (user?.addresses || []).map(toClient);
}

/** The signed-in person's saved delivery addresses. */
export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  await connectToDatabase();
  return NextResponse.json({ addresses: await listFor(auth.user.id) });
}

/** Add an address. The first one becomes the default. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const body = await request.json();
    const label = text(body.label, 40) || "Home";
    const details = text(body.details, 300);
    if (!details) return NextResponse.json({ error: "Enter the address" }, { status: 400 });

    await connectToDatabase();
    const user = await User.findById(auth.user.id).select("addresses");
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    const addresses = user.addresses || [];
    if (addresses.length >= MAX_ADDRESSES) {
      return NextResponse.json({ error: `You can save up to ${MAX_ADDRESSES} addresses` }, { status: 400 });
    }
    const makeDefault = Boolean(body.isDefault) || addresses.length === 0;
    if (makeDefault) addresses.forEach((address) => (address.isDefault = false));
    addresses.push({
      label,
      details,
      recipient: text(body.recipient, 80),
      phone: text(body.phone, 40),
      isDefault: makeDefault,
    } as IAddress);
    user.addresses = addresses;
    await user.save();
    return NextResponse.json({ addresses: user.addresses.map(toClient) }, { status: 201 });
  } catch (error) {
    console.error("Add address error:", error);
    return NextResponse.json({ error: "Could not save the address" }, { status: 500 });
  }
}

/** Edit an address, or make it the default. */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const body = await request.json();
    if (!mongoose.isValidObjectId(body.id)) return NextResponse.json({ error: "Address not found" }, { status: 404 });

    await connectToDatabase();
    const user = await User.findById(auth.user.id).select("addresses");
    const address = user?.addresses?.find((item) => item._id.toString() === body.id);
    if (!user || !address) return NextResponse.json({ error: "Address not found" }, { status: 404 });

    if (body.label !== undefined) address.label = text(body.label, 40) || address.label;
    if (body.details !== undefined) {
      const details = text(body.details, 300);
      if (!details) return NextResponse.json({ error: "Enter the address" }, { status: 400 });
      address.details = details;
    }
    if (body.recipient !== undefined) address.recipient = text(body.recipient, 80);
    if (body.phone !== undefined) address.phone = text(body.phone, 40);
    if (body.isDefault === true) user.addresses!.forEach((item) => (item.isDefault = item._id.toString() === body.id));
    await user.save();
    return NextResponse.json({ addresses: user.addresses!.map(toClient) });
  } catch (error) {
    console.error("Update address error:", error);
    return NextResponse.json({ error: "Could not update the address" }, { status: 500 });
  }
}

/** Remove an address. If it was the default, the next one takes over. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSession(request);
    if (auth.response) return auth.response;
    const id = request.nextUrl.searchParams.get("id");
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Address not found" }, { status: 404 });

    await connectToDatabase();
    const user = await User.findById(auth.user.id).select("addresses");
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    const remaining = (user.addresses || []).filter((item) => item._id.toString() !== id);
    if (remaining.length > 0 && !remaining.some((item) => item.isDefault)) remaining[0].isDefault = true;
    user.addresses = remaining;
    await user.save();
    return NextResponse.json({ addresses: user.addresses.map(toClient) });
  } catch (error) {
    console.error("Delete address error:", error);
    return NextResponse.json({ error: "Could not delete the address" }, { status: 500 });
  }
}
