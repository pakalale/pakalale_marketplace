"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Reply,
  Copy,
  Trash2,
  Pencil,
  Check,
  CheckCheck,
  Loader2,
  X,
} from "lucide-react";
import VoiceMessage from "./VoiceMessage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/chat";
import ImageViewerModal from "@/components/ImageViewerModal";

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "mkv"];
function isVideoUrl(url: string): boolean {
  try {
    const ext = url.split(".").pop()?.split("?")[0]?.toLowerCase();
    if (ext && VIDEO_EXTENSIONS.includes(ext)) return true;
    if (url.includes("/video/upload/")) return true;
    return false;
  } catch {
    return false;
  }
}

// ── Global singleton: only one message menu open at a time ──
let activeMenuId: string | null = null;
let setActiveMenuGlobal: ((id: string | null) => void) | null = null;

interface MessageBubbleProps {
  message: Message;
  currentUserId?: string;
  onReply?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  showAvatar?: boolean;
  isConsecutive?: boolean;
  isPending?: boolean;
  avatar?: string;
  isDelivered?: boolean;
}

export default function MessageBubble({
  message,
  currentUserId,
  onReply,
  onDelete,
  onEdit,
  showAvatar = false,
  isConsecutive = false,
  isPending = false,
  avatar,
  isDelivered = false,
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showSwipeReply, setShowSwipeReply] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Touch gesture refs
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSwipingRef = useRef(false);
  const hasMovedRef = useRef(false);

  const isOwn = message.senderId === currentUserId;
  const isTextMessage = message.type === "text" || message.type === "deal_update";
  const isMediaMessage = message.type === "image";

  const SWIPE_THRESHOLD = 60;
  const SWIPE_MAX = 120;

  // ── Global menu singleton ──
  useEffect(() => {
    setActiveMenuGlobal = (id: string | null) => {
      if (id !== message.id) {
        setShowMenu(false);
        setShowDeleteConfirm(false);
        setMenuPos(null);
      }
    };
    return () => {
      if (activeMenuId === message.id) {
        activeMenuId = null;
        setActiveMenuGlobal = null;
      }
    };
  }, [message.id]);

  const openMenu = useCallback((x: number, y: number) => {
    // Close any other open menu first
    setActiveMenuGlobal?.(null);
    activeMenuId = message.id;
    // Position menu BELOW the bubble, not at touch point
    const bubble = bubbleRef.current;
    if (bubble) {
      const rect = bubble.getBoundingClientRect();
      setMenuPos({ x: Math.min(x, window.innerWidth - 220), y: rect.bottom + 4 });
    } else {
      setMenuPos({ x: Math.min(x, window.innerWidth - 220), y: Math.min(y + 20, window.innerHeight - 120) });
    }
    setShowMenu(true);
    setShowDeleteConfirm(false);
    navigator.vibrate?.(30);
  }, [message.id]);

  const closeMenu = useCallback(() => {
    setShowMenu(false);
    setShowDeleteConfirm(false);
    setMenuPos(null);
    // Re-enable text selection
    if (bubbleRef.current) bubbleRef.current.style.userSelect = '';
    if (activeMenuId === message.id) {
      activeMenuId = null;
    }
  }, [message.id]);

  // ── Touch gestures ──
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      isSwipingRef.current = false;
      hasMovedRef.current = false;

      // Long press timer — prevent text selection
      longPressTimerRef.current = setTimeout(() => {
        if (!hasMovedRef.current) {
          // Disable text selection on the bubble
          if (bubbleRef.current) bubbleRef.current.style.userSelect = 'none';
          openMenu(touch.clientX, touch.clientY);
        }
      }, 500);
    },
    [openMenu]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;

      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        return;
      }

      if (Math.abs(dx) > 10) {
        hasMovedRef.current = true;
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }

      if (isOwn && dx > 0) return;
      if (!isOwn && dx < 0) return;

      if (Math.abs(dx) > 10) {
        isSwipingRef.current = true;
        const offset = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, dx));
        setSwipeOffset(offset);
        setShowSwipeReply(Math.abs(offset) > SWIPE_THRESHOLD);
      }
    },
    [isOwn]
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isSwipingRef.current && Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      onReply?.(message);
      navigator.vibrate?.(20);
    }

    setSwipeOffset(0);
    setShowSwipeReply(false);
    isSwipingRef.current = false;
    touchStartRef.current = null;
  }, [swipeOffset, message, onReply]);

  // ── Desktop: right-click to open menu ──
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      openMenu(e.clientX, e.clientY);
    },
    [openMenu]
  );

  // Close on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu, closeMenu]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit?.(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === "Escape") {
      setEditContent(message.content);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={cn("flex group", isOwn ? "justify-end" : "justify-start")}
      ref={bubbleRef}
    >
      <div
        className={cn(
          "flex items-end gap-2 max-w-[80%]",
          isOwn ? "flex-row-reverse" : ""
        )}
      >
        {showAvatar && !isOwn && (
          <Avatar className="h-7 w-7 shrink-0 mb-1">
            {avatar && <AvatarImage src={avatar} alt={message.senderName} />}
            <AvatarFallback className="bg-muted text-[10px]">
              {message.senderName.charAt(0)}
            </AvatarFallback>
          </Avatar>
        )}

        <div
          className="relative no-context-menu"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: swipeOffset === 0 ? "transform 0.2s ease" : "none",
          }}
        >
          {/* Swipe reply indicator */}
          {showSwipeReply && (
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 flex items-center gap-1 text-brand",
                isOwn ? "right-full mr-2" : "left-full ml-2"
              )}
            >
              <Reply className="h-4 w-4" />
            </div>
          )}

          {/* Reply quote */}
          {message.replyTo && (
            <div
              className={cn(
                "mb-1 p-2 rounded-lg border-l-4 text-xs cursor-pointer hover:opacity-80",
                isOwn
                  ? "bg-primary/10 border-primary"
                  : "bg-muted border-muted-foreground/30"
              )}
            >
              <p className="text-muted-foreground mb-0.5 font-medium">
                {message.replyTo.senderName}
              </p>
              <p className="truncate">{message.replyTo.content}</p>
            </div>
          )}

          <div
            className={cn(
              "rounded-2xl text-sm message-bubble-text select-none",
              isMediaMessage ? "bg-transparent p-1" : "px-3 py-2",
              !isMediaMessage && isOwn
                ? "bg-primary text-primary-foreground rounded-br-md"
                : !isMediaMessage && !isOwn
                ? "bg-muted text-foreground rounded-bl-md"
                : "",
              isConsecutive && !isMediaMessage && (isOwn ? "rounded-tr-md" : "rounded-tl-md"),
              isPending && "opacity-70"
            )}
          >
            {message.type === "voice" ? (
              <VoiceMessage audioSrc={message.content} isOwn={isOwn} />
            ) : isEditing ? (
              <div className="min-w-[180px]">
                <textarea
                  ref={editInputRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  rows={1}
                  className={cn(
                    "w-full bg-transparent border-none outline-none resize-none text-sm p-0",
                    isOwn
                      ? "text-primary-foreground placeholder:text-primary-foreground/50"
                      : "text-foreground placeholder:text-muted-foreground"
                  )}
                />
                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    onClick={() => {
                      setEditContent(message.content);
                      setIsEditing(false);
                    }}
                    className="text-[10px] opacity-60 hover:opacity-100"
                  >
                    Cancel
                  </button>
                  <span className="text-[10px] opacity-30">·</span>
                  <button
                    onClick={handleSaveEdit}
                    className="text-[10px] opacity-60 hover:opacity-100 font-medium"
                  >
                    Save
                  </button>
                  <span className="text-[10px] opacity-30 ml-0.5">enter ↵</span>
                </div>
              </div>
            ) : isMediaMessage && (message.content.includes("cloudinary.com") || message.content.startsWith("http")) ? (
              <div 
                className="max-w-[280px] cursor-pointer" 
                onClick={() => setViewerOpen(true)}
              >
                {isVideoUrl(message.content) ? (
                  <video 
                    src={message.content} 
                    className="rounded-lg max-w-full" 
                    autoPlay loop muted playsInline preload="metadata" 
                  />
                ) : (
                  <img 
                    src={message.content} 
                    alt="Shared media" 
                    className="rounded-lg max-w-full" 
                    loading="lazy" 
                  />
                )}
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}

            <div
              className={cn(
                "flex items-center justify-end gap-1 mt-0.5",
                isMediaMessage ? "text-muted-foreground mr-1" : isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
              )}
            >
              {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              <span className="text-[10px]">{formatTime(message.timestamp)}</span>
              {isOwn && !isPending && (
                message.isRead && message.readBy.length > 0 ? (
                  <CheckCheck className="h-3 w-3 text-blue-400" />
                ) : isDelivered ? (
                  <CheckCheck className="h-3 w-3" />
                ) : (
                  <Check className="h-3 w-3" />
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Context Menu (portal-like fixed positioning) ── */}
      {showMenu && menuPos && (
        <div
          ref={menuRef}
          className="fixed z-[100]"
          style={{
            left: `${Math.min(menuPos.x, window.innerWidth - 200)}px`,
            top: `${Math.min(menuPos.y, window.innerHeight - 200)}px`,
          }}
        >
          <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Icon row */}
            <div className="flex items-center gap-0.5 p-1.5 border-b border-border">
              <button
                onClick={() => {
                  onReply?.(message);
                  closeMenu();
                }}
                className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-muted transition-colors"
                title="Reply"
              >
                <Reply className="h-4 w-4 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">Reply</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(message.content);
                  closeMenu();
                }}
                className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-muted transition-colors"
                title="Copy"
              >
                <Copy className="h-4 w-4 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground">Copy</span>
              </button>
              {isOwn && isTextMessage && (
                <button
                  onClick={() => {
                    setEditContent(message.content);
                    setIsEditing(true);
                    closeMenu();
                  }}
                  className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-muted transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground">Edit</span>
                </button>
              )}
              {isOwn && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="text-[9px] text-destructive">Delete</span>
                </button>
              )}
              <button
                onClick={closeMenu}
                className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-muted transition-colors ml-auto"
                title="Close"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
              <div className="p-2.5 bg-destructive/5">
                <p className="text-[10px] text-muted-foreground mb-1.5 text-center">
                  Delete this message?
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-1.5 text-[10px] text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onDelete?.(message.id);
                      closeMenu();
                    }}
                    className="flex-1 py-1.5 text-[10px] text-white bg-destructive rounded-lg hover:bg-destructive/90 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isMediaMessage && (
        <ImageViewerModal
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          images={[message.content]}
          alt="Shared media"
        />
      )}
    </div>
  );
}
