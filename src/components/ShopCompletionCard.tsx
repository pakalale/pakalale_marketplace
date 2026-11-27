import Link from "next/link";
import { Store } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useShop } from "@/hooks/useApi";

export default function ShopCompletionCard() {
  const { user } = useAuthStore();
  const { data: shopData } = useShop(user?.id || null);

  const shop = shopData?.shop;
  const status = shop?.status || "pending";
  const docs = shop?.verificationDocuments || {};

  const hasBusinessLicense = Boolean(docs.businessLicense);
  const hasTaxCertificate = Boolean(docs.taxCertificate);
  const hasNationalId = Boolean(docs.nationalId);
  const hasOtherDocs = Array.isArray(docs.other) && docs.other.length > 0;

  const hasAnyDoc =
    hasBusinessLicense ||
    hasTaxCertificate ||
    hasNationalId ||
    hasOtherDocs;

  const hasLocation = Boolean(shop?.locationId);
  const hasContact = Boolean(shop?.contact?.email) || Boolean(shop?.contact?.phone);
  const hasSpecialties = Array.isArray(shop?.specialties) && shop.specialties.length > 0;
  const hasHours = Object.keys(shop?.hours || {}).length > 0;

  const profileItems = [
    { label: "Location", complete: hasLocation },
    { label: "Contact", complete: hasContact },
    { label: "Specialties", complete: hasSpecialties },
    { label: "Hours", complete: hasHours },
  ];

  const docItems = [
    { label: "License", complete: hasBusinessLicense },
    { label: "Tax cert", complete: hasTaxCertificate },
    { label: "ID", complete: hasNationalId },
    { label: "Other", complete: hasOtherDocs },
  ];

  const allItems = [...profileItems, ...docItems];
  const completedItems = allItems.filter((item) => item.complete).length;
  const totalItems = allItems.length;
  const completionPercent = Math.round((completedItems / totalItems) * 100);

  const isVerified = status === "verified";
  const isRejected = status === "rejected";
  const isPending = status === "pending";

  if (isVerified || !shop || !user?.id) {
    return null;
  }

  const needsDocs =
    !hasBusinessLicense &&
    !hasTaxCertificate &&
    !hasNationalId &&
    !hasOtherDocs;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground truncate">
            {isPending && hasAnyDoc
              ? "Shop under review"
              : isRejected
              ? "Verification declined"
              : "Shop setup"}
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Shop completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
        <span className="text-[11px] font-bold text-brand shrink-0">
          {completionPercent}%
        </span>
        <Link
          href="/shop/settings"
          className="ml-auto shrink-0 rounded-md bg-brand px-2.5 py-1 text-[10px] font-semibold text-brand-foreground transition-opacity hover:opacity-90"
        >
          Update
        </Link>
      </div>
      <div className="mt-1.5 flex gap-2 overflow-hidden">
        {allItems.map((item) => (
          <div key={item.label} className="shrink-0">
            <Link href="/shop/settings" className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors hover:bg-muted">
              <span className={item.complete ? "text-emerald-700" : "text-muted-foreground"}>
                {item.complete ? (
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}
                {item.label}
              </span>
            </Link>
          </div>
        ))}
      </div>
      {isPending && !needsDocs && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Awaiting admin review.
        </p>
      )}
      {isRejected && shop?.rejectedReason && (
        <p className="mt-1 text-[10px] text-destructive">
          Reason: {shop.rejectedReason}
        </p>
      )}
    </div>
  );
}
