import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { invalidateCache } from "@/lib/cache";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { userId } = body;
    const auth = await requireSession(request, { actingAs: userId });
    if (auth.response) return auth.response;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    await User.findByIdAndUpdate(userId, { lastActiveAt: new Date() });
    invalidateCache(`profile:${userId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
