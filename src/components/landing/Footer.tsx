"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import BrandLogo from "./BrandLogo";
import Container from "./Container";

const FOOTER_COLUMNS = [
  {
    title: "Quick Links",
    links: [
      { label: "Shop", href: "/" },
      { label: "Feed", href: "/feed" },
      { label: "Categories", href: "/#products" },
      { label: "Deals", href: "/?sale=1#products" },
    ],
  },
  {
    title: "Your Account",
    links: [
      { label: "Sign In", href: "/login" },
      { label: "Create Account", href: "/signup" },
      { label: "Checkout", href: "/checkout" },
      { label: "Sell on Pakalale", href: "/signup" },
    ],
  },
];

// Add each profile URL here; icons only become links once they have one.
const SOCIAL_LINKS = [
  {
    label: "Facebook",
    href: "",
    icon: <path d="M13.5 21v-7.5H16l.5-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.6V21h2.9Z" fill="currentColor" />,
  },
  {
    label: "Instagram",
    href: "",
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="1.9">
        <rect x="4.5" y="4.5" width="15" height="15" rx="4.2" />
        <circle cx="12" cy="12" r="3.4" />
        <circle cx="16.3" cy="7.7" r=".6" fill="currentColor" />
      </g>
    ),
  },
  {
    label: "YouTube",
    href: "",
    icon: (
      <>
        <rect x="3.5" y="6.2" width="17" height="11.6" rx="3.4" fill="currentColor" />
        <path d="m10.3 9.4 4.6 2.6-4.6 2.6V9.4Z" fill="var(--card)" />
      </>
    ),
  },
  {
    label: "TikTok",
    href: "",
    icon: <path d="M13.4 4h2.5c.2 1.9 1.3 3.2 3.1 3.4v2.5c-1.2 0-2.2-.3-3.1-.9v5.6a5 5 0 1 1-4.3-5v2.6a2.4 2.4 0 1 0 1.8 2.4V4Z" fill="currentColor" />,
  },
];

const columnClass = "lg:border-l lg:border-border lg:px-6";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const subscribe = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("You're subscribed. Watch out for the latest deals.");
      setEmail("");
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Could not subscribe. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <footer className="mt-auto border-t border-border/60 bg-card">
      <Container className="grid grid-cols-[minmax(0,1fr)] gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-0">
        <div className="sm:col-span-2 lg:col-span-1 lg:pr-4">
          <BrandLogo large className="[&>span]:text-xl" />
          <p className="mt-1 text-sm text-foreground/80 lg:pl-[52px]">Shop Smart. Live Better.</p>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className={columnClass}>
            <h3 className="text-sm font-bold text-brand">{column.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-foreground/80">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-brand hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className={columnClass}>
          <h3 className="text-sm font-bold text-brand">Connect With Us</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {SOCIAL_LINKS.map((social) => {
              const icon = <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">{social.icon}</svg>;
              const className = "flex h-8 w-8 items-center justify-center rounded-full bg-brand text-card";
              return social.href ? (
                <a key={social.label} href={social.href} aria-label={social.label} target="_blank" rel="noreferrer" className={className}>
                  {icon}
                </a>
              ) : (
                <span key={social.label} title={social.label} className={className}>{icon}</span>
              );
            })}
          </div>
        </div>

        <div className={`sm:col-span-2 lg:col-span-1 ${columnClass} lg:pr-0`}>
          <h3 className="text-sm font-bold text-brand">Subscribe to our Newsletter</h3>
          <p className="mt-1.5 text-sm text-foreground/80">Get the latest deals and updates.</p>
          <form onSubmit={subscribe} className="mt-3 flex h-11 rounded-full border border-border bg-background">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email address"
              aria-label="Email address"
              className="min-w-0 flex-1 rounded-l-full bg-transparent pl-4 pr-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={saving}
              className="shrink-0 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              Subscribe
            </button>
          </form>
        </div>
      </Container>

      <div className="bg-[#002583] text-white">
        <Container className="flex flex-col items-center justify-between gap-1 py-4 text-xs sm:flex-row sm:text-[13px]">
          <p>&copy; {new Date().getFullYear()} PakalaleMarket.com. All rights reserved.</p>
          <p className="text-white/85">Secure Payments &bull; Trusted Store &bull; Zambia</p>
        </Container>
      </div>
    </footer>
  );
}
