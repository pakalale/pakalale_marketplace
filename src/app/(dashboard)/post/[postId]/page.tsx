"use client";

import { useParams } from "next/navigation";
import PostDetailView from "@/components/post/PostDetailView";

export default function PostPage() {
  const params = useParams();
  const raw = params?.postId;
  const postId = Array.isArray(raw) ? raw[0] : raw;

  if (!postId) return null;

  return <PostDetailView postId={postId} />;
}
