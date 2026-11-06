import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ error: "Could not check session" }, { status: 500 });
  }
}
