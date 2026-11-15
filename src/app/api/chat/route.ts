import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Chat, Message } from "@/models/Message";
import Product from "@/models/Product";
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
      .select("type participants dealInfo.productName dealInfo.initialPrice dealInfo.counterPrice dealInfo.status dealInfo.quantity lastMessage lastMessageTime isActive createdAt updatedAt")
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
            .select("firstName lastName avatar role")
            .lean()
        : [],
      allParticipantIds.length > 0
        ? ShopModel.find({ ownerId: { $in: allParticipantIds } })
            .select("ownerId name profileImage")
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
    const shopMap = new Map<string, { name: string; profileImage: string }>();
    shops.forEach((s) => shopMap.set(toStr(s.ownerId), { name: String(s.name || ""), profileImage: String(s.profileImage || "") }));
    const msgMap = new Map<string, Record<string, unknown>>();
    lastMessages.forEach((m) => msgMap.set(toStr(m._id), m as unknown as Record<string, unknown>));
    const unreadMap = new Map<string, number>();
    unreadCounts.forEach((u) => unreadMap.set(toStr(u._id), u.count));
    const totalUnread = unreadCounts.reduce((sum, u) => sum + u.count, 0);

    // Count pending deals only
    const totalDeals = chats.filter(
      (c) => c.type === "deal" && c.dealInfo && c.dealInfo.status === "pending"
    ).length;

    const result = {
      chats: chats.map((chat) => {
        const parts = (chat.participants || []).map((pid) => {
          const uid = toStr(pid);
          const u = userMap.get(uid);
          if (!u) return { id: uid, name: "", avatar: undefined, role: undefined };
          // For shop owners, use shop name/avatar instead of personal name/avatar
          const shop = u.role === "shop_owner" ? shopMap.get(uid) : null;
          return {
            id: uid,
            name: shop?.name || `${u.firstName} ${u.lastName}`,
            avatar: shop?.profileImage || u.avatar,
            role: u.role,
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
          dealInfo: chat.dealInfo,
          isActive: chat.isActive,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        };
      }),
      totalUnread,
      totalDeals,
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
      const chat = await Chat.findById(body.chatId).select("participants dealInfo").lean();
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
          const isDealChat = chat.type === "deal" && chat.dealInfo;
          await createNotification({
            userId: recipientId,
            type: isDealChat ? "deal" : "message",
            title: isDealChat ? `Deal: ${chat.dealInfo?.productName || "Update"}` : `New message from ${body.senderName}`,
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

    // One conversation per pair. Previously this only matched the requested
    // type, so messaging a shop after a deal (or opening a second deal) added
    // another entry to the chat list for the same two people.
    const existingChat = await Chat.findOne({
      participants: { $all: body.participants, $size: 2 },
      isActive: true,
    })
      .sort({ lastMessageTime: -1 })
      .lean();

    if (existingChat) {
      let chat = existingChat;

      // Reuse the conversation, but refresh the deal details when the caller
      // starts a new deal (different product, or the previous deal finished).
      if (body.dealInfo) {
        const incomingProductId = toStr(body.dealInfo.productId);
        const existingProductId = toStr(existingChat.dealInfo?.productId);
        const sameProduct =
          incomingProductId.length > 0 && incomingProductId === existingProductId;
        const sameOffer =
          sameProduct &&
          Number(existingChat.dealInfo?.initialPrice) === Number(body.dealInfo.initialPrice) &&
          Number(existingChat.dealInfo?.quantity || 1) === Number(body.dealInfo.quantity || 1);
        const dealFinished =
          !!existingChat.dealInfo &&
          (existingChat.dealInfo.status === "completed" ||
            existingChat.dealInfo.status === "cancelled");

        if (!existingChat.dealInfo || !sameOffer || dealFinished) {
          const updated = await Chat.findByIdAndUpdate(
            existingChat._id,
            { type: "deal", dealInfo: body.dealInfo },
            { new: true }
          ).lean();
          if (updated) {
            chat = updated;
            body.participants.forEach((p: string) => invalidateCache(`chat:list:${p}`));
          }
        }
      }

      return NextResponse.json({
        chat: {
          id: chat._id.toString(),
          type: chat.type,
          participants: chat.participants.map((p) => toStr(p)),
          dealInfo: chat.dealInfo,
          isActive: chat.isActive,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
      });
    }

    const chat = await Chat.create({
      type: body.type || "general",
      participants: body.participants,
      dealInfo: body.dealInfo,
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
      if (body.type === "deal" && body.dealInfo) {
        await createNotification({
          userId: recipientId,
          type: "deal",
          title: `New deal: ${body.dealInfo.productName || "Product"}`,
          message: `A customer wants to make a deal on ${body.dealInfo.productName || "a product"}.`,
          actionUrl: `/customer/chat?chatId=${newChatId}`,
        });
      } else {
        await createNotification({
          userId: recipientId,
          type: "message",
          title: "New conversation",
          message: "Someone wants to chat with you.",
          actionUrl: `/customer/chat?chatId=${newChatId}`,
        });
      }
    }

    return NextResponse.json(
      {
        chat: {
          id: chat._id.toString(),
          type: chat.type,
          participants: chat.participants.map((p) => toStr(p)),
          dealInfo: chat.dealInfo,
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

    if (action === "updateDealStatus" && body.chatId && body.dealStatus) {
      const validStatuses = ["pending", "negotiating", "confirmed", "completed", "cancelled"];
      if (!validStatuses.includes(body.dealStatus)) {
        return NextResponse.json({ error: "Invalid deal status" }, { status: 400 });
      }
      const chat = await Chat.findById(body.chatId);
      if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      if (!chat.dealInfo) return NextResponse.json({ error: "No deal in this chat" }, { status: 400 });

      // Only the shop owner can confirm or complete a deal
      const shopRestrictedStatuses = ["confirmed", "completed"];
      if (shopRestrictedStatuses.includes(body.dealStatus)) {
        const User = (await import("@/models/User")).default;
        const sender = await User.findById(body.senderId).select("role").lean();
        if (!sender || sender.role !== "shop_owner") {
          return NextResponse.json({ error: "Only the shop owner can confirm or complete a deal" }, { status: 403 });
        }
      }

      const previousStatus = chat.dealInfo.status;
      chat.dealInfo.status = body.dealStatus as "pending" | "negotiating" | "confirmed" | "completed" | "cancelled";
      await chat.save();

      // Reduce product stock when deal is completed + track lastSoldAt
      if (body.dealStatus === "completed" && previousStatus !== "completed") {
        const productId = chat.dealInfo.productId;
        const quantity = chat.dealInfo.quantity || 1;

        if (productId) {
          try {
            const product = await Product.findById(productId);
            if (product) {
              const newStock = Math.max(0, product.stock - quantity);
              await Product.findByIdAndUpdate(productId, {
                stock: newStock,
                isAvailable: newStock > 0,
                lastSoldAt: new Date(),
                $inc: { reviews: 0 }, // touch updatedAt
              });
              invalidateCache("products:");
            }
          } catch (e) {
            console.error("Failed to reduce stock:", e);
          }
        }
      }

      // Invalidate caches
      const chatParticipants = chat.participants.map((p) => toStr(p));
      chatParticipants.forEach((p) => invalidateCache(`chat:list:${p}`));

      // Create system message for status change
      const statusLabels: Record<string, string> = {
        pending: "Deal is pending",
        negotiating: "Deal is being negotiated",
        confirmed: "Deal has been confirmed ✓",
        completed: "Deal has been completed ✓✓",
        cancelled: "Deal has been cancelled ✗",
      };
      await Message.create({
        chatId: body.chatId,
        senderId: body.senderId || chat.participants[0],
        senderName: "System",
        senderRole: "customer",
        content: statusLabels[body.dealStatus] || `Deal status: ${body.dealStatus}`,
        type: "deal_update",
        timestamp: new Date(),
        isRead: false,
        readBy: [],
      });

      // Compute fresh totalDeals for all participants so they get exact count
      const freshChats = await Chat.find({ participants: { $in: chatParticipants }, isActive: true })
        .select("type dealInfo.status")
        .lean();
      const freshTotalDeals = freshChats.filter(
        (c) => c.type === "deal" && c.dealInfo && c.dealInfo.status === "pending"
      ).length;

      return NextResponse.json({ success: true, dealInfo: chat.dealInfo, totalDeals: freshTotalDeals });
    }

    if (action === "proposePrice" && body.chatId && body.price !== undefined) {
      const chat = await Chat.findById(body.chatId);
      if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      if (!chat.dealInfo) return NextResponse.json({ error: "No deal in this chat" }, { status: 400 });

      const price = Number(body.price);
      if (isNaN(price) || price < 0) {
        return NextResponse.json({ error: "Invalid price" }, { status: 400 });
      }

      // Update deal info with the counter-offer
      chat.dealInfo.counterPrice = price;
      chat.dealInfo.lastOfferBy = body.senderId;
      // Auto-move to negotiating if still pending
      if (chat.dealInfo.status === "pending") {
        chat.dealInfo.status = "negotiating";
      }
      await chat.save();

      // Determine who proposed
      const User = (await import("@/models/User")).default;
      const proposer = await User.findById(body.senderId).select("firstName lastName").lean();
      const proposerName = proposer ? `${proposer.firstName} ${proposer.lastName}` : "Someone";

      // Create system message about the counter-offer
      const previousPrice = body.previousPrice;
      let offerText = `${proposerName} proposed K${price.toLocaleString()}`;
      if (previousPrice && previousPrice !== price) {
        offerText = `${proposerName} countered K${price.toLocaleString()} (was K${previousPrice.toLocaleString()})`;
      }

      await Message.create({
        chatId: body.chatId,
        senderId: body.senderId,
        senderName: "System",
        senderRole: body.senderRole || "customer",
        content: offerText,
        type: "deal_update",
        timestamp: new Date(),
        isRead: false,
        readBy: [],
      });

      // Invalidate caches
      const chatParticipants = chat.participants.map((p) => toStr(p));
      chatParticipants.forEach((p) => invalidateCache(`chat:list:${p}`));
      invalidateCache(`chat:messages:${body.chatId}`);

      // Notify the other party
      const { createNotification } = await import("@/lib/notifications");
      const recipientIds = chatParticipants.filter((p) => p !== body.senderId);
      for (const recipientId of recipientIds) {
        await createNotification({
          userId: recipientId,
          type: "deal",
          title: `Counter-offer: K${price.toLocaleString()}`,
          message: `${proposerName} proposed K${price.toLocaleString()} for ${chat.dealInfo.productName || "your deal"}.`,
          actionUrl: `/customer/chat?chatId=${body.chatId}`,
        });
      }

      return NextResponse.json({ success: true, dealInfo: chat.dealInfo });
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

      // If this is a deal chat, auto-cancel the deal
      if (chat.type === "deal" && chat.dealInfo && chat.dealInfo.status !== "cancelled" && chat.dealInfo.status !== "completed") {
        chat.dealInfo.status = "cancelled";
        await chat.save();

        // Create a system message about the cancellation
        await Message.create({
          chatId: body.chatId,
          senderId: body.userId,
          senderName: "System",
          senderRole: "customer",
          content: "Deal has been cancelled ✗",
          type: "deal_update",
          timestamp: new Date(),
          isRead: false,
          readBy: [],
        });
      }

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
