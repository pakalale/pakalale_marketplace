import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import dotenv from "dotenv";

dotenv.config({ path: ".env", override: true });

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

console.log(`> Starting server (dev=${dev}, port=${port}, host=${hostname})`);
console.log(`> CWD: ${process.cwd()}`);
console.log(`> NODE_ENV: ${process.env.NODE_ENV}`);

const app = next({ dev, dir: process.cwd() });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    // Production optimizations
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
    allowUpgrades: true,
    perMessageDeflate: false,
    httpCompression: true,
    maxHttpBufferSize: 1e8, // 100MB for large file transfers
  });

  // Expose the Socket.IO server so API routes running in this process can push
  // real-time events (notifications, message badges) to connected users.
  (globalThis as typeof globalThis & { __pakalaleIo?: Server }).__pakalaleIo = io;

  // Track online users
  const onlineUsers = new Map<string, Set<string>>();
  const userSockets = new Map<string, string>();

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    socket.on("register", (userId: string) => {
      userSockets.set(userId, socket.id);
      // Personal room so server-side code can target this user directly.
      socket.join(`user:${userId}`);
      // Broadcast this user coming online to ALL connected clients
      io.emit("user_online", { userId });
      // Send current online user list to the newly connected user
      const allOnlineUserIds = Array.from(userSockets.keys());
      socket.emit("online_users_list", { users: allOnlineUserIds });
      console.log(`👤 User registered: ${userId} -> ${socket.id}`);
    });

    socket.on("join_chat", (chatId: string) => {
      socket.join(chatId);
      const userId = Array.from(userSockets.entries()).find(([, sid]) => sid === socket.id)?.[0];
      if (userId) {
        if (!onlineUsers.has(chatId)) onlineUsers.set(chatId, new Set());
        onlineUsers.get(chatId)!.add(userId);
        io.to(chatId).emit("user_joined", { userId, chatId });
        console.log(`💬 User ${userId} joined chat ${chatId}`);
      }
    });

    socket.on("leave_chat", (chatId: string) => {
      socket.leave(chatId);
      const userId = Array.from(userSockets.entries()).find(([, sid]) => sid === socket.id)?.[0];
      if (userId) {
        onlineUsers.get(chatId)?.delete(userId);
        io.to(chatId).emit("user_left", { userId, chatId });
        console.log(`🚪 User ${userId} left chat ${chatId}`);
      }
    });

    socket.on("send_message", (data: {
      chatId: string;
      senderId: string;
      senderName: string;
      senderRole: string;
      content: string;
      type: string;
      timestamp: string;
      id: string;
      recipientId?: string;
      recipientIds?: string[];
    }) => {
      // Broadcast to chat room (for users actively viewing the chat)
      socket.to(data.chatId).emit("new_message", data);

      // Also notify recipients who are online but NOT viewing this chat, so
      // their global unread badge updates in real-time. Recipients viewing the
      // chat already got the message through the room broadcast above.
      const recipients = data.recipientIds || (data.recipientId ? [data.recipientId] : []);
      const chatRoom = io.sockets.adapter.rooms.get(data.chatId);
      for (const rid of recipients) {
        if (rid === data.senderId) continue;
        const recipientRoom = io.sockets.adapter.rooms.get(`user:${rid}`);
        if (!recipientRoom) continue;
        const isViewingChat = chatRoom
          ? [...recipientRoom].some((sid) => chatRoom.has(sid))
          : false;
        if (!isViewingChat) {
          io.to(`user:${rid}`).emit("new_message", data);
        }
      }

      console.log(`📨 Message in ${data.chatId} from ${data.senderName}: ${data.content.substring(0, 50)}`);
    });

    socket.on("typing", (data: { chatId: string; userId: string; userName: string }) => {
      // Broadcast to chat room members
      socket.to(data.chatId).emit("user_typing", data);
      // Also broadcast globally so chat list can show typing status
      io.emit("user_typing_global", data);
    });

    socket.on("stop_typing", (data: { chatId: string; userId: string }) => {
      // Broadcast to chat room members
      socket.to(data.chatId).emit("user_stop_typing", data);
      // Also broadcast globally
      io.emit("user_stop_typing_global", data);
    });

    socket.on("get_online_users", (chatId: string) => {
      const users = Array.from(onlineUsers.get(chatId) || []);
      socket.emit("online_users", { chatId, users });
    });

    socket.on("disconnect", () => {
      const userId = Array.from(userSockets.entries()).find(([, sid]) => sid === socket.id)?.[0];
      if (userId) {
        userSockets.delete(userId);
        onlineUsers.forEach((users, chatId) => {
          if (users.delete(userId)) {
            io.to(chatId).emit("user_left", { userId, chatId });
          }
        });
        // Broadcast this user going offline to ALL connected clients
        io.emit("user_offline", { userId });
        console.log(`👤 User disconnected: ${userId}`);
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    io.close();
    httpServer.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running on same port`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
  });
});
