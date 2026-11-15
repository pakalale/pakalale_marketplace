import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Notification from "@/models/Notification";
import { getCached, setCache, invalidateCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const cacheKey = `notif:${userId}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .select("userId type title message isRead actionUrl createdAt")
        .lean(),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    const result = {
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        userId: n.userId.toString(),
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        actionUrl: n.actionUrl,
        createdAt: n.createdAt,
      })),
      unreadCount,
    };
    setCache(cacheKey, result, 30_000); // 30s cache
    return NextResponse.json(result);
  } catch (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { userId, action } = body;

    if (action === "markAllRead" && userId) {
      await Notification.updateMany({ userId, isRead: false }, { isRead: true });
      invalidateCache(`notif:${userId}`);
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      await Notification.findByIdAndUpdate(body.id, { isRead: body.isRead ?? true });
      if (userId) invalidateCache(`notif:${userId}`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Notifications PUT error:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();

    if (body.id) {
      await Notification.findByIdAndDelete(body.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
  } catch (error) {
    console.error("Notifications DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}
