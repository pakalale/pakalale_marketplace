import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import Shop from "@/models/Shop";
import ShopView from "@/models/ShopView";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser(request);
    if (!session) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
    if (session.role !== "shop_owner" && session.role !== "admin") {
      return NextResponse.json({ error: "You cannot access shop visitors" }, { status: 403 });
    }

    await connectToDatabase();
    const shop = await Shop.findOne({ ownerId: session.id }).select("_id").lean();
    if (!shop) return NextResponse.json({ views: [] });

    const views = await ShopView.find({ shopId: shop._id })
      .sort({ lastViewedAt: -1 })
      .limit(100)
      .populate("visitorId", "firstName lastName avatar")
      .lean();

    return NextResponse.json({
      views: views.map((view) => {
        const visitor = view.visitorId as unknown as Record<string, unknown>;
        return {
          id: view._id.toString(),
          visitor: {
            id: String(visitor._id),
            firstName: visitor.firstName,
            lastName: visitor.lastName,
            avatar: visitor.avatar,
          },
          lastViewedAt: view.lastViewedAt,
        };
      }),
    });
  } catch (error) {
    console.error("Shop views GET error:", error);
    return NextResponse.json({ error: "Failed to load shop visitors" }, { status: 500 });
  }
}