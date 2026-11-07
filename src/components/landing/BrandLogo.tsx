import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function BrandLogo({ className, large }: { className?: string; large?: boolean }) {
  return (
    <Link href="/" aria-label="Pakalale Market home" className={cn("flex min-w-0 items-center", className)}>
      <Image
        src="/logo.jpeg"
        alt="Pakalale Market"
        className={cn("h-8 w-auto shrink-0 object-contain sm:h-9", large && "h-12")}
        width={320}
        height={112}
        priority
      />
    </Link>
  );
}
