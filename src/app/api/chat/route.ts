import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Chat, Message } from "@/models/Message";
import { getCached, setCache, invalidateCache } from "@/lib/cache";

export const maxDuration = 30;

function toStr(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "_id" in val) {
    return String((val as { _id: unknown })._id);
  }
  return String(val);
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId");
    const chatId = searchParams.get("chatId");

    if (chatId) {
      const cacheKey = `chat:messages:${chatId}`;
      const cached = getCached(cacheKey);
      if (cached) return NextResponse.json(cached);

      const messages = await Message.find({ chatId })
        .sort({ timestamp: 1 })
        .select("chatId senderId senderName senderRole content type isRead readBy replyTo timestamp")
        .lean();

      const result = {
        messages: messages.map((m) => ({
          id: m._id.toString(),
          chatId: toStr(m.chatId),
          senderId: toStr(m.senderId),
          senderName: m.senderName,
          senderRole: m.senderRole,
          content: m.content,
          type: m.type,
          isRead: m.isRead,
          readBy: m.readBy?.map((r) => toStr(r)) || [],
          replyTo: m.replyTo,
          timestamp: m.timestamp,
        })),
      };
      setCache(cacheKey, result, 10_000); // 10s cache
      return NextResponse.json(result);
    }

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const listCacheKey = `chat:list:${userId}`;
    const cachedList = getCached(listCacheKey);
    if (cachedList) return NextResponse.json(cachedList);

    // Fetch chats — minimal fields
    const chats = await Chat.find({ participants: userId, isActive: true })
      .sort({ lastMessageTime: -1 })
      .select("type participants lastMessage lastMessageTime isActive createdAt updatedAt")
      .limit(100)
      .lean();

    if (chats.length === 0) {
      const result = { chats: [], totalUnread: 0 };
      setCache(listCacheKey, result, 30_000);
      return NextResponse.json(result);
    }

    // Collect all IDs we need to look up
    const allParticipantIds = [...new Set(
      chats.flatMap((c) => c.participants.map((p) => toStr(p)).filter(Boolean))
    )];
    const lastMessageIds = chats
      .filter((c) => c.lastMessage)
      .map((c) => toStr(c.lastMessage))
      .filter(Boolean);

    // Batch fetch all data in parallel — 3 queries total instead of N+1
    const User = (await import("@/models/User")).default;
    const ShopModel = (await import("@/models/Shop")).default;
    const [participants, shops, lastMessages, unreadCounts] = await Promise.all([
      allParticipantIds.length > 0
        ? User.find({ _id: { $in: allParticipantIds } })
            .select("firstName lastName avatar role phone lastActiveAt")
            .lean()
        : [],
      allParticipantIds.length > 0
        ? ShopModel.find({ ownerId: { $in: allParticipantIds } })
            .select("ownerId name profileImage contact.phone")
            .lean()
        : [],
      lastMessageIds.length > 0
        ? Message.find({ _id: { $in: lastMessageIds } })
            .select("content senderId type isRead readBy timestamp")
            .lean()
        : [],
      // Unread counts — simple group-by instead of full aggregate with $ne
      Message.aggregate([
        {
          $match: {
            chatId: { $in: chats.map((c) => c._id) },
            senderId: { $ne: new mongoose.Types.ObjectId(userId) },
            isRead: false,
          },
        },
        { $group: { _id: "$chatId", count: { $sum: 1 } } },
        { $project: { count: 1 } },
      ]),
    ]);

    // Build lookup maps
    const userMap = new Map<string, Record<string, unknown>>();
    participants.forEach((p) => userMap.set(toStr(p._id), p as unknown as Record<string, unknown>));
    const shopMap = new Map<string, { name: string; profileImage: string; phone: string }>();
    shops.forEach((s) =>
      shopMap.set(toStr(s.ownerId), {
        name: String(s.name || ""),
        profileImage: String(s.profileImage || ""),
        phone: String(s.contact?.phone || ""),
      })
    );
    const msgMap = new Map<string, Record<string, unknown>>();
    lastMessages.forEach((m) => msgMap.set(toStr(m._id), m as unknown as Record<string, unknown>));
    const unreadMap = new Map<string, number>();
    unreadCounts.forEach((u) => unreadMap.set(toStr(u._id), u.count));
    const totalUnread = unreadCounts.reduce((sum, u) => sum + u.count, 0);

    const result = {
      chats: chats.map((chat) => {
        const parts = (chat.participants || []).map((pid) => {
          const uid = toStr(pid);
          const u = userMap.get(uid);
          if (!u) return { id: uid, name: "", avatar: undefined, role: undefined, phone: "", lastActiveAt: null };
          // For shop owners, use shop name/avatar instead of personal name/avatar
          const shop = u.role === "shop_owner" ? shopMap.get(uid) : null;
          return {
            id: uid,
            name: shop?.name || `${u.firstName} ${u.lastName}`,
            avatar: shop?.profileImage || u.avatar,
            role: u.role,
            phone: shop?.phone || String(u.phone || ""),
            lastActiveAt: (u.lastActiveAt as Date | undefined)?.toISOString?.() || null,
          };
        });
        const otherParticipant = parts.find((p) => p.id !== userId) || null;

        let lastMsg = null;
        if (chat.lastMessage) {
          const msg = msgMap.get(toStr(chat.lastMessage));
          if (msg) {
            lastMsg = {
              id: toStr(msg._id),
              content: msg.content,
              senderId: toStr(msg.senderId),
              type: msg.type || "text",
              isRead: msg.isRead,
              readBy: Array.isArray(msg.readBy) ? msg.readBy.map((r: unknown) => toStr(r)) : [],
              timestamp: msg.timestamp,
            };
          }
        }

        return {
          id: chat._id.toString(),
          type: chat.type,
          participants: parts,
          otherParticipant,
          lastMessage: lastMsg,
          lastMessageTime: chat.lastMessageTime,
          unreadCount: unreadMap.get(toStr(chat._id)) || 0,
          isActive: chat.isActive,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        };
      }),
      totalUnread,
    };
    setCache(listCacheKey, result, 30_000); // 30s cache
    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat GET error:", error);
    return NextResponse.json({ error: "Failed to fetch chats" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();

    if (body.chatId && body.content) {
      const messageData: Record<string, unknown> = {
        chatId: body.chatId,
        senderId: body.senderId,
        senderName: body.senderName,
        senderRole: body.senderRole,
        content: body.content,
        type: body.type || "text",
        timestamp: new Date(),
        isRead: false,
        readBy: [],
      };
      if (body.replyTo) {
        messageData.replyTo = body.replyTo;
      }
      const message = await Message.create(messageData);

      await Chat.findByIdAndUpdate(body.chatId, {
        lastMessage: message._id,
        lastMessageTime: new Date(),
      });

      // Invalidate caches for all participants
      if (body.senderId) invalidateCache(`chat:list:${body.senderId}`);
      invalidateCache(`chat:messages:${body.chatId}`);
      // Also invalidate other participants' chat lists
      const chat = await Chat.findById(body.chatId).select("participants").lean();
      if (chat) {
        chat.participants.forEach((p: mongoose.Types.ObjectId) => {
          invalidateCache(`chat:list:${toStr(p)}`);
        });

        // Notify other participants of the new message
        const { createNotification } = await import("@/lib/notifications");
        const recipientIds = chat.participants
          .map((p) => toStr(p))
          .filter((p) => p !== body.senderId);

        for (const recipientId of recipientIds) {
          await createNotification({
            userId: recipientId,
            type: "message",
            title: `New message from ${body.senderName}`,
            message: body.content.length > 100 ? body.content.slice(0, 100) + "..." : body.content,
            actionUrl: `/customer/chat?chatId=${body.chatId}`,
          });
        }
      }

      return NextResponse.json(
        {
          message: {
            id: message._id.toString(),
            chatId: toStr(message.chatId),
            senderId: toStr(message.senderId),
            senderName: message.senderName,
            senderRole: message.senderRole,
            content: message.content,
            type: message.type,
            isRead: message.isRead,
            timestamp: message.timestamp,
          },
        },
        { status: 201 }
      );
    }

    // ── Validate participants ──
    if (!body.participants || body.participants.length < 2) {
      return NextResponse.json({ error: "At least 2 participants required" }, { status: 400 });
    }

    // Prevent self-messaging
    if (body.participants[0] === body.participants[1]) {
      return NextResponse.json({ error: "Cannot chat with yourself" }, { status: 400 });
    }

    // Prevent shop-to-shop and customer-to-customer chats
    const User = (await import("@/models/User")).default;
    const participantUsers = await User.find({ _id: { $in: body.participants } })
      .select("role")
      .lean();

    if (participantUsers.length !== body.participants.length) {
      return NextResponse.json({ error: "One or more users not found" }, { status: 400 });
    }

    const roles = participantUsers.map((u) => u.role);
    const allSameRole = roles.every((r) => r === roles[0]);
    if (allSameRole && roles[0] !== "admin" && roles[0] !== "customer") {
      return NextResponse.json({ error: "Cannot create chat between same account types" }, { status: 400 });
    }

    // One conversation per pair, so repeat contact never adds duplicate entries.
    const existingChat = await Chat.findOne({
      participants: { $all: body.participants, $size: 2 },
      isActive: true,
    })
      .sort({ lastMessageTime: -1 })
      .lean();

    if (existingChat) {
      const chat = existingChat;

      return NextResponse.json({
        chat: {
          id: chat._id.toString(),
          type: chat.type,
          participants: chat.participants.map((p) => toStr(p)),
          isActive: chat.isActive,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
      });
    }

    const chat = await Chat.create({
      type: "general",
      participants: body.participants,
      lastMessageTime: new Date(),
      isActive: true,
    });

    // Invalidate caches for all participants
    body.participants.forEach((p: string) => invalidateCache(`chat:list:${p}`));

    // Notify the other participant about the new chat
    const { createNotification } = await import("@/lib/notifications");
    const newChatId = chat._id.toString();
    const recipientIds = chat.participants.map((p) => toStr(p)).filter((p) => p !== body.participants[0]);
    for (const recipientId of recipientIds) {
      await createNotification({
        userId: recipientId,
        type: "message",
        title: "New conversation",
        message: "Someone wants to chat with you.",
        actionUrl: `/customer/chat?chatId=${newChatId}`,
      });
    }

    return NextResponse.json(
      {
        chat: {
          id: chat._id.toString(),
          type: chat.type,
          participants: chat.participants.map((p) => toStr(p)),
          isActive: chat.isActive,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Chat POST error:", error);
    return NextResponse.json({ error: "Failed to create chat/message" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { action, messageId, chatId, senderId, content } = body;

    if (action === "markRead" && chatId && senderId) {
      await Message.updateMany(
        { chatId, senderId: { $ne: senderId }, isRead: false },
        { $set: { isRead: true }, $addToSet: { readBy: senderId } }
      );
      invalidateCache(`chat:messages:${chatId}`);
      invalidateCache(`chat:list:${senderId}`);
      return NextResponse.json({ success: true });
    }

    if (action === "edit" && messageId && content) {
      const msg = await Message.findById(messageId);
      if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });
      msg.content = content;
      await msg.save();
      invalidateCache(`chat:messages:${msg.chatId}`);
      return NextResponse.json({ message: { id: msg._id.toString(), content: msg.content } });
    }

    if (action === "delete" && messageId) {
      const msg = await Message.findById(messageId);
      await Message.findByIdAndDelete(messageId);
      if (msg) invalidateCache(`chat:messages:${msg.chatId}`);
      return NextResponse.json({ success: true });
    }

    if (action === "archive" && body.chatId && body.userId) {
      // Archive chat for this user by removing them from participants
      const chat = await Chat.findById(body.chatId);
      if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      await Chat.findByIdAndUpdate(body.chatId, { isActive: false });

      invalidateCache(`chat:list:${body.userId}`);
      // Also invalidate other participants
      chat.participants.forEach((p: mongoose.Types.ObjectId) => {
        invalidateCache(`chat:list:${toStr(p)}`);
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Chat PUT error:", error);
    return NextResponse.json({ error: "Failed to update chat" }, { status: 500 });
  }
}
