import type { Metadata } from "next";
import Feed from "@/components/Feed";
import Container from "@/components/landing/Container";

export const metadata: Metadata = {
  title: "Community Feed — PakalaleMarket.com",
};

export default function PublicFeedPage() {
  return (
    <Container className="max-w-2xl py-4 sm:py-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-brand sm:text-[28px]">Community Feed</h1>
      <Feed />
    </Container>
  );
}
