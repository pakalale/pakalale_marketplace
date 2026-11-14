import type { Metadata } from "next";
import Feed from "@/components/Feed";
import Container from "@/components/landing/Container";
import { PageHeading } from "@/components/site/Breadcrumbs";

export const metadata: Metadata = {
  title: "Community Feed — PakalaleMarket.com",
};

export default function PublicFeedPage() {
  return (
    <Container className="max-w-2xl py-5 sm:py-6">
      <PageHeading crumbs={[{ label: "Community Feed" }]} title="Community Feed" />
      <Feed />
    </Container>
  );
}
