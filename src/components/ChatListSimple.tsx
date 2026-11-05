"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, MessageSquare, Filter, Inbox, Check, CheckCheck, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useChats, type ChatData } from "@/hooks/useApi";
import { useAuthStore } from "@/store/authStore";
import { useOnlineStore } from "@/store/onlineStore";
import { useTypingStore } from "@/store/typingStore";
import { cn } from "@/lib/utils";
import { formatTimeShort } from "@/lib/formatTime";

function formatLastMessage(content?: string, type?: string): string {
  if (!content) return "No messages yet";
  if (type === "image") {
    if (content.match(/\.(mp4|webm|mov|avi|mkv)/i) || content.includes("/video/upload/")) {
      return "🎬 Video";
    }
    return "📷 Photo";
  }
  if (type === "voice") return "🎤 Voice message";
  if (type === "deal_update") return content;
  if (type === "file") return "📎 File";
  if (content.startsWith("http://") || content.startsWith("https://")) {
    return "📎 Attachment";
  }
  return content;
}

interface ChatListSimpleProps {
  userId: string;
  onChatSelect: (chat: ChatData) => void;
  onNewChat: () => void;
  onBack?: () => void;
}

export default function ChatListSimple({
  userId,
  onChatSelect,
  onNewChat,
  onBack,
}: ChatListSimpleProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const profileBase = user?.role === "shop_owner" ? "/shop/profile" : "/customer/profile";
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const { data, loading } = useChats(userId);
  const onlineUserIds = useOnlineStore((s) => s.onlineUserIds);
  const typingUsers = useTypingStore((s) => s.typingUsers);

  const allChats = data?.chats || [];
  const totalUnread = data?.totalUnread || 0;

  // Swipe-to-delete
  const [swipedChatId, setSwipedChatId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent, chatId: string) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dx < -50 && Math.abs(dx) > Math.abs(dy)) {
      setSwipedChatId(chatId);
    } else if (dx > 20) {
      setSwipedChatId(null);
    }
  }, []);

  const handleDeleteChat = async (chatId: string) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", chatId, userId }),
      });
      setSwipedChatId(null);
      window.location.reload();
    } catch (e) {
      console.error("Failed to delete chat:", e);
    } finally {
      setDeleting(false);
    }
  };

  const filteredChats = allChats
    .filter(
      (chat) =>
        chat.participants.some(
          (p) => p.name?.toLowerCase().includes(searchQuery.toLowerCase())
        ) ||
        chat.lastMessage?.content
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase())
    )
    .filter((chat) => !showUnreadOnly || (chat.unreadCount ?? 0) > 0);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">Messages</h2>
            {totalUnread > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-pink-500/10 text-pink-500 border-0">
                {totalUnread} unread
              </Badge>
            )}
          </div>
          <Button size="sm" onClick={onNewChat} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>

        {/* Search + Unread filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search chats..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-muted/50" />
          </div>
          <Button variant={showUnreadOnly ? "default" : "outline"} size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowUnreadOnly(!showUnreadOnly)}>
            <Inbox className={cn("h-4 w-4", showUnreadOnly ? "text-primary-foreground" : "")} />
          </Button>
        </div>

        {showUnreadOnly && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Filter className="h-3 w-3" />
            <span>Showing unread chats only</span>
            <button onClick={() => setShowUnreadOnly(false)} className="text-brand hover:underline ml-1">Clear</button>
          </div>
        )}
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto" onClick={() => setSwipedChatId(null)}>
        {loading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 border-b border-border">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2 w-40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {filteredChats.map((chat) => {
              const other = chat.otherParticipant;
              const unread = chat.unreadCount ?? 0;
              const hasUnread = unread > 0;
              const isSwiped = swipedChatId === chat.id;
              const typingUser = typingUsers.get(chat.id);

              return (
                <div key={chat.id} className="relative overflow-hidden border-b border-border">
                  {/* Delete button behind */}
                  {isSwiped && (
                    <div className="absolute inset-y-0 right-0 flex items-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                        disabled={deleting}
                        className="h-full w-16 bg-destructive flex items-center justify-center text-white"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  )}

                  {/* Chat row */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (!isSwiped) onChatSelect(chat); setSwipedChatId(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onChatSelect(chat); }}
                    onTouchStart={handleTouchStart}
                    onTouchMove={(e) => handleTouchMove(e, chat.id)}
                    className={cn(
                      "relative w-full p-3 hover:bg-muted/50 transition-all text-left cursor-pointer",
                      hasUnread && "bg-muted/30",
                      isSwiped && "-translate-x-16"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <a
                          href={`${profileBase}/${other?.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block"
                        >
                          <Avatar className="h-11 w-11">
                            <AvatarImage src={other?.avatar} alt={other?.name} />
                            <AvatarFallback className={cn("text-xs", hasUnread ? "bg-primary/10 text-brand font-bold" : "bg-muted")}>
                              {other?.name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                        </a>
                        {other?.id && onlineUserIds.has(other.id) ? (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full" />
                        ) : (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-muted-foreground/40 border-2 border-background rounded-full" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className={cn("text-sm truncate", hasUnread ? "font-bold" : "font-semibold")}>
                            {other?.name || "Unknown"}
                          </h3>
                          <span className={cn("text-[10px] shrink-0 ml-2", hasUnread ? "text-brand font-semibold" : "text-muted-foreground")}>
                            {chat.lastMessageTime ? formatTimeShort(chat.lastMessageTime) : ""}
                          </span>
                        </div>

                        {chat.type === "deal" && chat.dealInfo && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge variant="secondary" className="text-[9px] h-4 bg-primary/10 text-brand">
                              {chat.dealInfo.productName}
                            </Badge>
                            {(() => {
                              const statusColors: Record<string, string> = {
                                pending: "bg-amber-400/10 text-amber-400",
                                negotiating: "bg-blue-400/10 text-blue-400",
                                confirmed: "bg-emerald-400/10 text-emerald-400",
                                completed: "bg-emerald-500/10 text-emerald-500",
                                cancelled: "bg-red-400/10 text-red-400",
                              };
                              return (
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${statusColors[chat.dealInfo!.status] || "bg-muted text-muted-foreground"}`}>
                                  {chat.dealInfo!.status}
                                </span>
                              );
                            })()}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            {chat.lastMessage?.senderId === userId && chat.lastMessage && (
                              <span className="shrink-0">
                                {chat.lastMessage.isRead && (chat.lastMessage.readBy?.length ?? 0) > 0 ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-blue-400" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </span>
                            )}
                            {typingUser ? (
                              <p className="text-xs truncate text-emerald-500 font-medium">
                                typing...
                              </p>
                            ) : (
                              <p className={cn("text-xs truncate", hasUnread ? "text-foreground font-medium" : "text-muted-foreground")}>
                                {formatLastMessage(chat.lastMessage?.content, chat.lastMessage?.type)}
                              </p>
                            )}
                          </div>

                          {hasUnread && (
                            <span className="shrink-0 bg-pink-500 text-white text-[9px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                              {unread > 99 ? "99+" : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredChats.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm font-medium">
                  {showUnreadOnly ? "No unread chats" : "No chats found"}
                </p>
                <p className="text-xs">
                  {searchQuery ? "Try a different search" : showUnreadOnly ? "All caught up!" : "Start a new conversation"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
