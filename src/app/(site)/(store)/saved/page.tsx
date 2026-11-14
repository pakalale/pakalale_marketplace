import Container from "@/components/landing/Container";
import SavedItems from "@/components/account/SavedItems";
import { PageHeading } from "@/components/site/Breadcrumbs";

export default function SavedItemsPage() {
  return (
    <Container className="max-w-[1440px] py-6 sm:py-8">
      <PageHeading crumbs={[{ label: "Saved Items" }]} title="Saved Items" />
      <SavedItems />
    </Container>
  );
}
