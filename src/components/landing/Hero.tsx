"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    title: "Everything You Need, All in One Place",
    copy: "Shop quality products at great prices, delivered across Zambia.",
    cta: "Shop Now",
    href: "/#products",
  },
  {
    title: "Big Deals. Bigger Savings.",
    copy: "Find marked-down products from trusted local shops.",
    cta: "Shop the Sale",
    href: "/?sale=1#products",
  },
  {
    title: "See What Your Market Is Selling",
    copy: "Follow local shops and join the conversation on the feed.",
    cta: "Visit the Feed",
    href: "/feed",
  },
];

export default function Hero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % SLIDES.length), 6000);
    return () => window.clearInterval(timer);
  }, [paused]);

  const slide = SLIDES[active];

  return (
    <section
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#f4f5fc] to-[#e9ebf5] md:h-[340px] lg:h-[400px]"
    >
      <img
        src="/landing/hero-products.webp"
        alt="Headphones, a smartphone, sneakers and a smart watch on display"
        className="w-full md:absolute md:bottom-0 md:right-0 md:h-full md:w-auto md:max-w-[62%] md:object-cover md:object-left md:[mask-image:linear-gradient(to_right,transparent,black_6%)]"
      />

      <div className="relative flex flex-col items-start px-6 pb-11 pt-7 md:h-full md:w-[46%] md:justify-center md:py-0 md:pl-9 lg:pl-14">
        {/* Keyed so screen readers and the fade restart on each slide. */}
        <div key={active} className="animate-fade-in">
          <h1 className="text-[28px] font-bold leading-[1.1] tracking-tight text-[#002583] sm:text-4xl lg:text-5xl">
            {slide.title}
          </h1>
          <p className="mt-3 max-w-md text-base text-[#1c2a4d] lg:text-xl">{slide.copy}</p>
          <Link
            href={slide.href}
            className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-[#ffb800] px-7 text-base font-semibold text-[#002583] shadow-sm transition-colors hover:bg-[#ffc733] lg:mt-7"
          >
            {slide.cta}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <div className="absolute bottom-3.5 left-1/2 flex -translate-x-1/2 gap-1">
        {SLIDES.map((item, index) => (
          <button
            key={item.cta}
            onClick={() => setActive(index)}
            aria-label={`Show slide ${index + 1}`}
            aria-current={index === active}
            className="flex h-6 w-6 items-center justify-center"
          >
            <span className={cn("h-2.5 w-2.5 rounded-full transition-colors", index === active ? "bg-[#ffb800]" : "bg-[#b9bfd3]")} />
          </button>
        ))}
      </div>
    </section>
  );
}
