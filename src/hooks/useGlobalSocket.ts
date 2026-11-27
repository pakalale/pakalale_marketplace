"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useNotificationStore } from "@/store/notificationStore";
import { useOnlineStore } from "@/store/onlineStore";
import { useTypingStore } from "@/store/typingStore";

const SOCKET_URL = typeof window !== "undefined" ? window.location.origin : "";

/**
 * Global socket connection that runs in the dashboard layout.
 * Listens for new messages and notifications
 * and pushes counts to zustand stores in real-time.
 */
export function useGlobalSocket(userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const setOnlineUsers = useOnlineStore((s) => s.setOnlineUsers);
  const addOnlineUser = useOnlineStore((s) => s.addUser);
  const removeOnlineUser = useOnlineStore((s) => s.removeUser);
  const setTyping = useTypingStore((s) => s.setTyping);
  const clearTyping = useTypingStore((s) => s.clearTyping);

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
      socket.emit("register", userId);
    });

    socket.on("reconnect", () => {
      socket.emit("register", userId);
    });

    // ── Real-time notification count ──
    socket.on("new_notification", (data: { userId: string; unreadCount?: number }) => {
      if (data.userId === userId) {
        if (data.unreadCount !== undefined) {
          setUnreadCount(data.unreadCount);
        } else {
          // Increment if we don't have exact count
          useNotificationStore.setState((s) => ({
            unreadCount: s.unreadCount + 1,
          }));
        }
      }
    });

    // ── Real-time chat unread count ──
    // When a new message arrives for a chat the user is NOT actively viewing,
    // the chat page will handle it. But we can listen for a count event.
    socket.on("new_message_count", (data: { userId: string; totalUnread: number }) => {
      if (data.userId === userId) {
        // Update via custom event that BottomNav listens to
        window.dispatchEvent(
          new CustomEvent("chat-unread-update", { detail: { totalUnread: data.totalUnread } })
        );
      }
    });

    // ── Global online status tracking ──
    socket.on("online_users_list", (data: { users: string[] }) => {
      setOnlineUsers(data.users);
    });

    socket.on("user_online", (data: { userId: string }) => {
      addOnlineUser(data.userId);
    });

    socket.on("user_offline", (data: { userId: string }) => {
      removeOnlineUser(data.userId);
    });

    // ── Global typing status for chat list ──
    socket.on("user_typing_global", (data: { chatId: string; userId: string; userName: string }) => {
      if (data.userId !== userId) {
        setTyping(data.chatId, data.userId, data.userName);
      }
    });

    socket.on("user_stop_typing_global", (data: { chatId: string; userId: string }) => {
      clearTyping(data.chatId, data.userId);
    });

    // ── Broadcast message received ──
    // The server broadcasts "new_message" to all users in the chat room.
    // If the user is NOT in that chat, they need their unread count bumped.
    socket.on("new_message", (msg: { chatId: string; senderId: string }) => {
      if (msg.senderId !== userId) {
        // Bump chat unread count for BottomNav
        window.dispatchEvent(new CustomEvent("chat-unread-increment"));
      }
    });

    // ── Heartbeat: update lastActiveAt every 60s ──
    const heartbeatInterval = setInterval(() => {
      fetch("/api/user/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
    }, 60_000);

    // Also send heartbeat immediately on connect
    fetch("/api/user/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => {});

    return () => {
      clearInterval(heartbeatInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, setUnreadCount, setOnlineUsers, addOnlineUser, removeOnlineUser, setTyping, clearTyping]);
}
