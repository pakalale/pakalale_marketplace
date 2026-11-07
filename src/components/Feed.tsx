"use client";

import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Image, MapPin, Tag, TrendingUp, Star, Loader2, X, Search, Zap, Package, Megaphone, Sparkles, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import FeedPost from "./FeedPost";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useInfiniteFeed, useShops, createFeedPost, createChat, type FeedPostData, type ShopData } from "@/hooks/useApi";
import { useUpload } from "@/hooks/useUpload";
import UploadProgressBar from "@/components/UploadProgressBar";

type FilterType = "all" | "promotions" | "nearby";

interface FeedProps {
  authorId?: string;
  afterComposer?: ReactNode;
}

export default function Feed({ authorId, afterComposer }: FeedProps) {
  const { user } = useAuthStore();
  const router = useRouter();
  const isGuest = !user;
  const [newPostContent, setNewPostContent] = useState("");
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [posting, setPosting] = useState(false);

  // Create post extras
  const [postMedia, setPostMedia] = useState<{ url: string; type: "image" | "video" }[]>([]);
  const [postLocation, setPostLocation] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [createPostMounted, setCreatePostMounted] = useState(false);
  const [locationPickerMounted, setLocationPickerMounted] = useState(false);
  const [tagPickerMounted, setTagPickerMounted] = useState(false);
  const [taggedShops, setTaggedShops] = useState<ShopData[]>([]);
  const [tagSearch, setTagSearch] = useState("");

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Infinite scroll sentinel
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Use the infinite feed hook
  const {
    posts: feedPosts,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    toggleLike,
    addComment,
    prependPost,
  } = useInfiniteFeed({ filter, authorId });

  const { data: shopsData } = useShops();
  const allShops = shopsData?.shops || [];

  // ── IntersectionObserver for infinite scroll ──
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore();
        }
      },
      { rootMargin: "200px" } // Start loading 200px before reaching bottom
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMore]);

  // ── Pull to refresh (mobile) ──
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === 0) return;
    const distance = e.touches[0].clientY - touchStartY.current;
    if (distance > 0 && window.scrollY <= 0) {
      setPullDistance(Math.min(distance, 120));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 60) {
      setIsRefreshing(true);
      refresh();
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 1500);
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  }, [pullDistance, refresh]);

  // ── Public visitors can read the feed, but interacting needs an account ──
  const requireAuth = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("redirectAfterLogin", window.location.pathname);
    }
    router.push("/login");
  }, [router]);

  // ── Like ──
  const handleLike = useCallback((postId: string) => {
    if (!user?.id) { requireAuth(); return; }
    toggleLike(postId, user.id);
  }, [user?.id, toggleLike, requireAuth]);

  // ── Comment ──
  const handleComment = useCallback((postId: string, authorName: string, content: string) => {
    if (!user?.id) { requireAuth(); return; }
    addComment(postId, user.id, authorName, content);
  }, [user?.id, addComment, requireAuth]);

  const handleShare = (postId: string) => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/post/${postId}` : "";
    if (navigator.share) { navigator.share({ title: "Pakalale Post", url }).catch(() => {}); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(url); }
    // Track the share
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "feed_share", targetId: postId }),
    }).catch(() => {});
  };

  // ── Location picker ──
  const handleLocationPick = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPostLocation(`Lusaka (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
          setShowLocationPicker(false);
        },
        () => {
          setPostLocation("Lusaka, Zambia");
          setShowLocationPicker(false);
        }
      );
    } else {
      setPostLocation("Lusaka, Zambia");
      setShowLocationPicker(false);
    }
  };

  // ── Media picker (images + videos, uploads to Cloudinary) ──
  const { upload: uploadMedia, uploading: mediaUploading, progress: uploadProgress, error: uploadError } = useUpload({ folder: "pakalale/feed" });

  const handleMediaPick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const isVideo = file.type.startsWith("video/");
      const result = await uploadMedia(file);
      if (result?.url) {
        // Store video URLs with a prefix marker so we can render them differently
        setPostMedia((prev) => [...prev, { url: result.url, type: isVideo ? "video" : "image" }]);
      }
    };
    input.click();
  };

  const handleRemoveMedia = (index: number) => {
    setPostMedia((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Tag shops ──
  const filteredShops = allShops.filter((s) =>
    s.name.toLowerCase().includes(tagSearch.toLowerCase()) && !taggedShops.some((t) => t.id === s.id)
  );

  // ── Create Post ──
  const handleCreatePost = async () => {
    if (!newPostContent.trim() || !user) return;
    setPosting(true);
    try {
      const tagNames = taggedShops.map((s) => `@${s.name}`).join(" ");
      const locationText = postLocation ? `\n📍 ${postLocation}` : "";
      const fullContent = `${newPostContent}${tagNames ? "\n" + tagNames : ""}${locationText}`;

      const result = await createFeedPost({
        content: fullContent,
        authorId: user.id,
        locationId: postLocation || user.location,
        images: postMedia.map((m) => m.url),
      });
      if (result?.post) {
        prependPost({
          ...result.post,
          author: { id: user.id, name: `${user.firstName} ${user.lastName}`, avatar: user.avatar, role: user.role as "customer" | "shop_owner" },
          likes: 0, likedBy: [], comments: [], commentsCount: 0, shares: 0,
        });
      }
      setNewPostContent("");
      setPostMedia([]);
      setPostLocation("");
      setTaggedShops([]);
      setShowCreatePost(false);
    } catch (e) {
      console.error("Failed to create post:", e);
    } finally {
      setPosting(false);
    }
  };

  // ── Deal ──
  const handleMakeDeal = async (productName: string, shopOwnerId: string, dealData?: { quantity: number; suggestedPrice: number; message: string; productId?: string }) => {
    if (!user?.id) { requireAuth(); return; }
    const chatBase = user.role === "shop_owner" ? "/shop/chat" : "/customer/chat";
    try {
      const dealInfo: Record<string, unknown> = { productName, quantity: dealData?.quantity, initialPrice: dealData?.suggestedPrice, status: "pending" };
      if (dealData?.productId) dealInfo.productId = dealData.productId;
      const res = await createChat({ type: "deal", participants: [user.id, shopOwnerId], dealInfo });
      const chatId = res?.chat?.id;
      if (chatId && dealData) {
        const { sendMessage: sendMsg } = await import("@/hooks/useApi");
        await sendMsg({ chatId, senderId: user.id, senderName: `${user.firstName} ${user.lastName}`, senderRole: user.role as "customer" | "shop_owner", content: dealData.message, type: "deal_update" });
      }
      router.push(chatId ? `${chatBase}?chatId=${chatId}` : chatBase);
    } catch (e) { console.error("Failed to create deal chat:", e); }
  };

  const handleContactShop = async (shopOwnerId: string) => {
    if (!user?.id) { requireAuth(); return; }
    const chatBase = user.role === "shop_owner" ? "/shop/chat" : "/customer/chat";
    try {
      const chatsRes = await fetch(`/api/chat?userId=${user.id}`);
      const chatsData = await chatsRes.json();
      const existingChat = (chatsData.chats || []).find((c: { type: string; participants: { id: string }[] }) => c.type === "general" && c.participants.some((p: { id: string }) => p.id === shopOwnerId));
      if (existingChat) { router.push(`${chatBase}?chatId=${existingChat.id}`); return; }
      const res = await createChat({ type: "general", participants: [user.id, shopOwnerId] });
      router.push(res?.chat?.id ? `${chatBase}?chatId=${res.chat.id}` : chatBase);
    } catch (e) { console.error("Failed to create chat:", e); }
  };

  // ── Post Templates for shop owners ──
  const isShopOwner = user?.role === "shop_owner";

  const templateContents: Record<string, string> = {
    promotion: [
      "FLASH SALE!",
      "",
      "[Product name] now only K[Price]!",
      "",
      "Was K[Original price] - [Discount]% OFF!",
      "",
      "Limited time only. Do not miss out!",
      "",
      "#Pakalale #Sale #Deals",
    ].join("\n"),
    "new-arrival": [
      "NEW ARRIVAL!",
      "",
      "Just restocked! [Product name] is back in stock.",
      "",
      "K[Price] - [Quantity] units available",
      "",
      "Come grab yours before they are gone!",
      "",
      "#Pakalale #NewStock #FreshArrivals",
    ].join("\n"),
    featured: [
      "FEATURED PRODUCT",
      "",
      "[Product name]",
      "",
      "[Why it is special - quality, durability, value]",
      "",
      "K[Price]",
      "Available at our shop",
      "",
      "DM us or visit to order!",
      "",
      "#Pakalale #Featured #ShopLocal",
    ].join("\n"),
    custom: "",
  };

  const postTemplates = [
    { id: "promotion", label: "Promotion", icon: Zap, color: "text-rose-400 bg-rose-400/10 border-rose-400/20" },
    { id: "new-arrival", label: "New Stock", icon: Package, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    { id: "featured", label: "Featured", icon: Megaphone, color: "text-brand bg-primary/10 border-primary/20" },
    { id: "custom", label: "Custom", icon: Sparkles, color: "text-muted-foreground bg-muted border-border" },
  ];

  const handleTemplateSelect = (templateId: string) => {
    setCreatePostMounted(true);
    setNewPostContent(templateContents[templateId] || "");
    setShowCreatePost(true);
  };

  return (
    <div
      ref={scrollContainerRef}
      className="space-y-4"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div className="flex justify-center py-2" style={{ height: isRefreshing ? 40 : pullDistance * 0.6 }}>
          <Loader2 className={cn("h-5 w-5 text-brand", isRefreshing && "animate-spin")} />
        </div>
      )}

      {/* Create Post / guest prompt */}
      {isGuest ? (
        <Card className="border-brand/15 bg-gradient-to-r from-brand/5 via-card to-primary/10">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Join the conversation</p>
                  <p className="text-xs text-muted-foreground">
                    Sign in to like, comment, and share posts from local shops.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={requireAuth}>Sign in</Button>
                <Button size="sm" onClick={() => router.push("/signup")}>Create account</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
      <Card className="bg-card border-border">
        <CardContent className="p-2.5 sm:p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); if (user?.id) router.push(`/customer/profile/${user.id}`); }} className="shrink-0 cursor-pointer rounded-full">
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarImage src={user?.avatar} alt={user?.firstName} className="cursor-pointer" />
                <AvatarFallback className="bg-gradient-to-br from-primary to-amber-golden text-primary-foreground text-xs cursor-pointer">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
            </button>
            <Button variant="outline" className="h-8 flex-1 justify-start text-xs text-muted-foreground" onClick={() => { setCreatePostMounted(true); setShowCreatePost(true); }}>
              Post what you&apos;re looking for, {user?.firstName}?
            </Button>
          </div>

          {/* Quick post templates for shop owners */}
          {isShopOwner && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {postTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98] ${template.color}`}
                >
                  <template.icon className="h-3.5 w-3.5" />
                  {template.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 flex-1 px-2 text-muted-foreground" onClick={handleMediaPick}>
              <Image className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Media</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 flex-1 px-2 text-muted-foreground" onClick={() => { setLocationPickerMounted(true); setShowLocationPicker(true); }}>
              <MapPin className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Location</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 flex-1 px-2 text-muted-foreground" onClick={() => { setTagPickerMounted(true); setShowTagPicker(true); }}>
              <Tag className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Tag</span>
            </Button>
          </div>

          {/* Live preview of attachments outside the dialog */}
          {(postMedia.length > 0 || postLocation || taggedShops.length > 0) && (
            <div className="mt-2 space-y-2">
              {/* Media previews */}
              {postMedia.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {postMedia.map((media, i) => (
                    <div key={i} className="relative shrink-0">
                      {media.type === "video" ? (
                        <video src={media.url} className="h-16 w-16 object-cover rounded-lg" muted />
                      ) : (
                        <img src={media.url} className="h-16 w-16 object-cover rounded-lg" alt="" />
                      )}
                      <button onClick={() => handleRemoveMedia(i)} className="absolute -top-1 -right-1 bg-black/60 rounded-full p-0.5"><X className="h-2.5 w-2.5 text-white" /></button>
                    </div>
                  ))}
                </div>
              )}
              {/* Location tag */}
              {postLocation && (
                <div className="flex items-center gap-1.5 text-[10px] text-brand bg-primary/5 rounded-lg px-2 py-1">
                  <MapPin className="h-3 w-3" />{postLocation}
                  <button onClick={() => setPostLocation("")}><X className="h-2.5 w-2.5" /></button>
                </div>
              )}
              {/* Tagged shops */}
              {taggedShops.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {taggedShops.map((shop) => (
                    <span key={shop.id} className="flex items-center gap-1 text-[10px] bg-primary/10 text-brand rounded-full px-2 py-0.5">
                      @{shop.name}
                      <button onClick={() => setTaggedShops((prev) => prev.filter((s) => s.id !== shop.id))}><X className="h-2.5 w-2.5" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {afterComposer}

      {/* Filters */}
      <div className="flex gap-1 bg-brand-soft/60 rounded-lg p-1">
        {([ { id: "all" as const, label: "All", icon: TrendingUp }, { id: "promotions" as const, label: "Promos", icon: Star }, { id: "nearby" as const, label: "Nearby", icon: MapPin } ]).map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors flex-1 justify-center", filter === f.id ? "bg-primary text-primary-foreground" : "text-brand hover:bg-brand-soft")}>
            <f.icon className="h-3.5 w-3.5" /><span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {loading && feedPosts.length === 0 ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5 flex-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2 w-16" /></div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <div className="flex gap-2 pt-1"><Skeleton className="h-7 w-16" /><Skeleton className="h-7 w-16" /><Skeleton className="h-7 w-16" /></div>
              </div>
            ))}
          </>
        ) : feedPosts.length === 0 ? (
          <div className="text-center py-12"><TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><p className="text-sm font-medium">No posts yet</p><p className="text-xs text-muted-foreground">Be the first to share something!</p></div>
        ) : (
          <>
            {feedPosts.map((post) => (
              <FeedPost key={post.id} post={post} onLike={handleLike} onComment={handleComment} onShare={handleShare} onMakeDeal={handleMakeDeal} onContactShop={handleContactShop} currentUserId={user?.id} currentUserName={user ? `${user.firstName} ${user.lastName}` : undefined} currentUserRole={user?.role as "customer" | "shop_owner" | undefined} />
            ))}

            {/* Load more sentinel — IntersectionObserver targets this */}
            <div ref={loadMoreRef} className="py-2" />

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={`more-${i}`} className="bg-card border border-border rounded-lg p-4 space-y-3 opacity-60">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1.5 flex-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2 w-16" /></div>
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {/* End of feed */}
            {!hasMore && feedPosts.length > 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                You&apos;ve reached the end of the feed
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Post Dialog */}
      {createPostMounted && (
      <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md p-0">
            <DialogHeader className="p-3 border-b border-border"><DialogTitle className="text-sm font-bold">Post what you&apos;re looking for</DialogTitle></DialogHeader>
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8"><AvatarImage src={user?.avatar} /><AvatarFallback className="bg-primary text-xs text-primary-foreground">{user?.firstName?.[0]}</AvatarFallback></Avatar>
              <span className="text-sm font-medium">{user?.firstName} {user?.lastName}</span>
            </div>
            <Textarea value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} placeholder="What are you looking for?" rows={4} className="resize-none" />

            {/* Upload progress bar */}
            <UploadProgressBar uploading={mediaUploading} progress={uploadProgress} error={uploadError} />

            {/* Selected media preview */}
            {postMedia.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">{postMedia.map((media, i) => (
                <div key={i} className="relative shrink-0">
                  {media.type === "video" ? (
                    <video src={media.url} className="h-20 w-20 object-cover rounded-lg" muted />
                  ) : (
                    <img src={media.url} className="h-20 w-20 object-cover rounded-lg" alt="" />
                  )}
                  <button onClick={() => handleRemoveMedia(i)} className="absolute -top-1 -right-1 bg-black/60 rounded-full p-0.5"><X className="h-3 w-3 text-white" /></button>
                  {media.type === "video" && <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1 text-[8px] text-white">VIDEO</div>}
                </div>
              ))}</div>
            )}

            {/* Location tag */}
            {postLocation && (
              <div className="flex items-center gap-1.5 text-xs text-brand bg-primary/5 rounded-lg px-2 py-1.5"><MapPin className="h-3 w-3" />{postLocation}<button onClick={() => setPostLocation("")}><X className="h-3 w-3" /></button></div>
            )}

            {/* Tagged shops */}
            {taggedShops.length > 0 && (
              <div className="flex flex-wrap gap-1">{taggedShops.map((shop) => (
                <span key={shop.id} className="flex items-center gap-1 text-xs bg-primary/10 text-brand rounded-full px-2 py-1">@{shop.name}<button onClick={() => setTaggedShops((prev) => prev.filter((s) => s.id !== shop.id))}><X className="h-3 w-3" /></button></span>
              ))}</div>
            )}

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleMediaPick} disabled={mediaUploading}>
                {mediaUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Image className="h-4 w-4 mr-1" />}
                {mediaUploading ? `Uploading... ${Math.round(uploadProgress)}%` : "Photo/Video"}
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setLocationPickerMounted(true); setShowLocationPicker(true); }}><MapPin className="h-4 w-4 mr-1" />Location</Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setTagPickerMounted(true); setShowTagPicker(true); }}><Tag className="h-4 w-4 mr-1" />Tag</Button>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleCreatePost} disabled={!newPostContent.trim() || posting} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}

      {/* Location Picker Dialog */}
      {locationPickerMounted && (
      <Dialog open={showLocationPicker} onOpenChange={setShowLocationPicker}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm p-4">
          <DialogTitle className="text-sm font-bold mb-3">Add Location</DialogTitle>
          <Button onClick={handleLocationPick} className="w-full justify-start mb-2"><MapPin className="h-4 w-4 mr-2" />Use Current Location</Button>
          <Button variant="outline" onClick={() => { setPostLocation("Lusaka, Zambia"); setShowLocationPicker(false); }} className="w-full justify-start"><MapPin className="h-4 w-4 mr-2" />Lusaka, Zambia</Button>
        </DialogContent>
      </Dialog>
      )}

      {/* Tag Picker Dialog */}
      {tagPickerMounted && (
      <Dialog open={showTagPicker} onOpenChange={setShowTagPicker}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm p-0">
          <DialogHeader className="p-3 border-b border-border"><DialogTitle className="text-sm font-bold">Tag a Shop</DialogTitle></DialogHeader>
          <div className="p-3 space-y-2">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search shops..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} className="pl-10" /></div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredShops.map((shop) => (
                <button key={shop.id} onClick={() => { setTaggedShops((prev) => [...prev, shop]); setTagSearch(""); }} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-left">
                  <div className="h-7 w-7 bg-primary/10 rounded flex items-center justify-center shrink-0"><Tag className="h-3.5 w-3.5 text-brand" /></div>
                  <div><p className="text-xs font-medium">{shop.name}</p><p className="text-[10px] text-muted-foreground">{shop.specialties?.[0] || ""}</p></div>
                </button>
              ))}
              {filteredShops.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No shops found</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
