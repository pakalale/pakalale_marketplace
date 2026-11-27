"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = typeof window !== "undefined" ? window.location.origin : "";

interface UseSocketOptions {
  userId?: string;
  chatId?: string;
  onMessage?: (message: SocketMessage) => void;
  onTyping?: (data: { chatId: string; userId: string; userName: string }) => void;
  onStopTyping?: (data: { chatId: string; userId: string }) => void;
  onUserJoined?: (data: { chatId: string; userId: string }) => void;
  onUserLeft?: (data: { chatId: string; userId: string }) => void;
}

export interface SocketMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  type: string;
  timestamp: string;
  recipientId?: string;
  recipientIds?: string[];
}

export function useSocket({
  userId,
  chatId,
  onMessage,
  onTyping,
  onStopTyping,
  onUserJoined,
  onUserLeft,
}: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // Connect socket
  useEffect(() => {
    if (!userId) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("register", userId);
      console.log("🔌 Connected to chat server");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("🔌 Disconnected from chat server");
    });

    socket.on("reconnect", () => {
      socket.emit("register", userId);
      if (chatId) socket.emit("join_chat", chatId);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  // Join/leave chat room
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !chatId) return;

    socket.emit("join_chat", chatId);

    return () => {
      socket.emit("leave_chat", chatId);
    };
  }, [chatId]);

  // Listen for events
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (onMessage) socket.on("new_message", onMessage);
    if (onTyping) socket.on("user_typing", onTyping);
    if (onStopTyping) socket.on("user_stop_typing", onStopTyping);

    socket.on("user_joined", (data: { chatId: string; userId: string }) => {
      setOnlineUsers((prev) => (prev.includes(data.userId) ? prev : [...prev, data.userId]));
      onUserJoined?.(data);
    });

    socket.on("user_left", (data: { chatId: string; userId: string }) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== data.userId));
      onUserLeft?.(data);
    });

    socket.on("online_users", (data: { users: string[] }) => {
      setOnlineUsers(data.users);
    });

    return () => {
      socket.off("new_message");
      socket.off("user_typing");
      socket.off("user_stop_typing");
      socket.off("user_joined");
      socket.off("user_left");
      socket.off("online_users");
    };
  }, [onMessage, onTyping, onStopTyping, onUserJoined, onUserLeft]);

  const sendMessage = useCallback(
    (data: Omit<SocketMessage, "id" | "timestamp">) => {
      const socket = socketRef.current;
      if (!socket) return;
      const message: SocketMessage = {
        ...data,
        id: `temp-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
      socket.emit("send_message", message);
      return message;
    },
    []
  );

  const startTyping = useCallback(
    (userName: string) => {
      const socket = socketRef.current;
      if (!socket || !userId || !chatId) return;
      socket.emit("typing", { chatId, userId, userName });
    },
    [userId, chatId]
  );

  const stopTyping = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !userId || !chatId) return;
    socket.emit("stop_typing", { chatId, userId });
  }, [userId, chatId]);

  return {
    isConnected,
    onlineUsers,
    sendMessage,
    startTyping,
    stopTyping,
    socket: socketRef.current,
  };
}
