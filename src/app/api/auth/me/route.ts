import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { toClientUser } from "@/lib/authUser";
import { getSessionUser } from "@/lib/session";
import User from "@/models/User";

/** The signed-in user, so pages can restore it after a redirect-based login (Google). */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    await connectToDatabase();
    const user = await User.findById(session.id).lean();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ user: toClientUser(user) });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ error: "Could not check session" }, { status: 500 });
  }
}
