"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Store, ShoppingBag, ArrowLeft, ArrowRight, Mail, Lock, User, Phone, MapPin, Loader2, Eye, EyeOff, Building2 } from "lucide-react";
import SpecialtyPicker from "@/components/SpecialtyPicker";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Step = "type" | "form";

interface CustomerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface ShopOwnerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  locationId: string;
  shopName: string;
  shopDescription: string;
  specialties: string;
}

export default function SignupPage() {
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuthStore();
  const [step, setStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<"customer" | "shop_owner" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      router.push(user.role === "admin" ? "/admin" : user.role === "shop_owner" ? "/shop/feed" : "/customer");
    }
  }, [isAuthenticated, user, router]);

  // Fetch locations for shop owner registration
  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((data) => setLocations(data.locations || []))
      .catch(() => {});
  }, []);

  const customerForm = useForm<CustomerForm>();
  const shopForm = useForm<ShopOwnerForm>();

  const handleTypeSelect = (type: "customer" | "shop_owner") => {
    setSelectedType(type);
    setStep("form");
    setError("");
  };

  const onCustomerSubmit = async (data: CustomerForm) => {
    if (data.password !== data.confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          role: "customer",
          phone: data.phone,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Registration failed");
        return;
      }
      // Auto-login after registration
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.user) {
        login(loginData.user);
        // Role-based redirect
        router.push(loginData.user.role === "admin" ? "/admin" : loginData.user.role === "shop_owner" ? "/shop/feed" : "/customer");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onShopOwnerSubmit = async (data: ShopOwnerForm) => {
    if (data.password !== data.confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          role: "shop_owner",
          phone: data.phone,
          location: locations.find((l) => l.id === data.locationId)?.name || "",
          shop: {
            name: data.shopName,
            description: data.shopDescription,
            locationId: data.locationId,
            specialties: selectedSpecialties,
          },
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Registration failed");
        return;
      }
      // Auto-login
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.user) {
        login(loginData.user);
        // Role-based redirect (shop_owner goes to shop, customer to customer)
        router.push(loginData.user.role === "admin" ? "/admin" : loginData.user.role === "shop_owner" ? "/shop/feed" : "/customer");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Choose account type
  if (step === "type") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="bg-primary p-2.5 rounded-xl"><Store className="h-6 w-6 text-primary-foreground" /></div>
              <span className="text-2xl font-bold">Pakalale</span>
            </div>
            <h1 className="text-xl font-bold mt-4">Create Account</h1>
            <p className="text-sm text-muted-foreground mt-1">Choose how you want to use Pakalale</p>
          </div>

          <div className="space-y-3">
            <Card className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => handleTypeSelect("customer")}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl"><ShoppingBag className="h-6 w-6 text-brand" /></div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Customer</h3>
                  <p className="text-xs text-muted-foreground">Browse shops, find deals, connect with sellers</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => handleTypeSelect("shop_owner")}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl"><Building2 className="h-6 w-6 text-brand" /></div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Shop Owner</h3>
                  <p className="text-xs text-muted-foreground">Sell products, manage orders, grow your business</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-brand hover:text-brand/80 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Registration form
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full max-w-sm relative">
        <button onClick={() => { setStep("type"); setSelectedType(null); setError(""); }} className="absolute left-0 -top-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back
        </button>
        <div className="text-center mb-6 pt-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="bg-primary p-2 rounded-xl"><Store className="h-5 w-5 text-primary-foreground" /></div>
            <span className="text-xl font-bold">Pakalale</span>
          </div>
          <h1 className="text-lg font-bold">
            {selectedType === "customer" ? "Customer Account" : "Shop Owner Account"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedType === "customer"
              ? "Quick and easy — just your basic info"
              : "Set up your shop profile to start selling"}
          </p>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg mb-4">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {selectedType === "customer" ? (
              <form onSubmit={customerForm.handleSubmit(onCustomerSubmit)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">First Name</Label>
                    <Input {...customerForm.register("firstName", { required: "Required" })} placeholder="John" className="h-10" />
                    {customerForm.formState.errors.firstName && <p className="text-[10px] text-destructive">{customerForm.formState.errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last Name</Label>
                    <Input {...customerForm.register("lastName", { required: "Required" })} placeholder="Doe" className="h-10" />
                    {customerForm.formState.errors.lastName && <p className="text-[10px] text-destructive">{customerForm.formState.errors.lastName.message}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" {...customerForm.register("email", { required: "Required", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email" } })} placeholder="you@example.com" className="pl-10 h-10" />
                  </div>
                  {customerForm.formState.errors.email && <p className="text-[10px] text-destructive">{customerForm.formState.errors.email.message}</p>}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Phone (optional)</Label>
                  <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="tel" {...customerForm.register("phone")} placeholder="+260 9X XXX XXXX" className="pl-10 h-10" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type={showPassword ? "text" : "password"} {...customerForm.register("password", { required: "Required", minLength: { value: 6, message: "Min 6 characters" } })} placeholder="••••••••" className="pl-10 pr-10 h-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</></button>
                  </div>
                  {customerForm.formState.errors.password && <p className="text-[10px] text-destructive">{customerForm.formState.errors.password.message}</p>}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Confirm Password</Label>
                  <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="password" {...customerForm.register("confirmPassword", { required: "Required" })} placeholder="••••••••" className="pl-10 h-10" />
                  </div>
                </div>

                <Button type="submit" disabled={isLoading} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create Account <ArrowRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </form>
            ) : (
              <form onSubmit={shopForm.handleSubmit(onShopOwnerSubmit)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">First Name</Label>
                    <Input {...shopForm.register("firstName", { required: "Required" })} placeholder="John" className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last Name</Label>
                    <Input {...shopForm.register("lastName", { required: "Required" })} placeholder="Doe" className="h-10" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" {...shopForm.register("email", { required: "Required" })} placeholder="you@example.com" className="pl-10 h-10" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="tel" {...shopForm.register("phone", { required: "Required" })} placeholder="+260 9X XXX XXXX" className="pl-10 h-10" />
                  </div>
                </div>

                <div className="border-t border-border pt-3 mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Building2 className="h-3 w-3" />Shop Details</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Shop Name</Label>
                  <Input {...shopForm.register("shopName", { required: "Required" })} placeholder="e.g. TechHub Zambia" className="h-10" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Location</Label>
                  <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select {...shopForm.register("locationId", { required: "Required" })} className="w-full pl-10 pr-4 h-10 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">Select a location</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Shop Description</Label>
                  <textarea {...shopForm.register("shopDescription", { required: "Required" })} placeholder="What does your shop sell?" rows={2} className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Specialties</Label>
                  <SpecialtyPicker value={selectedSpecialties} onChange={setSelectedSpecialties} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Password</Label>
                  <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type={showPassword ? "text" : "password"} {...shopForm.register("password", { required: "Required", minLength: { value: 6, message: "Min 6 characters" } })} placeholder="••••••••" className="pl-10 pr-10 h-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</></button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Confirm Password</Label>
                  <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="password" {...shopForm.register("confirmPassword", { required: "Required" })} placeholder="••••••••" className="pl-10 h-10" />
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-2.5 text-[11px] text-muted-foreground">
                  Your shop will be reviewed by our team before going live. You&apos;ll be notified once verified.
                </div>

                <Button type="submit" disabled={isLoading || selectedSpecialties.length === 0} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create Shop Account <ArrowRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-brand hover:text-brand/80 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
