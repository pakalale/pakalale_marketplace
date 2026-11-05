"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  PhoneCall,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Clock,
  Handshake,
  Tag,
  Send,
  Loader2,
} from "lucide-react";
import MessageBubble from "@/components/MessageBubble";
import MessageInput from "@/components/MessageInput";
import ChatListSimple from "@/components/ChatListSimple";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/authStore";
import { useDealStore } from "@/store/dealStore";
import {
  useChatMessages,
  sendMessage,
  updateDealStatus,
  proposePrice,
  type ChatData,
  type MessageData,
} from "@/hooks/useApi";
import { useOnlineStore } from "@/store/onlineStore";
import { formatLastSeen } from "@/lib/formatTime";
import { useSocket, type SocketMessage } from "@/hooks/useSocket";

const dealStatusConfig: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    icon: Clock,
  },
  negotiating: {
    label: "Negotiating",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    icon: Handshake,
  },
  confirmed: {
    label: "Confirmed",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: CheckCircle2,
  },
  completed: {
    label: "Completed",
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-400 bg-red-400/10 border-red-400/20",
    icon: XCircle,
  },
};

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
  const [counterPriceInput, setCounterPriceInput] = useState("");
  const [proposing, setProposing] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    isUserScrolledUp.current = !isAtBottom;
  }, []);

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
      sendSocketMessage({
        chatId: activeChat.id,
        senderId: user.id,
        senderName,
        senderRole: "shop_owner",
        content,
        type: type || "text",
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
    setCounterPriceInput("");
    hasScrolledOnOpen.current = false;
    isUserScrolledUp.current = false;
  };

  // ── Deal actions ──
  const handleDealAction = async (
    status: "pending" | "negotiating" | "confirmed" | "completed" | "cancelled"
  ) => {
    if (!activeChat || !user) return;
    try {
      await updateDealStatus(activeChat.id, status, user.id);
      setActiveChat((prev) =>
        prev
          ? {
              ...prev,
              dealInfo: prev.dealInfo
                ? { ...prev.dealInfo, status }
                : undefined,
            }
          : prev
      );
      refetchMessages();

      // Optimistically update deal count when status becomes terminal
      if (status === "completed" || status === "cancelled") {
        useDealStore.getState().decrementDealCount();
      }

      // Notify other participants via socket
      const participantIds = activeChat.participants?.map((p) => p.id) || [];
      window.dispatchEvent(
        new CustomEvent("deal-status-changed", {
          detail: { chatId: activeChat.id, dealStatus: status, participantIds },
        })
      );
    } catch (e) {
      console.error("Failed to update deal status:", e);
    }
  };

  const handleProposePrice = async () => {
    if (!activeChat || !user || !counterPriceInput) return;
    const price = parseFloat(counterPriceInput);
    if (isNaN(price) || price <= 0) return;

    setProposing(true);
    try {
      const currentPrice =
        activeChat.dealInfo?.counterPrice ||
        activeChat.dealInfo?.initialPrice;
      await proposePrice(
        activeChat.id,
        user.id,
        "shop_owner",
        price,
        currentPrice
      );
      setActiveChat((prev) =>
        prev?.dealInfo
          ? {
              ...prev,
              dealInfo: {
                ...prev.dealInfo,
                counterPrice: price,
                lastOfferBy: user.id,
                status:
                  prev.dealInfo.status === "pending"
                    ? "negotiating"
                    : prev.dealInfo.status,
              },
            }
          : prev
      );
      setCounterPriceInput("");
      refetchMessages();
    } catch (e) {
      console.error("Failed to propose price:", e);
    } finally {
      setProposing(false);
    }
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

  return (
    <>
      <div className="h-[100dvh] bg-background flex flex-col">
        <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border shrink-0">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={activeChat?.otherParticipant?.avatar} alt={otherName} />
                  <AvatarFallback className="bg-primary/10 text-brand text-xs">{otherName?.charAt(0) || "?"}</AvatarFallback>
                </Avatar>
                {activeChat?.otherParticipant?.id && useOnlineStore.getState().onlineUserIds.has(activeChat.otherParticipant.id) && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-background rounded-full" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold truncate">{otherName}</h1>
                <p className="text-[10px] text-muted-foreground">
                  {typingUser
                    ? <span className="text-emerald-500">typing...</span>
                    : activeChat?.otherParticipant?.id && useOnlineStore.getState().onlineUserIds.has(activeChat.otherParticipant.id)
                      ? <span className="text-emerald-500">Online</span>
                      : activeChat?.dealInfo
                        ? `Deal: ${activeChat.dealInfo.productName}`
                        : "Customer"}
                </p>
              </div>
            </div>
            {activeChat?.otherParticipant?.id ? (
              <a
                href={`/shop/profile/${activeChat.otherParticipant?.id}`}
                className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors"
              >
                <PhoneCall className="h-4 w-4" />
              </a>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled>
                <PhoneCall className="h-4 w-4" />
              </Button>)}
          </div>
        </header>

        {/* ── Pinned Deal Banner ── */}
        {activeChat?.type === "deal" && activeChat?.dealInfo && (
          <div className="sticky top-14 z-50 border-b border-border bg-background/90 backdrop-blur-lg">
            <div className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
                    <ShoppingBag className="h-3.5 w-3.5 text-brand" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {activeChat.dealInfo.productName}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {activeChat.dealInfo.initialPrice && (
                        <span className="text-[10px] text-muted-foreground">
                          Offer: K
                          {activeChat.dealInfo.initialPrice.toLocaleString()}
                        </span>
                      )}
                      {activeChat.dealInfo.counterPrice &&
                        activeChat.dealInfo.counterPrice !==
                          activeChat.dealInfo.initialPrice && (
                          <>
                            <span className="text-[10px] text-muted-foreground">
                              →
                            </span>
                            <span className="text-[10px] text-brand font-bold">
                              K
                              {activeChat.dealInfo.counterPrice.toLocaleString()}
                            </span>
                          </>
                        )}
                    </div>
                  </div>
                </div>
                {(() => {
                  const cfg =
                    dealStatusConfig[activeChat.dealInfo.status] ||
                    dealStatusConfig.pending;
                  const StatusIcon = cfg.icon;
                  return (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>

              {/* ── Deal action buttons — shop owner only decides ── */}
              {(() => {
                const dealStatus = activeChat.dealInfo.status;

                // ── PENDING: Shop owner reviews customer's offer → Accept / Negotiate / Decline ──
                if (dealStatus === "pending") {
                  const offerPrice = activeChat.dealInfo?.counterPrice || activeChat.dealInfo?.initialPrice;
                  return (
                    <div className="mt-2 space-y-2">
                      {offerPrice && (
                        <div className="flex items-center gap-1.5">
                          <Tag className="h-3 w-3 text-brand" />
                          <span className="text-[10px] text-muted-foreground">Customer&apos;s offer:</span>
                          <span className="text-[10px] font-bold text-brand">K{offerPrice.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-[10px] flex-1 bg-emerald-500 text-white hover:bg-emerald-600" onClick={() => handleDealAction("confirmed" as const)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1" onClick={() => handleDealAction("negotiating" as const)}>
                          <Handshake className="h-3 w-3 mr-1" /> Negotiate
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleDealAction("cancelled" as const)}>
                          <XCircle className="h-3 w-3 mr-1" /> Decline
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Accept the price, negotiate with a counter-offer, or decline</p>
                    </div>
                  );
                }

                // ── NEGOTIATING: Back-and-forth until shop owner accepts or declines ──
                if (dealStatus === "negotiating") {
                  const lastOfferPrice = activeChat.dealInfo?.counterPrice || activeChat.dealInfo?.initialPrice;
                  const isMyOffer = activeChat.dealInfo?.lastOfferBy === user?.id;
                  return (
                    <div className="mt-2 space-y-2">
                      {lastOfferPrice && (
                        <div className="flex items-center gap-1.5">
                          <Tag className="h-3 w-3 text-brand" />
                          <span className="text-[10px] text-muted-foreground">
                            {isMyOffer ? "Your counter:" : "Customer&apos;s counter:"}
                          </span>
                          <span className="text-[10px] font-bold text-brand">K{lastOfferPrice.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">K</span>
                          <input
                            type="number"
                            value={counterPriceInput}
                            onChange={(e) => setCounterPriceInput(e.target.value)}
                            placeholder={lastOfferPrice ? `Counter (current: K${lastOfferPrice.toLocaleString()})` : "Your price"}
                            className="w-full pl-5 pr-2 py-1.5 bg-muted border border-border rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
                            onKeyDown={(e) => e.key === "Enter" && handleProposePrice()}
                          />
                        </div>
                        <Button size="sm" className="h-7 px-2 bg-primary text-primary-foreground" onClick={handleProposePrice} disabled={proposing || !counterPriceInput}>
                          {proposing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-6 text-[9px] px-2 bg-emerald-500 text-white hover:bg-emerald-600 flex-1" onClick={() => handleDealAction("confirmed" as const)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Accept K{lastOfferPrice?.toLocaleString()}
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-destructive border-destructive/30 flex-1" onClick={() => handleDealAction("cancelled" as const)}>
                          <XCircle className="h-3 w-3 mr-1" /> Decline
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Accept, counter with a different price, or decline</p>
                    </div>
                  );
                }

                // ── CONFIRMED: Deal agreed, show agreed price ──
                if (dealStatus === "confirmed") {
                  const agreedPrice = activeChat.dealInfo?.counterPrice || activeChat.dealInfo?.finalPrice ||
                    activeChat.dealInfo?.initialPrice;
                  return (
                    <div className="mt-2 space-y-2">
                      {agreedPrice && (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          <span className="text-[10px] text-emerald-400 font-semibold">
                            Agreed price: K{agreedPrice.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-[10px] flex-1 bg-primary text-primary-foreground"
                          onClick={() =>
                            handleDealAction("completed" as const)
                          }
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Mark Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() =>
                            handleDealAction("cancelled" as const)
                          }
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
            </div>
          </div>
        )}

        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto flex flex-col p-3 pb-[60px]"
          onScroll={handleScroll}
        >
          <div className="flex-1" />
          {allMessages.map((message, idx) => (
            <div key={message.id} className="mb-3">
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
          ))}
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
