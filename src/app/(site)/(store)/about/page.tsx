import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Store, Truck, Users } from "lucide-react";
import Container from "@/components/landing/Container";
import { PageHeading } from "@/components/site/Breadcrumbs";
import { CONTACT } from "@/lib/siteNav";

export const metadata: Metadata = {
  title: "About & Contact — PakalaleMarket.com",
  description: "Who we are, how buying works, and how to reach us.",
};

const POINTS = [
  { icon: Store, title: "Real local shops", text: "Every product is listed by a shop in one of Zambia's markets. Our team reviews new shops before they go live." },
  { icon: Truck, title: "Delivery or pickup", text: "Choose Yango or inDrive delivery, or collect from the shop yourself. Each shop handles its own order." },
  { icon: ShieldCheck, title: "Pay when you get it", text: "Pay in cash on delivery or at pickup. No card needed to order." },
  { icon: Users, title: "A community, not just a store", text: "Follow shops on the community feed, ask questions and agree deals in chat." },
];

const FAQ = [
  { q: "How do I track my order?", a: "Sign in and open Account → Orders. Each order shows its progress, delivery details and total." },
  { q: "Can I return something?", a: "Returns are agreed with the shop that sold the item. Message them from Account → Messages." },
  { q: "How much is delivery?", a: "The price shows in your cart before you check out. If your cart has products from several shops, each shop delivers separately." },
  { q: "How do I sell on Pakalale?", a: "Create a seller account. Our team reviews your shop, then you can start listing products." },
];

export default function AboutPage() {
  const channels = [
    CONTACT.email && { icon: Mail, label: "Email", value: CONTACT.email, href: `mailto:${CONTACT.email}` },
    CONTACT.phone && { icon: Phone, label: "Phone", value: CONTACT.phone, href: `tel:${CONTACT.phone.replace(/\s/g, "")}` },
    CONTACT.whatsapp && { icon: MessageCircle, label: "WhatsApp", value: CONTACT.whatsapp, href: `https://wa.me/${CONTACT.whatsapp.replace(/\D/g, "")}` },
    CONTACT.address && { icon: MapPin, label: "Based in", value: CONTACT.address },
  ].filter(Boolean) as Array<{ icon: typeof Mail; label: string; value: string; href?: string }>;

  return (
    <Container className="max-w-5xl py-6 sm:py-8">
      <PageHeading crumbs={[{ label: "About & Contact" }]} title="About PakalaleMarket" />

      <section className="rounded-3xl bg-[#002583] p-6 text-white sm:p-8">
        <p className="max-w-2xl text-lg leading-relaxed sm:text-xl">
          PakalaleMarket brings Zambia&apos;s markets online. Browse products from trusted local shops, compare prices,
          and order for delivery or pickup, all in one place.
        </p>
        <Link href="/" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#ffb800] px-6 font-semibold text-[#002583] hover:bg-[#ffc733]">
          Start Shopping <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {POINTS.map((point) => (
          <div key={point.title} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
            <point.icon className="h-7 w-7 shrink-0 text-brand" strokeWidth={1.7} />
            <div>
              <h2 className="font-bold text-brand">{point.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{point.text}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section id="faq">
          <h2 className="mb-3 text-xl font-bold text-brand">Common questions</h2>
          <div className="space-y-2">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-border bg-card p-4">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">{item.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="contact" className="scroll-mt-24 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl font-bold text-brand">Contact us</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions about an order? The fastest way is to message the shop from your account.
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            {channels.map((channel) => (
              <li key={channel.label} className="flex items-start gap-3">
                <channel.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>
                  <span className="block text-xs text-muted-foreground">{channel.label}</span>
                  {channel.href ? <a href={channel.href} className="font-semibold hover:underline">{channel.value}</a> : <span className="font-semibold">{channel.value}</span>}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/customer/chat" className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-brand-foreground hover:bg-brand/90">
            <MessageCircle className="h-4 w-4" /> Message a shop
          </Link>
        </section>
      </div>
    </Container>
  );
}
