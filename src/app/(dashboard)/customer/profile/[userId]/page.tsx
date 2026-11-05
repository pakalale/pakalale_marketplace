"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  MapPin, Store, Calendar, Loader2, ShoppingBag,
  MessageCircle, Heart, Package, Image as ImageIcon
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import VerifiedBadge from "@/components/VerifiedBadge";
import ImageViewerModal from "@/components/ImageViewerModal";
import { useAuthStore } from "@/store/authStore";
import { createChat } from "@/hooks/useApi";
import { formatTimeAgo } from "@/lib/formatTime";

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

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: string;
  isVerified: boolean;
  location?: string;
  phone?: string;
  bio?: string;
  createdAt: string;
}

interface UserShop {
  id: string;
  name: string;
  description?: string;
  specialties: string[];
  rating?: number;
  totalReviews: number;
  locationId?: string;
  status: string;
}

interface UserPost {
  id: string;
  content: string;
  images?: string[];
  likes: number;
  likedBy?: string[];
  comments: Array<{ authorId?: string; authorName?: string; content: string; createdAt: string }>;
  commentsCount: number;
  shares: number;
  isPromotion: boolean;
  postType: string;
  product?: { name: string; price: number; originalPrice?: number; discount?: number; shopId: string };
  createdAt: string;
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [shop, setShop] = useState<UserShop | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/user/profile?userId=${userId}`).then((r) => r.json()),
      fetch(`/api/shops?ownerId=${userId}`).then((r) => r.json()),
      fetch(`/api/feed?authorId=${userId}&limit=20`).then((r) => r.json()),
    ]).then(([profileData, shopsData, postsData]) => {
      setProfile(profileData.user || null);
      if (shopsData.shops?.length) setShop(shopsData.shops[0]);
      setPosts(postsData.posts || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  const handleContact = async () => {
    if (!currentUser?.id || !userId) return;
    try {
      const chatsRes = await fetch(`/api/chat?userId=${currentUser.id}`);
      const chatsData = await chatsRes.json();
      const existing = (chatsData.chats || []).find(
        (c: { participants: { id: string }[] }) => c.participants.some((p: { id: string }) => p.id === userId)
      );
      if (existing) {
        router.push(`/customer/chat?chatId=${existing.id}`);
      } else {
        const res = await createChat({ type: "general", participants: [currentUser.id, userId] });
        router.push(res?.chat?.id ? `/customer/chat?chatId=${res.chat.id}` : "/customer/chat");
      }
    } catch (e) {
      console.error("Failed to start chat:", e);
    }
  };

  const openViewer = (images: string[], index: number) => {
    setViewerImages(images);
    setViewerIndex(index);
    setViewerOpen(true);
  };

  // Skeleton while loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-14" />
        <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-amber-golden/10 p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2 w-24" />
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <Skeleton className="h-3 w-full" />
              <div className="flex gap-4"><Skeleton className="h-10 flex-1" /><Skeleton className="h-10 flex-1" /></div>
            </div>
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2.5"><Skeleton className="h-10 w-10 rounded-full" /><div className="space-y-1.5 flex-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2 w-16" /></div></div>
              <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Profile not found</p>
      </div>
    );
  }

  const isShopOwner = profile.role === "shop_owner";
  const isCurrentUser = currentUser?.id === userId;

  return (
    <div className="min-h-screen bg-background">
      <div className="h-14" />
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {/* Profile Card */}
        <Card className="bg-card border-border overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-amber-golden/10 p-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => profile.avatar && openViewer([profile.avatar], 0)}
                className="shrink-0 cursor-pointer"
              >
                <Avatar className="h-20 w-20 border-2 border-background cursor-pointer">
                  <AvatarImage src={profile.avatar} alt={profile.firstName} className="cursor-pointer" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-amber-golden text-primary-foreground text-xl cursor-pointer">
                    {profile.firstName?.[0]}{profile.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold truncate">
                    {profile.firstName} {profile.lastName}
                  </h1>
                  {profile.isVerified && <VerifiedBadge size="md" />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {isShopOwner ? "Shop Owner" : "Customer"}
                  </Badge>
                  {profile.location && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{profile.location}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Joined {new Date(profile.createdAt).toLocaleDateString("en-ZM", { month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {profile.bio && (
              <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
            )}

            <div className="flex gap-4 text-center">
              <div className="flex-1">
                <p className="text-lg font-bold">{posts.length}</p>
                <p className="text-[10px] text-muted-foreground">Posts</p>
              </div>
              {isShopOwner && shop && (
                <>
                  <div className="flex-1">
                    <p className="text-lg font-bold">{shop.rating || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">Rating</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold">{shop.totalReviews}</p>
                    <p className="text-[10px] text-muted-foreground">Reviews</p>
                  </div>
                </>
              )}
            </div>

            {!isCurrentUser && (
              <div className="flex gap-2">
                <Button onClick={handleContact} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" size="sm">
                  <MessageCircle className="h-4 w-4 mr-1.5" /> Message
                </Button>
                {isShopOwner && shop && (
                  <Button
                    onClick={() => router.push(`/customer/locations/${shop.locationId || "soweto"}?shopId=${shop.id}`)}
                    variant="outline" size="sm" className="flex-1"
                  >
                    <Store className="h-4 w-4 mr-1.5" /> Visit Shop
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Shop Card */}
        {isShopOwner && shop && (
          <Card
            className="bg-card border-border cursor-pointer hover:border-primary/20 transition-colors"
            onClick={() => router.push(`/customer/locations/${shop.locationId || "soweto"}?shopId=${shop.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-gradient-to-br from-teal-500 to-primary rounded-lg flex items-center justify-center shrink-0">
                  <Store className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-sm truncate">{shop.name}</h3>
                    {shop.status === "verified" && <VerifiedBadge size="sm" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-0.5">
                      <Store className="h-2.5 w-2.5" /><span>{shop.totalReviews} reviews</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {shop.specialties.slice(0, 3).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[8px] h-3.5">{s}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Posts — same layout as feed */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Package className="h-4 w-4 text-brand" />
            Posts ({posts.length})
          </h3>
          {posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No posts yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <Card key={post.id} className="bg-card border-border overflow-hidden">
                  {/* Post content */}
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
                              {post.product.discount && post.product.discount > 0 && (
                                <Badge variant="secondary" className="text-[10px] bg-rose-500/10 text-rose-400">-{post.product.discount}%</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Images */}
                    {post.images && post.images.length > 0 && (
                      <div className="mt-3">
                        {post.images.length === 1 ? (
                          <div
                            className="w-full h-48 sm:h-64 bg-muted rounded-lg overflow-hidden cursor-pointer"
                            onClick={() => openViewer(post.images!, 0)}
                          >
                            {isVideoUrl(post.images[0]) ? (
                              <video src={post.images[0]} className="w-full h-full object-cover" autoPlay loop muted playsInline preload="metadata" />
                            ) : (
                              <img src={post.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
                            {post.images.slice(0, 2).map((img, i) => (
                              <div
                                key={i}
                                className="relative bg-muted cursor-pointer aspect-square"
                                onClick={() => openViewer(post.images!, i)}
                              >
                                {isVideoUrl(img) ? (
                                  <video src={img} className="w-full h-full object-cover" autoPlay loop muted playsInline preload="metadata" />
                                ) : (
                                  <img src={img} alt="" className="w-full h-full object-cover" />
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
                  <div className="px-4 py-1.5 border-t border-border">
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      {post.likes > 0 && (
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-blue-400" /> {post.likes}</span>
                      )}
                      {post.commentsCount > 0 && <span>{post.commentsCount} comments</span>}
                      {post.shares > 0 && <span>{post.shares} shares</span>}
                      <span className="ml-auto">{formatTimeAgo(post.createdAt)}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image Viewer */}
      <ImageViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={viewerImages}
        initialIndex={viewerIndex}
        alt="Post image"
      />
    </div>
  );
}
