"use client";

import { useParams } from "next/navigation";
import PostPeopleList from "@/components/post/PostPeopleList";

export default function PostSharesPage() {
  const params = useParams();
  const raw = params?.postId;
  const postId = Array.isArray(raw) ? raw[0] : raw;

  if (!postId) return null;

  return <PostPeopleList postId={postId} kind="shares" />;
}
