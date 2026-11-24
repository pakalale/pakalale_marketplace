"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { PhoneCall } from "lucide-react";
import MessageBubble from "@/components/MessageBubble";
import MessageInput from "@/components/MessageInput";
import ChatListSimple from "@/components/ChatListSimple";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/authStore";
import {
  useChatMessages,
  sendMessage,
  type ChatData,
  type MessageData,
} from "@/hooks/useApi";
import { useOnlineStore } from "@/store/onlineStore";
import { useSocket, type SocketMessage } from "@/hooks/useSocket";
import { chatDayKey, formatChatDateDivider, formatLastSeen } from "@/lib/formatTime";

export default function ShopChatPage() {
  const { user } = useAuthStore();
  const [showChatList, setShowChatList] = useState(true);
  const [activeChat, setActiveChat] = useState<ChatData | null>(null);
  const [replyTo, setReplyTo] = useState<{
    messageId: string;
    content: string;
    senderName: string;
  } | null>(null);

  const [pendingMessages, setPendingMessages] = useState<MessageData[]>([]);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Floating date pill (WhatsApp style) — tracks the day dividers we've scrolled past
  const [stickyDateLabel, setStickyDateLabel] = useState<string | null>(null);
  const dateDividerRefs = useRef(new Map<string, HTMLDivElement>());
  const hasScrolledOnOpen = useRef(false);
  const isUserScrolledUp = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: messagesData,
    refetch: refetchMessages,
  } = useChatMessages(activeChat?.id || null);
  const messages: MessageData[] = messagesData?.messages || [];

  const allMessages = useMemo(() => {
    const serverIds = new Set(messages.map((m) => m.id));
    const stillPending = pendingMessages.filter((m) => !serverIds.has(m.id));
    return [...messages, ...stillPending];
  }, [messages, pendingMessages]);

  const unreadDividerIndex = useMemo(() => {
    if (!user?.id || allMessages.length === 0) return -1;
    return allMessages.findIndex(
      (m) => !m.isRead && m.senderId !== user.id
    );
  }, [allMessages, user?.id]);

  const hasUnread = unreadDividerIndex >= 0;

  // The date pill shows the day of the last divider scrolled above the top edge,
  // and hides while that divider itself is still visible in the flow.
  const updateStickyDate = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    let label: string | null = null;
    dateDividerRefs.current.forEach((el) => {
      if (el.offsetTop <= scrollTop + 2) label = el.textContent;
    });
    setStickyDateLabel(label);
  }, []);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    isUserScrolledUp.current = !isAtBottom;
    updateStickyDate();
  }, [updateStickyDate]);

  useEffect(() => {
    if (!messagesEndRef.current || allMessages.length === 0) return;
    if (!hasScrolledOnOpen.current) {
      if (unreadDividerRef.current) {
        setTimeout(() => {
          unreadDividerRef.current?.scrollIntoView({
            behavior: "instant",
            block: "start",
          });
        }, 50);
      } else {
        messagesEndRef.current.scrollIntoView({ behavior: "instant" });
      }
      hasScrolledOnOpen.current = true;
    } else if (!isUserScrolledUp.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [allMessages, hasUnread]);

  // Keep the floating date pill in sync after auto-scrolls and new messages
  useEffect(() => {
    const t = setTimeout(updateStickyDate, 60);
    return () => clearTimeout(t);
  }, [allMessages, activeChat?.id, updateStickyDate]);

  useEffect(() => {
    if (!activeChat?.id || !user?.id) return;
    fetch("/api/chat", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "markRead",
        chatId: activeChat.id,
        senderId: user.id,
      }),
    }).catch(() => {});
  }, [activeChat?.id, user?.id, allMessages.length]);

  // Clear typing indicator after 3 seconds
  useEffect(() => {
    if (typingUser) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
    }
    return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); };
  }, [typingUser]);

  // Socket: receive messages from OTHER users
  const handleNewMessage = useCallback(
    (msg: SocketMessage) => {
      if (msg.chatId !== activeChat?.id) return;
      refetchMessages();
    },
    [activeChat?.id, refetchMessages]
  );

  const handleTyping = useCallback(
    (data: { chatId: string; userId: string; userName: string }) => {
      if (data.chatId !== activeChat?.id || data.userId === user?.id) return;
      setTypingUser(data.userName);
    },
    [activeChat?.id, user?.id]
  );

  const handleStopTyping = useCallback(
    (data: { chatId: string; userId: string }) => {
      if (data.chatId !== activeChat?.id) return;
      setTypingUser(null);
    },
    [activeChat?.id]
  );

  const { isConnected, sendMessage: sendSocketMessage, startTyping, stopTyping } = useSocket({
    userId: user?.id,
    chatId: activeChat?.id || undefined,
    onMessage: handleNewMessage,
    onTyping: handleTyping,
    onStopTyping: handleStopTyping,
  });

  const pendingVoiceIdRef = useRef<string | null>(null);

  const handlePendingVoice = (blobUrl: string) => {
    if (!activeChat || !user) return;
    const senderName = `${user.firstName} ${user.lastName}`;
    const tempId = `pending-voice-${Date.now()}`;
    pendingVoiceIdRef.current = tempId;
    const pendingMsg: MessageData = {
      id: tempId,
      chatId: activeChat.id,
      senderId: user.id,
      senderName,
      senderRole: "shop_owner",
      content: blobUrl,
      type: "voice",
      isRead: false,
      readBy: [],
      timestamp: new Date().toISOString(),
    };
    setPendingMessages((prev) => [...prev, pendingMsg]);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      isUserScrolledUp.current = false;
    }, 50);
  };

  const handleSendMessage = async (
    content: string,
    type?: "text" | "image" | "file" | "voice"
  ) => {
    if (!content.trim() || !activeChat || !user) return;

    const senderName = `${user.firstName} ${user.lastName}`;
    const existingVoiceId = pendingVoiceIdRef.current;
    pendingVoiceIdRef.current = null;
    let tempId = `pending-${Date.now()}`;

    // For voice notes, the pending message was already shown with a blob URL.
    // Update it in place with the Cloudinary URL instead of creating a duplicate.
    if (existingVoiceId && type === "voice") {
      tempId = existingVoiceId;
      setPendingMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, content } : m))
      );
    } else {
      const pendingMsg: MessageData = {
        id: tempId,
        chatId: activeChat.id,
        senderId: user.id,
        senderName,
        senderRole: "shop_owner",
        content,
        type: type || "text",
        isRead: false,
        readBy: [],
        replyTo: replyTo || undefined,
        timestamp: new Date().toISOString(),
      };
      setPendingMessages((prev) => [...prev, pendingMsg]);
    }

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      isUserScrolledUp.current = false;
    }, 50);

    const payload: Record<string, unknown> = {
      chatId: activeChat.id,
      senderId: user.id,
      senderName,
      senderRole: "shop_owner",
      content,
      type: type || "text",
    };
    if (replyTo) {
      payload.replyTo = replyTo;
      setReplyTo(null);
    }

    if (isConnected) {
      const recipientId = activeChat.otherParticipant?.id;
      sendSocketMessage({
        chatId: activeChat.id,
        senderId: user.id,
        senderName,
        senderRole: "shop_owner",
        content,
        type: type || "text",
        ...(recipientId ? { recipientId } : {}),
      });
    }

    try {
      await sendMessage(
        payload as Parameters<typeof sendMessage>[0]
      );
      setPendingMessages((prev) => prev.filter((m) => m.id !== tempId));
      refetchMessages();
    } catch (e) {
      console.error("Failed to send message:", e);
      setPendingMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, content: `${content} (failed)` } : m
        )
      );
    }
  };

  const [imageUploading, setImageUploading] = useState(false);

  const handleSendImage = async (file: File) => {
    if (!activeChat || !user) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "pakalale/chat");
      formData.append("type", file.type.startsWith("video/") ? "video" : "image");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        handleSendMessage(data.url, "image");
      }
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setImageUploading(false);
    }
  };

  const handleReply = (message: MessageData) => {
    setReplyTo({
      messageId: message.id,
      content:
        message.type === "voice" ? "🎤 Voice message" : message.content,
      senderName: message.senderName,
    });
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (messageId.startsWith("pending-")) {
      setPendingMessages((prev) => prev.filter((m) => m.id !== messageId));
      return;
    }
    try {
      await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", messageId }),
      });
      refetchMessages();
    } catch (e) {
      console.error("Failed to delete message:", e);
    }
  };

  const handleEditMessage = async (
    messageId: string,
    newContent: string
  ) => {
    if (messageId.startsWith("pending-")) {
      setPendingMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: newContent } : m
        )
      );
      return;
    }
    try {
      await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          messageId,
          content: newContent,
        }),
      });
      refetchMessages();
    } catch (e) {
      console.error("Failed to edit message:", e);
    }
  };

  const handleChatSelect = (chat: ChatData) => {
    setActiveChat(chat);
    setReplyTo(null);
    setPendingMessages([]);
    setShowChatList(false);
    hasScrolledOnOpen.current = false;
    isUserScrolledUp.current = false;
  };

  if (showChatList) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col">
        <ChatListSimple
          userId={user?.id || ""}
          onChatSelect={handleChatSelect}
          onNewChat={() => {}}
          onBack={() => window.history.back()}
        />
      </div>
    );
  }

  const otherName = activeChat?.otherParticipant?.name || "Customer";
  const otherId = activeChat?.otherParticipant?.id;
  const profileHref = otherId ? `/shop/profile/${otherId}` : null;
  // Normalise before handing to the dialer so "+254 712 345 678" still works.
  const otherPhone = (activeChat?.otherParticipant?.phone || "").replace(/[^\d+]/g, "");
  const phoneHref = otherPhone ? `tel:${otherPhone}` : null;
  const otherOnline =
    !!otherId && useOnlineStore.getState().onlineUserIds.has(otherId);
  const presenceLabel = otherOnline
    ? "Online"
    : formatLastSeen(activeChat?.otherParticipant?.lastActiveAt) || "Offline";

  return (
    <>
      <div className="h-[100dvh] bg-background flex flex-col">
        <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border shrink-0">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <a
                  href={profileHref ?? undefined}
                  aria-label={`Open ${otherName}'s profile`}
                  className="block"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={activeChat?.otherParticipant?.avatar} alt={otherName} />
                    <AvatarFallback className="bg-primary/10 text-brand text-xs">{otherName?.charAt(0) || "?"}</AvatarFallback>
                  </Avatar>
                </a>
                {activeChat?.otherParticipant?.id && useOnlineStore.getState().onlineUserIds.has(activeChat.otherParticipant.id) && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-background rounded-full" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold truncate">{otherName}</h1>
                <p className="text-[10px] text-muted-foreground">
                  {typingUser
                    ? <span className="text-emerald-500">typing...</span>
                    : otherOnline
                      ? <span className="text-emerald-500">Online</span>
                      : presenceLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {phoneHref && (
                <a
                  href={phoneHref}
                  aria-label={`Call ${otherName}`}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-brand hover:bg-muted transition-colors"
                >
                  <PhoneCall className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </header>

        <div
          ref={messagesContainerRef}
          className="relative flex-1 overflow-y-auto flex flex-col p-3 pb-[60px]"
          onScroll={handleScroll}
        >
          {/* Floating date pill — pinned just below the header while scrolling */}
          <div className="sticky top-0 z-20 h-0 flex justify-center pointer-events-none">
            {stickyDateLabel && (
              <span className="mt-1 rounded-full bg-muted/95 backdrop-blur px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm">
                {stickyDateLabel}
              </span>
            )}
          </div>
          <div className="flex-1" />
          {allMessages.map((message, idx) => {
            const showDateDivider =
              idx === 0 || chatDayKey(allMessages[idx - 1].timestamp) !== chatDayKey(message.timestamp);
            return (
            <div key={message.id} className="mb-3">
              {showDateDivider && (
                <div
                  className="flex justify-center py-2"
                  ref={(el) => {
                    const key = chatDayKey(message.timestamp);
                    if (el) dateDividerRefs.current.set(key, el);
                    else dateDividerRefs.current.delete(key);
                  }}
                >
                  <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm">
                    {formatChatDateDivider(message.timestamp)}
                  </span>
                </div>
              )}
              {idx === unreadDividerIndex && (
                <div
                  ref={unreadDividerRef}
                  className="flex items-center gap-2 my-4"
                >
                  <div className="flex-1 h-px bg-primary/30" />
                  <span className="text-[10px] font-semibold text-brand bg-primary/10 px-2 py-0.5 rounded-full">
                    Unread messages
                  </span>
                  <div className="flex-1 h-px bg-primary/30" />
                </div>
              )}
              <MessageBubble
                message={message}
                currentUserId={user?.id}
                onReply={handleReply}
                onDelete={handleDeleteMessage}
                onEdit={handleEditMessage}
                showAvatar={
                  idx === 0 ||
                  allMessages[idx - 1]?.senderId !== message.senderId
                }
                isConsecutive={
                  idx > 0 &&
                  allMessages[idx - 1]?.senderId === message.senderId
                }
                isPending={message.id.startsWith("pending-")}
                avatar={message.senderId !== user?.id ? activeChat?.otherParticipant?.avatar : undefined}
                isDelivered={message.senderId === user?.id && !message.id.startsWith("pending-") && activeChat?.otherParticipant?.id != null && useOnlineStore.getState().onlineUserIds.has(activeChat.otherParticipant.id)}
              />
            </div>
            );
          })}
          {typingUser && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span>{typingUser} is typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} className="h-0" />
        </div>
      </div>

      <div className="fixed left-0 right-0 bottom-14 sm:bottom-0 z-40 bg-background border-t border-border safe-area-bottom">
        <MessageInput
          onSendMessage={handleSendMessage}
          onSendImage={handleSendImage}
          onPendingVoice={handlePendingVoice}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          placeholder={`Message ${otherName}...`}
          uploading={imageUploading}
          onTyping={() => startTyping(`${user?.firstName} ${user?.lastName}`)}
          onStopTyping={() => stopTyping()}
        />
      </div>
    </>
  );
}
