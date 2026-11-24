"use client";

import Link from "next/link";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/formatTime";
import type { FeedCommentData } from "@/hooks/useApi";

interface CommentThreadProps {
  comment: FeedCommentData;
  replies: FeedCommentData[];
  currentUserId?: string;
  profileHref: (userId?: string) => string | null;
  onReact: (commentId: string, reaction: "like" | "dislike") => void;
  onReply: (target: { id: string; name: string }) => void;
  pendingReaction: string | null;
}

interface CommentRowProps {
  comment: FeedCommentData;
  currentUserId?: string;
  profileHref: (userId?: string) => string | null;
  onReact: (commentId: string, reaction: "like" | "dislike") => void;
  onReply: (target: { id: string; name: string }) => void;
  pending: boolean;
}

function CommentRow({ comment, currentUserId, profileHref, onReact, onReply, pending }: CommentRowProps) {
  const href = profileHref(comment.authorId);
  const liked = Boolean(currentUserId && comment.likes.includes(currentUserId));
  const disliked = Boolean(currentUserId && comment.dislikes.includes(currentUserId));
  const likeCount = comment.likes.length;
  const dislikeCount = comment.dislikes.length;

  const name = href ? (
    <Link href={href} className="text-xs font-semibold hover:underline">
      {comment.authorName}
    </Link>
  ) : (
    <span className="text-xs font-semibold">{comment.authorName}</span>
  );

  return (
    <div className="flex items-start gap-2">
      {href ? (
        <Link href={href} className="shrink-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={comment.authorAvatar} alt={comment.authorName} />
            <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
              {comment.authorName?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
        </Link>
      ) : (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={comment.authorAvatar} alt={comment.authorName} />
          <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
            {comment.authorName?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-muted px-3 py-2">
          {name}
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.content}</p>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3 pl-1 text-[11px] text-muted-foreground">
          <span>{comment.createdAt ? formatTimeAgo(comment.createdAt) : ""}</span>
          <button
            type="button"
            aria-pressed={liked}
            disabled={pending}
            onClick={() => onReact(comment.id, "like")}
            className={cn(
              "flex items-center gap-1 font-medium transition-colors disabled:opacity-60",
              liked ? "text-brand" : "hover:text-foreground",
            )}
          >
            <ThumbsUp className={cn("h-3.5 w-3.5", liked && "fill-current")} />
            Like{likeCount > 0 ? ` ${likeCount}` : ""}
          </button>
          <button
            type="button"
            aria-pressed={disliked}
            disabled={pending}
            onClick={() => onReact(comment.id, "dislike")}
            className={cn(
              "flex items-center gap-1 font-medium transition-colors disabled:opacity-60",
              disliked ? "text-rose-500" : "hover:text-foreground",
            )}
          >
            <ThumbsDown className={cn("h-3.5 w-3.5", disliked && "fill-current")} />
            Dislike{dislikeCount > 0 ? ` ${dislikeCount}` : ""}
          </button>
          <button
            type="button"
            onClick={() => onReply({ id: comment.id, name: comment.authorName })}
            className="font-medium transition-colors hover:text-foreground"
          >
            Reply
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommentThread({
  comment,
  replies,
  currentUserId,
  profileHref,
  onReact,
  onReply,
  pendingReaction,
}: CommentThreadProps) {
  return (
    <div className="space-y-2">
      <CommentRow
        comment={comment}
        currentUserId={currentUserId}
        profileHref={profileHref}
        onReact={onReact}
        onReply={onReply}
        pending={pendingReaction === comment.id}
      />

      {replies.length > 0 && (
        <div className="ml-9 space-y-2 border-l-2 border-border pl-3">
          {replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              profileHref={profileHref}
              onReact={onReact}
              onReply={() => onReply({ id: comment.id, name: comment.authorName })}
              pending={pendingReaction === reply.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
