"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Store, ShoppingBag, Users, MapPin, ArrowRight, Star, Zap, Shield, Smartphone, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  { icon: Store, title: "Local Shops", description: "Discover shops in Soweto, Kamwala, City Market, and more", gradient: "from-amber-500/20 to-orange-500/20", iconColor: "text-amber-500" },
  { icon: ShoppingBag, title: "Easy Shopping", description: "Browse products, compare prices, and connect with vendors", gradient: "from-emerald-500/20 to-teal-500/20", iconColor: "text-emerald-500" },
  { icon: Users, title: "Community", description: "Join the community feed for real-time market updates", gradient: "from-violet-500/20 to-purple-500/20", iconColor: "text-violet-500" },
];

const whyUs = [
  { icon: Zap, title: "Lightning Fast", description: "Real-time updates and instant notifications for all your trades." },
  { icon: Shield, title: "Safe & Secure", description: "Verified shops and secure transactions you can trust." },
  { icon: Smartphone, title: "Mobile First", description: "Built for how you actually shop — on your phone, on the go." },
];

export default function LandingPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<Array<{ id: string; name: string; slug: string; shopCount: number; rating: number }>>([]);
  const [shopCount, setShopCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/locations").then((r) => r.json()).catch(() => ({ locations: [] })),
      fetch("/api/shops").then((r) => r.json()).catch(() => ({ shops: [] })),
      fetch("/api/products").then((r) => r.json()).catch(() => ({ products: [] })),
    ]).then(([locData, shopData, prodData]) => {
      setLocations(locData.locations || []);
      const shops = shopData.shops || [];
      setShopCount(shops.length);
      setProductCount((prodData.products || []).length);
      // Compute real average rating from shops
      const rated = shops.filter((s: { rating?: number }) => s.rating && s.rating > 0);
      if (rated.length > 0) {
        const avg = rated.reduce((sum: number, s: { rating: number }) => sum + s.rating, 0) / rated.length;
        setAvgRating(Math.round(avg * 10) / 10);
      }
      setLoading(false);
    });
  }, []);

  const stats = [
    { value: shopCount > 0 ? `${shopCount}+` : "—", label: "Local Shops" },
    { value: locations.length > 0 ? `${locations.length}` : "—", label: "Trading Areas" },
    { value: productCount > 0 ? `${productCount}+` : "—", label: "Products" },
    { value: avgRating > 0 ? `${avgRating}` : "—", label: "Avg Rating" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg"><Store className="h-4 w-4 text-primary-foreground" /></div>
            <span className="text-lg font-bold">Pakalale</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push("/login")} className="hidden sm:inline-flex">Sign In</Button>
            <Button size="sm" onClick={() => router.push("/signup")} className="bg-primary text-primary-foreground hover:bg-primary/90">Get Started <ArrowRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-amber-golden/5" />
        <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-4 sm:mb-6 bg-primary/10 text-brand border-primary/20 hover:bg-primary/20">🇿🇲 Built for Zambia&apos;s markets</Badge>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4 sm:mb-6">Your Local <span className="text-brand">Trading</span> <br />Platform</h1>
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-xl mx-auto">Connect with local shops across Lusaka&apos;s major trading areas. Find products, compare prices, and support your community.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={() => router.push("/signup")} className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8">Get Started Free <ArrowRight className="h-4 w-4 ml-2" /></Button>
              <Button size="lg" variant="outline" onClick={() => router.push("/login")} className="text-base px-8">Sign In</Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }} className="mt-12 sm:mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 max-w-2xl mx-auto">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i * 0.1 }} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-brand">{stat.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Why Choose Pakalale?</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Everything you need to discover, shop, and connect with local businesses.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, i) => (
              <motion.div key={feature.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="bg-card border-border hover:border-primary/30 transition-all duration-300 h-full">
                  <CardContent className="p-5 sm:p-6">
                    <div className={`bg-gradient-to-br ${feature.gradient} p-3 rounded-xl w-fit mb-4`}><feature.icon className={`h-6 w-6 ${feature.iconColor}`} /></div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="py-12 sm:py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {whyUs.map((item, i) => (
              <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center sm:text-left">
                <div className="bg-primary/10 p-3 rounded-xl w-fit mb-4 mx-auto sm:mx-0"><item.icon className="h-6 w-6 text-brand" /></div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Locations — real data */}
      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Available Locations</h2>
            <p className="text-muted-foreground">Find shops in Lusaka&apos;s busiest trading areas</p>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {locations.map((location, i) => (
                <motion.div key={location.id} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                  <Card className="bg-card border-border hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 cursor-pointer" onClick={() => router.push("/signup")}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="bg-primary/10 p-2 rounded-lg shrink-0"><MapPin className="h-4 w-4 text-brand" /></div>
                        <span className="text-sm font-medium truncate">{location.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-0.5"><Star className="h-3 w-3 text-yellow-400 fill-yellow-400" /><span>{location.rating}</span></div>
                        <span>·</span>
                        <span>{location.shopCount || 0} shops</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-20 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-2xl mx-auto text-center">
          <Card className="bg-gradient-to-br from-primary/10 via-card to-amber-golden/10 border-primary/20">
            <CardContent className="p-8 sm:p-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to Get Started?</h2>
              <p className="text-muted-foreground mb-6">Join thousands of customers and shop owners already using Pakalale</p>
              <Button size="lg" onClick={() => router.push("/signup")} className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8">Create Free Account <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg"><Store className="h-4 w-4 text-primary-foreground" /></div>
            <span className="font-bold">Pakalale</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">© 2024 Pakalale. Connecting Lusaka&apos;s local businesses.</p>
        </div>
      </footer>
    </div>
  );
}
