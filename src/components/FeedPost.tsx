"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageSquare, Share, ShoppingBag, ShoppingCart, MapPin, Clock, CheckCircle, Phone, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ImageWithFallback from "@/components/ImageWithFallback";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import ContactModal from "./ContactModal";
import DealModal from "./DealModal";
import ImageViewerModal from "./ImageViewerModal";
import VerifiedBadge from "./VerifiedBadge";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/formatTime";
import { type FeedPostData, type ProductData } from "@/hooks/useApi";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";

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
  const addItem = useCartStore((state) => state.addItem);
  const saved = useWishlistStore((state) =>
    state.items.some((item) => item.id === (post.product?.id || post.id))
  );
  const toggleSaved = useWishlistStore((state) => state.toggle);
  const [showComments, setShowComments] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
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
  const hasPromotionPricing = post.isPromotion || post.postType === "promotion";

  const handleLike = () => {
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 400);
    onLike(post.id);
  };

  const handleToggleLikers = () => {
    setShowLikers(!showLikers);
  };

  const handlePostComment = () => {
    if (!newComment.trim()) return;
    // Guests can type; the sign-in prompt is handled by the parent.
    if (!currentUserId) {
      onComment(post.id, "", newComment.trim());
      return;
    }
    if (!currentUserName) return;
    onComment(post.id, currentUserName, newComment.trim());
    setNewComment("");
  };

  // Feed posts carry only the basics of a product, so this is the shape both
  // the cart and saved items work with.
  const shopId = post.product?.shopId || post.author?.shopId || post.author?.id || "";
  const saveableProduct: ProductData | null = post.product
    ? {
        id: post.product.id || post.id,
        name: post.product.name,
        description: "",
        price: post.product.price,
        originalPrice: hasPromotionPricing ? post.product.originalPrice : undefined,
        discount: hasPromotionPricing ? post.product.discount : undefined,
        images: post.product.image ? [post.product.image] : [],
        category: "",
        stock: 99,
        isAvailable: true,
        shopId,
        views: 0,
        rating: 0,
        reviews: 0,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      }
    : null;

  const handleAddToCart = () => {
    if (!post.product) return;
    if (!shopId) {
      toast.error("This product is not available to order right now.");
      return;
    }
    addItem({
      productId: post.product.id || post.id,
      name: post.product.name,
      image: post.product.image || undefined,
      price: post.product.price,
      originalPrice: hasPromotionPricing ? post.product.originalPrice : undefined,
      // The feed does not track stock; checkout re-checks it with the server.
      stock: 99,
      shopId,
      shopName: post.author?.name,
    });
    toast.success(`${post.product.name} added to cart`);
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
          {(post.isPromotion || post.postType === "product_arrival" || post.postType === "shop_announcement") && (
            <div className="flex items-center gap-1 shrink-0 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <span className="text-sm">{post.postType === "product_arrival" ? "✦" : post.postType === "shop_announcement" ? "★" : "🔥"}</span>
              <span className="text-[10px] font-semibold text-emerald-500">{post.postType === "product_arrival" ? "New arrival" : post.postType === "shop_announcement" ? "Featured" : "Price drop"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {post.product && (
          <div className="mt-3 bg-muted/50 rounded-lg p-3 border border-border">
            {post.postType && post.postType !== "general" && (
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-brand">
                {post.postType === "product_arrival" ? "Just added to inventory" : post.postType === "shop_announcement" ? "Shop spotlight" : post.postType === "promotion" ? "Limited-time price" : ""}
              </p>
            )}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-muted rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                {post.product.image ? (
                  <img src={post.product.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{post.product.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-brand">K{post.product.price.toLocaleString()}</span>
                  {hasPromotionPricing && post.product.originalPrice && (
                    <span className="text-xs text-muted-foreground line-through">K{post.product.originalPrice.toLocaleString()}</span>
                  )}
                  {hasPromotionPricing && post.product.discount && (
                    <Badge variant="secondary" className="text-[10px] bg-rose-500/10 text-rose-400">
                      -{post.product.discount}%
                    </Badge>
                  )}
                </div>
              </div>
              {saveableProduct && (
                <button
                  type="button"
                  aria-pressed={saved}
                  aria-label={saved ? `Remove ${post.product.name} from saved items` : `Save ${post.product.name}`}
                  onClick={() => toggleSaved(saveableProduct)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-sm transition-colors hover:text-rose-500"
                >
                  <Heart className={cn("h-4 w-4", saved && "fill-rose-500 text-rose-500")} />
                </button>
              )}
            </div>
          </div>
        )}

        {post.images && post.images.length > 0 && (
          <div className="mt-3">
            {post.images.length === 1 ? (
              <div
                className="relative w-full aspect-[4/3] bg-muted rounded-lg overflow-hidden cursor-pointer"
                onClick={() => { setViewerMounted(true); setViewerIndex(0); setViewerOpen(true); }}
              >
                {isVideoUrl(post.images[0]) ? (
                  <video ref={videoRef} src={post.images[0]} className="absolute inset-0 w-full h-full object-cover" controls playsInline preload="metadata" />
                ) : (
                  <ImageWithFallback src={post.images[0]} alt="Post image" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
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
                      <ImageWithFallback src={img} alt="Post image" className="w-full h-full object-cover" loading="lazy" />
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
        <div className="px-4 py-1 border-t border-border justify-end">
          <div className="flex items-center gap-3 text-[11px] font-medium text-brand">
            {post.likes > 0 && (
              <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>                <Heart className="h-3 w-3 text-brand" /> {post.likes}
              </span>
            )}
            {allComments.length > 0 && <span onClick={() => setShowCommentsModal(!showCommentsModal)} className="cursor-pointer hover:underline">{allComments.length} comments</span>}
            {post.shares > 0 && <span>{post.shares} shares</span>}
          </div>
        </div>
      )}

      {showCommentsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 p-4 flex flex-col items-center gap-4">
          <h3 className="text-lg font-semibold">Comments</h3>
          <div className="w-full max-w-md space-y-3">
            <div className="border-b border-border pb-3">
              {allComments.map((comment, i) => (
                <div key={i} className="flex items-start gap-2">
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

            <div className="pt-3 border-t border-border">
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
          </div>
          <button className="mt-2 text-sm text-primary hover:underline" onClick={() => setShowCommentsModal(false)}>Close</button>
        </div>
      )}

      {showLikers && post.likes > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 p-4 flex flex-col items-center gap-4" onClick={() => setShowLikers(false)}>
          <h3 className="text-lg font-semibold">Who liked this</h3>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            {(post.likedBy || []).slice(0, 9).map((likerId) => (
              <div key={likerId} className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{likerId.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <span className="text-xs">{likerId}</span>
              </div>
            ))}
          </div>
          <button className="mt-4 text-sm text-primary hover:underline" onClick={() => setShowLikers(false)}>Close</button>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 sm:px-4 py-1.5 border-t border-border">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-[10px] sm:text-[11px] font-medium transition-all px-1.5 sm:px-2",
              isLiked
                ? "text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                : "text-brand hover:bg-brand-soft hover:text-brand"
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
            className="h-7 text-[10px] sm:text-[11px] font-medium text-brand hover:bg-brand-soft hover:text-brand px-1.5 sm:px-2"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-0.5" />
            Comment
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] sm:text-[11px] font-medium text-brand hover:bg-brand-soft hover:text-brand px-1.5 sm:px-2"
            onClick={() => onShare(post.id)}
          >
            <Share className="h-3.5 w-3.5 mr-0.5" />
            Share
          </Button>
          {/* Products on a shop post go straight to the cart; checkout asks
              visitors to sign up only when they are ready to order. */}
          {post.product && post.author?.role === "shop_owner" && post.author?.id !== currentUserId && (
            <Button
              size="sm"
              className="h-7 text-[10px] sm:text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 px-1.5 sm:px-2"
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
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

      {showCommentsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 p-4 flex flex-col items-center gap-4">
          <h3 className="text-lg font-semibold">Comments</h3>
          <div className="w-full max-w-md space-y-3">
            <div className="border-b border-border pb-3">
              {allComments.map((comment, i) => (
                <div key={i} className="flex items-start gap-2">
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
              ))}</div>

            <div className="pt-3 border-t border-border">
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
          </div>
          <button className="mt-2 text-sm text-primary hover:underline" onClick={() => setShowCommentsModal(false)}>Close</button>
        </div>
      )}      {contactMounted && (
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
