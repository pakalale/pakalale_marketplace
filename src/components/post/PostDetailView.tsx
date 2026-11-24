"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Heart,
  Loader2,
  MessageCircle,
  Send,
  Share2,
  ShoppingBag,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import VerifiedBadge from "@/components/VerifiedBadge";
import PostMedia from "@/components/post/PostMedia";
import CommentThread from "@/components/post/CommentThread";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/formatTime";
import { formatKwacha } from "@/lib/product";
import {
  addFeedComment,
  likeFeedPost,
  reactToFeedComment,
  useFeedPostDetail,
  type FeedCommentData,
} from "@/hooks/useApi";

interface PostDetailViewProps {
  postId: string;
}

export default function PostDetailView({ postId }: PostDetailViewProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { post, setPost, loading, error } = useFeedPostDetail(postId);

  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingReaction, setPendingReaction] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const profileBase = user?.role === "shop_owner" ? "/shop/profile" : "/customer/profile";
  const profileHref = useCallback(
    (userId?: string) => (userId ? `${profileBase}/${userId}` : null),
    [profileBase],
  );

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(user?.role === "shop_owner" ? "/shop/feed" : "/customer");
  }, [router, user?.role]);

  const isLiked = Boolean(user?.id && post?.likedBy.includes(user.id));

  const { roots, repliesByComment } = useMemo(() => {
    const comments = post?.comments || [];
    const ids = new Set(comments.map((comment) => comment.id));
    const replyMap = new Map<string, FeedCommentData[]>();
    const rootList: FeedCommentData[] = [];

    comments.forEach((comment) => {
      // A reply whose parent is gone is shown as a top-level comment.
      if (comment.parentId && ids.has(comment.parentId)) {
        const list = replyMap.get(comment.parentId) || [];
        list.push(comment);
        replyMap.set(comment.parentId, list);
      } else {
        rootList.push(comment);
      }
    });

    rootList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    replyMap.forEach((list) => {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    return { roots: rootList, repliesByComment: replyMap };
  }, [post?.comments]);

  const focusComposer = (target: { id: string; name: string } | null) => {
    setReplyingTo(target);
    setExpanded(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleToggleLike = async () => {
    if (!post) return;
    if (!user?.id) {
      router.push("/login");
      return;
    }

    const viewerId = user.id;
    const wasLiked = post.likedBy.includes(viewerId);
    setPost((prev) =>
      prev
        ? {
            ...prev,
            likes: Math.max(0, prev.likes + (wasLiked ? -1 : 1)),
            likedBy: wasLiked ? prev.likedBy.filter((id) => id !== viewerId) : [...prev.likedBy, viewerId],
          }
        : prev,
    );

    try {
      const result = await likeFeedPost(post.id, viewerId);
      if (typeof result?.likesCount === "number") {
        setPost((prev) =>
          prev
            ? {
                ...prev,
                likes: result.likesCount,
                likedBy: result.liked
                  ? [...new Set([...prev.likedBy, viewerId])]
                  : prev.likedBy.filter((id) => id !== viewerId),
              }
            : prev,
        );
      }
    } catch {
      // The optimistic count is close enough; a reload corrects it.
    }
  };

  const handleReact = async (commentId: string, reaction: "like" | "dislike") => {
    if (!post) return;
    if (!user?.id) {
      router.push("/login");
      return;
    }

    setPendingReaction(commentId);
    try {
      const result = await reactToFeedComment(post.id, commentId, user.id, reaction);
      setPost((prev) =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map((comment) => {
                if (comment.id !== commentId) return comment;
                return {
                  ...comment,
                  likes: result.liked
                    ? [...new Set([...comment.likes, user.id])]
                    : comment.likes.filter((id) => id !== user.id),
                  dislikes: result.disliked
                    ? [...new Set([...comment.dislikes, user.id])]
                    : comment.dislikes.filter((id) => id !== user.id),
                };
              }),
            }
          : prev,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save your reaction");
    } finally {
      setPendingReaction(null);
    }
  };

  const handleSubmitComment = async () => {
    if (!post) return;
    if (!user?.id) {
      router.push("/login");
      return;
    }

    const content = draft.trim();
    if (!content || submitting) return;

    setSubmitting(true);
    try {
      const result = await addFeedComment(post.id, user.id, content, replyingTo?.id ?? null);
      if (result.comment) {
        const created = result.comment;
        setPost((prev) =>
          prev
            ? {
                ...prev,
                comments: [...prev.comments, { ...created, authorAvatar: created.authorAvatar || user.avatar }],
                commentsCount: prev.commentsCount + 1,
              }
            : prev,
        );
      }
      setDraft("");
      setReplyingTo(null);
      inputRef.current?.blur();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't post your comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const url = `${window.location.origin}/post/${post.id}`;
    const shareData = { title: "Pakalale post", text: post.content.slice(0, 120), url };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        return; // The person closed the share sheet.
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    }

    setPost((prev) => (prev ? { ...prev, shares: prev.shares + 1 } : prev));
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "feed_share", targetId: post.id, userId: user?.id }),
    }).catch(() => {});
  };

  const header = (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-2xl items-center gap-1.5 px-2">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => router.push(`/post/${postId}/likes`)}
          className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-500 transition-colors hover:bg-rose-500/20"
        >
          <Heart className="h-3.5 w-3.5 fill-current" />
          {post ? `${post.likes} reaction${post.likes === 1 ? "" : "s"}` : "Reactions"}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => router.push(`/post/${postId}/shares`)}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Share2 className="h-3.5 w-3.5" />
          {post ? `${post.shares} share${post.shares === 1 ? "" : "s"}` : "Shares"}
        </button>
      </div>
    </header>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-brand" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background">
        {header}
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-semibold">{error || "This post is no longer available"}</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={goBack}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const authorHref = profileHref(post.author?.id || post.authorId);
  const authorName = post.author?.name || "Pakalale user";
  const product = post.product;

  return (
    <div className="min-h-screen bg-background">
      {header}

      <div className="mx-auto w-full max-w-2xl px-3 pb-44 pt-3 sm:px-4">
        <article className="rounded-xl border border-border bg-card p-3 sm:p-4">
          {/* Author */}
          <div className="flex items-start gap-2.5">
            {authorHref ? (
              <Link href={authorHref} className="shrink-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={post.author?.avatar} alt={authorName} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-amber-golden text-sm text-primary-foreground">
                    {authorName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-primary text-sm text-primary-foreground">{authorName.charAt(0)}</AvatarFallback>
              </Avatar>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {authorHref ? (
                  <Link href={authorHref} className="truncate text-sm font-semibold hover:underline">
                    {authorName}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-semibold">{authorName}</span>
                )}
                {post.author?.role === "shop_owner" && (
                  <Badge variant="secondary" className="h-5 bg-primary/10 text-[10px] text-brand">Shop</Badge>
                )}
                {post.author?.isShopVerified && <VerifiedBadge size="sm" />}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{formatTimeAgo(post.createdAt)}</p>
            </div>
          </div>

          {/* Content */}
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>

          {product && (
            <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {product.image ? (
                    <img src={product.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium">{product.name}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg font-bold text-brand">{formatKwacha(product.price)}</span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="text-xs text-muted-foreground line-through">{formatKwacha(product.originalPrice)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <PostMedia images={post.images || []} />

          {/* Counts */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[11px] font-medium text-muted-foreground">
            <button
              type="button"
              onClick={() => router.push(`/post/${postId}/likes`)}
              className="flex items-center gap-1 hover:underline"
            >
              <Heart className="h-3 w-3 text-rose-500" />
              {post.likes} reaction{post.likes === 1 ? "" : "s"}
            </button>
            <div className="flex items-center gap-3">
              <span>
                {post.commentsCount} comment{post.commentsCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => router.push(`/post/${postId}/shares`)}
                className="hover:underline"
              >
                {post.shares} share{post.shares === 1 ? "" : "s"}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-1 grid grid-cols-3 gap-1 border-t border-border pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleLike}
              aria-pressed={isLiked}
              className={cn(
                "h-8 text-[11px] font-medium",
                isLiked ? "text-rose-500 hover:bg-rose-500/10" : "text-brand hover:bg-brand-soft",
              )}
            >
              <Heart className={cn("mr-1.5 h-4 w-4", isLiked && "fill-current")} />
              Like
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => focusComposer(null)}
              className="h-8 text-[11px] font-medium text-brand hover:bg-brand-soft"
            >
              <MessageCircle className="mr-1.5 h-4 w-4" />
              Comment
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="h-8 text-[11px] font-medium text-brand hover:bg-brand-soft"
            >
              <Share2 className="mr-1.5 h-4 w-4" />
              Share
            </Button>
          </div>
        </article>

        {/* Comments */}
        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Comments</h2>
            <span className="text-xs text-muted-foreground">{post.commentsCount}</span>
          </div>

          {roots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">No comments yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Be the first to say something.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {roots.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  replies={repliesByComment.get(comment.id) || []}
                  currentUserId={user?.id}
                  profileHref={profileHref}
                  onReact={handleReact}
                  onReply={focusComposer}
                  pendingReaction={pendingReaction}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Composer */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
          {replyingTo && (
            <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
              <span className="truncate">
                Replying to <span className="font-medium text-foreground">{replyingTo.name}</span>
              </span>
              <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <Avatar className="mb-1 h-8 w-8 shrink-0">
              <AvatarImage src={user?.avatar} alt={user?.firstName} />
              <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                {user?.firstName?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>

            <textarea
              ref={inputRef}
              rows={expanded ? 3 : 1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={() => setExpanded(true)}
              onBlur={() => {
                if (!draft.trim() && !replyingTo) setExpanded(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmitComment();
                }
              }}
              placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : "Write a comment..."}
              maxLength={1000}
              className="max-h-32 min-h-9 flex-1 resize-none rounded-2xl border border-border bg-muted px-3 py-2 text-sm leading-snug outline-none transition-[border-color] focus:border-primary/50"
            />

            {expanded ? (
              <Button
                size="sm"
                onClick={handleSubmitComment}
                disabled={!draft.trim() || submitting}
                className="mb-1 h-8 shrink-0 bg-primary px-3 text-primary-foreground hover:bg-primary/90"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => focusComposer(replyingTo)}
                aria-label="Write a comment"
                className="mb-1 h-8 shrink-0 text-brand"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
