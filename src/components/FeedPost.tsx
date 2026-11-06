"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageSquare, Share, ShoppingBag, MapPin, Clock, CheckCircle, Phone, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import ContactModal from "./ContactModal";
import DealModal from "./DealModal";
import ImageViewerModal from "./ImageViewerModal";
import VerifiedBadge from "./VerifiedBadge";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/formatTime";
import { type FeedPostData } from "@/hooks/useApi";

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

interface FeedPostProps {
  post: FeedPostData;
  onLike: (postId: string) => void;
  onComment: (postId: string, authorName: string, content: string) => void;
  onShare: (postId: string) => void;
  onMakeDeal: (productName: string, shopOwnerId: string, dealData: {
    quantity: number;
    suggestedPrice: number;
    message: string;
    productId?: string;
  }) => void;
  onContactShop: (shopOwnerId: string) => void;
  currentUserId?: string;
  currentUserName?: string;
  currentUserRole?: "customer" | "shop_owner";
}

export default function FeedPost({
  post,
  onLike,
  onComment,
  onShare,
  onMakeDeal,
  onContactShop,
  currentUserId,
  currentUserName,
  currentUserRole,
}: FeedPostProps) {
  const router = useRouter();
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [dealSending, setDealSending] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  // Lazy-mount flags: only render modals after first open
  const [contactMounted, setContactMounted] = useState(false);
  const [dealMounted, setDealMounted] = useState(false);

  // Determine profile path based on user role
  const profileBase = currentUserRole === "shop_owner" ? "/shop/profile" : "/customer/profile";
  const [viewerMounted, setViewerMounted] = useState(false);

  // Video auto-play when in viewport
  const videoRef = useRef<HTMLVideoElement>(null);
  const postRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const isLiked = currentUserId ? (post.likedBy || []).includes(currentUserId) : false;
  const allComments = post.comments || [];

  const handleLike = () => {
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 400);
    onLike(post.id);
  };

  const handlePostComment = () => {
    if (!newComment.trim()) return;
    // Guests can type; the parent handles the sign-in prompt.
    if (!currentUserId) {
      onComment(post.id, "", newComment.trim());
      return;
    }
    if (!currentUserName) return;
    onComment(post.id, currentUserName, newComment.trim());
    setNewComment("");
  };

  const handleDealSend = async (data: { quantity: number; suggestedPrice: number; message: string }) => {
    setDealSending(true);
    try {
      await onMakeDeal(post.product?.name || post.content.slice(0, 50), post.author!.id, { ...data, productId: post.product?.id });
      setShowDealModal(false);
    } finally {
      setDealSending(false);
    }
  };



  return (
    <Card className="bg-card border-border overflow-hidden">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border">
        <div className="flex items-start gap-2.5">
          <div
            className="relative shrink-0 cursor-pointer"
            onClick={() => {
              if (post.author?.id) {
                router.push(`${profileBase}/${post.author.id}`);
              }
            }}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.author?.avatar} alt={post.author?.name} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-amber-golden text-primary-foreground text-sm">
                {post.author?.name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3
                className="font-semibold text-sm truncate cursor-pointer hover:underline"
                onClick={() => {
                  if (post.author?.id) {
                    router.push(`${profileBase}/${post.author.id}`);
                  }
                }}
              >
                {post.author?.name || "Unknown"}
              </h3>
              {post.author?.role === "shop_owner" && (
                <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-brand">Shop</Badge>
              )}
              {post.author?.isShopVerified && (
                <VerifiedBadge size="sm" />
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{formatTimeAgo(post.createdAt)}</span>
              {post.locationId && (
                <>
                  <span className="hidden sm:inline">·</span>
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{post.locationId}</span>
                </>
              )}
            </div>
          </div>

          {/* Promo badge top-right */}
          {post.isPromotion && (
            <div className="flex items-center gap-1 shrink-0 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <span className="text-sm animate-fire animate-fire-glow">🔥</span>
              <span className="text-[10px] font-semibold text-emerald-500">Promo</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {post.product && (
          <div className="mt-3 bg-muted/50 rounded-lg p-3 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center shrink-0">
                <ShoppingBag className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{post.product.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-brand">K{post.product.price.toLocaleString()}</span>
                  {post.product.originalPrice && (
                    <span className="text-xs text-muted-foreground line-through">K{post.product.originalPrice.toLocaleString()}</span>
                  )}
                  {post.product.discount && (
                    <Badge variant="secondary" className="text-[10px] bg-rose-500/10 text-rose-400">
                      -{post.product.discount}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {post.images && post.images.length > 0 && (
          <div className="mt-3">
            {post.images.length === 1 ? (
              <div
                className="w-full bg-muted rounded-lg overflow-hidden cursor-pointer"
                onClick={() => { setViewerMounted(true); setViewerIndex(0); setViewerOpen(true); }}
              >
                {isVideoUrl(post.images[0]) ? (
                  <video ref={videoRef} src={post.images[0]} className="w-full max-h-80 object-cover" controls playsInline preload="metadata" />
                ) : (
                  <img src={post.images[0]} alt="Post image" className="w-full object-cover max-h-80" loading="lazy" />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-0.5 rounded-lg overflow-hidden">
                {post.images.slice(0, 2).map((img, i) => (
                  <div
                    key={i}
                    className="relative bg-muted cursor-pointer aspect-square"
                    onClick={() => { setViewerMounted(true); setViewerIndex(i); setViewerOpen(true); }}
                  >
                    {isVideoUrl(img) ? (
                      <video src={img} className="w-full h-full object-cover" muted preload="metadata" />
                    ) : (
                      <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                    )}
                    {i === 1 && post.images!.length > 2 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-lg font-bold">+{post.images!.length - 2}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      {(post.likes > 0 || allComments.length > 0 || post.shares > 0) && (
        <div className="px-4 py-1 border-t border-border">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {post.likes > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3 text-blue-400" /> {post.likes}
              </span>
            )}
            {allComments.length > 0 && <span>{allComments.length} comments</span>}
            {post.shares > 0 && <span>{post.shares} shares</span>}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 sm:px-4 py-1.5 border-t border-border">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-[10px] sm:text-[11px] transition-all px-1.5 sm:px-2",
              isLiked ? "text-rose-400 hover:text-rose-500" : "text-muted-foreground"
            )}
            onClick={handleLike}
          >
            <Heart
              className={cn(
                "h-3.5 w-3.5 mr-0.5 transition-transform",
                isLiked && "fill-current",
                likeAnimating && "animate-like-pop"
              )}
            />
            Like
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] sm:text-[11px] text-muted-foreground px-1.5 sm:px-2"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-0.5" />
            Comment
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] sm:text-[11px] text-muted-foreground px-1.5 sm:px-2"
            onClick={() => onShare(post.id)}
          >
            <Share className="h-3.5 w-3.5 mr-0.5" />
            Share
          </Button>
          {/* Contact: hidden for self-posts */}
          {post.author?.id !== currentUserId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] sm:text-[11px] text-muted-foreground px-1.5 sm:px-2"
              onClick={() => { setContactMounted(true); setShowContactModal(true); }}
            >
              <Phone className="h-3.5 w-3.5 mr-0.5" />
              Contact
            </Button>
          )}
          {/* Deal: only customer → shop_owner, never self, never shop-to-shop */}
          {post.author?.role === "shop_owner" && currentUserRole === "customer" && post.author?.id !== currentUserId && (
            <Button
              size="sm"
              className="h-7 text-[10px] sm:text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 px-1.5 sm:px-2"
              onClick={() => { setDealMounted(true); setShowDealModal(true); }}
            >
              <ShoppingBag className="h-3.5 w-3.5 mr-0.5" />
              Deal
            </Button>
          )}
        </div>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-border p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handlePostComment();
                }
              }}
              className="flex-1 h-8 text-sm"
            />
            <Button
              size="sm"
              className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!newComment.trim()}
              onClick={handlePostComment}
            >
              Post
            </Button>
          </div>

          <div className="space-y-2">
            {allComments.map((comment, i) => (
              <div key={i} className="flex items-start gap-2 animate-slide-in">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                    {comment.authorName?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="bg-muted rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium">{comment.authorName || "User"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {comment.createdAt ? formatTimeAgo(comment.createdAt) : ""}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed break-words">{comment.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {contactMounted && (
        <ContactModal
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
          contact={{
            id: post.author?.id || "",
            name: post.author?.name || "Unknown",
            role: post.author?.role || "customer",
          }}
          onMessageClick={() => { setShowContactModal(false); onContactShop(post.author?.id || ""); }}
          onDealClick={() => { setShowContactModal(false); setShowDealModal(true); setDealMounted(true); }}
        />
      )}

      {/* Deal Modal */}
      {dealMounted && (
        <DealModal
          isOpen={showDealModal}
          onClose={() => setShowDealModal(false)}
          productName={post.product?.name || post.content.slice(0, 50)}
          productPrice={post.product?.price}
          shopName={post.author?.name}
          onSendDeal={handleDealSend}
          sending={dealSending}
        />
      )}

      {/* Image Viewer */}
      {viewerMounted && post.images && post.images.length > 0 && (
        <ImageViewerModal
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          images={post.images}
          initialIndex={viewerIndex}
          alt="Post image"
        />
      )}
    </Card>
  );
}
