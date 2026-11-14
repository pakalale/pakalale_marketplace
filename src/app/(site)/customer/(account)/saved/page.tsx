import SavedItems from "@/components/account/SavedItems";
import AccountHeading from "@/components/account/AccountHeading";

export default function CustomerSavedPage() {
  return (
    <>
      <AccountHeading title="Saved Items" description="Products you hearted while browsing." />
      <SavedItems />
    </>
  );
}
