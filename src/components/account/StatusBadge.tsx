import type { OrderData } from "@/hooks/useApi";
import { STATUS_STYLES } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";

export default function StatusBadge({ status }: { status: OrderData["status"] }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", style.className)}>{style.label}</span>;
}
