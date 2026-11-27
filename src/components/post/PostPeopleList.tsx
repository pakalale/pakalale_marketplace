"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, Loader2, Share2, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useAuthStore } from "@/store/authStore";
import { useNavScrollVisibility } from "@/hooks/useNavScrollVisibility";
import { useFeedPostDetail, type FeedPersonData } from "@/hooks/useApi";

interface PostPeopleListProps {
  postId: string;
  kind: "likes" | "shares";
}

export default function PostPeopleList({ postId, kind }: PostPeopleListProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { post, loading, error } = useFeedPostDetail(postId);
  const navVisible = useNavScrollVisibility();

  const profileBase = user?.role === "shop_owner" ? "/shop/profile" : "/customer/profile";
  const people: FeedPersonData[] = kind === "likes" ? post?.likers || [] : post?.sharedBy || [];
  const title = kind === "likes" ? "Likes" : "Shares";
  const EmptyIcon = kind === "likes" ? Heart : Share2;

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(`/post/${postId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className={`sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur transition-transform duration-300 ${navVisible ? "translate-y-0" : "-translate-y-full"}`}>
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2 px-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold leading-tight">{title}</h1>
            {post && (
              <p className="text-[11px] text-muted-foreground">
                {people.length} {people.length === 1 ? "person" : "people"}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-3 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{error}</p>
        ) : people.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-14 text-center">
            <EmptyIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">
              {kind === "likes" ? "No likes yet" : "No shares yet"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {kind === "likes" ? "Be the first to like this post." : "Share this post to be the first."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {people.map((person) => (
              <li key={person.id}>
                <Link
                  href={`${profileBase}/${person.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={person.avatar} alt={person.name} />
                    <AvatarFallback className="bg-primary text-sm text-primary-foreground">
                      {person.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{person.name}</span>
                      {person.role === "shop_owner" && (
                        <Badge variant="secondary" className="h-5 bg-primary/10 text-[10px] text-brand">Shop</Badge>
                      )}
                      {person.isShopVerified && <VerifiedBadge size="sm" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {person.role === "shop_owner" ? "Shop" : "Customer"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {kind === "likes" && people.length > 0 && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            People who reacted to this post
          </p>
        )}
      </div>
    </div>
  );
}
