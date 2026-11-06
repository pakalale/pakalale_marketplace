import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import NewsletterSubscriber from "@/models/NewsletterSubscriber";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const address = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    await connectToDatabase();
    // Upsert so subscribing twice is not an error or a way to probe the list.
    await NewsletterSubscriber.updateOne(
      { email: address },
      { $setOnInsert: { email: address } },
      { upsert: true }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Newsletter POST error:", error);
    return NextResponse.json({ error: "Could not subscribe" }, { status: 500 });
  }
}
