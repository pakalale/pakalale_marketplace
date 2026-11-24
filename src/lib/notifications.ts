import { connectToDatabase } from "@/lib/mongodb";
import Notification from "@/models/Notification";
import { invalidateCache } from "@/lib/cache";

/** Minimal shape of the Socket.IO server exposed by server.ts on globalThis. */
type IoLike = {
  to: (room: string) => { emit: (event: string, payload: unknown) => unknown };
};

function getIo(): IoLike | null {
  const global = globalThis as typeof globalThis & { __pakalaleIo?: IoLike };
  return global.__pakalaleIo ?? null;
}

/** Push the fresh unread count to the user's connected clients. */
async function emitUnreadCount(userId: string) {
  const io = getIo();
  if (!io) return;
  try {
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    io.to(`user:${userId}`).emit("new_notification", { userId, unreadCount });
  } catch (e) {
    console.error("Failed to emit notification count:", e);
  }
}

/**
 * Create a notification for a user.
 * Call this from any API route to send notifications.
 */
export async function createNotification(data: {
  userId: string;
  type: "message" | "like" | "comment" | "review" | "shop" | "order" | "system";
  title: string;
  message: string;
  actionUrl?: string;
  relatedId?: string;
}) {
  try {
    await connectToDatabase();
    const notif = await Notification.create({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      actionUrl: data.actionUrl || undefined,
      relatedId: data.relatedId || undefined,
      isRead: false,
    });
    invalidateCache(`notif:${data.userId}`);
    await emitUnreadCount(data.userId);
    return notif;
  } catch (e) {
    console.error("Failed to create notification:", e);
    return null;
  }
}

/**
 * Bulk create notifications for multiple users.
 * Useful for notifying all shop owners in an area.
 */
export async function createBulkNotifications(
  userIds: string[],
  data: {
    type: "message" | "like" | "comment" | "review" | "shop" | "order" | "system";
    title: string;
    message: string;
    actionUrl?: string;
    relatedId?: string;
  }
) {
  try {
    await connectToDatabase();
    const docs = userIds.map((userId) => ({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      actionUrl: data.actionUrl || undefined,
      relatedId: data.relatedId || undefined,
      isRead: false,
    }));
    await Notification.insertMany(docs);
    userIds.forEach((uid) => invalidateCache(`notif:${uid}`));
    await Promise.all(userIds.map((uid) => emitUnreadCount(uid)));
  } catch (e) {
    console.error("Failed to create bulk notifications:", e);
  }
}
