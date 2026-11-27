"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
} from "lucide-react";
import SpecialtyPicker from "@/components/SpecialtyPicker";
import GoogleButton from "@/components/auth/GoogleButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import { destinationAfterLogin, safeNextPath } from "@/lib/authRedirect";

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

// Keep someone who signed up mid-checkout on their way to placing the order.
function destinationAfterSignup(role: string) {
  const next =
    safeNextPath(new URLSearchParams(window.location.search).get("next")) ||
    safeNextPath(sessionStorage.getItem("redirectAfterLogin"));
  sessionStorage.removeItem("redirectAfterLogin");
  return destinationAfterLogin(role, next);
}

export default function SignupPage() {
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuthStore();
  const [step, setStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<"customer" | "shop_owner" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(destinationAfterSignup(user.role));
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((data) => setLocations(data.locations || []))
      .catch(() => {});
  }, []);

  const customerForm = useForm<CustomerForm>();
  const shopForm = useForm<ShopOwnerForm>();

  const selectedLocationId = shopForm.watch("locationId");
  const selectedLocationName = locations.find((loc) => loc.id === selectedLocationId)?.name;

  useEffect(() => {
    shopForm.register("locationId", { required: "Required" });
  }, [shopForm]);

  const handleTypeSelect = (type: "customer" | "shop_owner") => {
    setSelectedType(type);
    setStep("form");
    setError("");
    setAlreadyRegistered(false);
  };

  const goToSignIn = (email: string) => {
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    const search = new URLSearchParams({ email });
    if (next) search.set("next", next);
    router.push(`/login?${search.toString()}`);
  };

  const onCustomerSubmit = async (data: CustomerForm) => {
    if (data.password !== data.confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setIsLoading(true);
    setError("");
    setAlreadyRegistered(false);
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
          next: sessionStorage.getItem("redirectAfterLogin"),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Registration failed");
        setAlreadyRegistered(res.status === 409);
        return;
      }
      if (result.verificationRequired) {
        setSentTo(data.email);
        return;
      }
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.user) {
        login(loginData.user);
      } else if (loginData.code === "EMAIL_NOT_VERIFIED") {
        setSentTo(data.email);
      } else {
        setError(loginData.error || "Account created. Please sign in to continue.");
        setAlreadyRegistered(true);
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
    if (!data.locationId) {
      setError("Select a location");
      return;
    }
    setIsLoading(true);
    setError("");
    setAlreadyRegistered(false);
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
          next: sessionStorage.getItem("redirectAfterLogin"),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Registration failed");
        setAlreadyRegistered(res.status === 409);
        return;
      }
      if (result.verificationRequired) {
        setSentTo(data.email);
        return;
      }
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.user) {
        login(loginData.user);
      } else if (loginData.code === "EMAIL_NOT_VERIFIED") {
        setSentTo(data.email);
      } else {
        setError(loginData.error || "Account created. Please sign in to continue.");
        setAlreadyRegistered(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async () => {
    setResending(true);
    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: sentTo }),
    }).catch(() => null);
    setResendMessage(
      response?.ok
        ? "If the account needs confirmation, a new link is on its way."
        : "Could not resend the email. Try again shortly.",
    );
    setResending(false);
  };

  if (sentTo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="w-full max-w-sm bg-card border-border">
          <CardContent className="space-y-4 p-6 text-center">
            <Mail className="mx-auto h-9 w-9 text-brand" />
            <h1 className="text-xl font-bold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>. It expires in 24 hours.
            </p>
            {resendMessage && <p className="text-xs text-muted-foreground">{resendMessage}</p>}
            <Button type="button" variant="outline" disabled={resending} onClick={resendVerification} className="w-full">
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend confirmation email"}
            </Button>
            <Link href="/login" className="block text-sm font-medium text-brand hover:underline">
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "type") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <Link href="/" aria-label="Pakalale Market home" className="mb-4 inline-flex items-center">
              <Image src="/logo.png" alt="Pakalale Market" className="h-12 w-auto" width={320} height={112} priority />
            </Link>
            <h1 className="text-xl font-bold mt-4">Create Account</h1>
            <p className="text-sm text-muted-foreground mt-1">Choose how you want to use Pakalale</p>
          </div>

          <div className="space-y-3">
            <Card
              className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => handleTypeSelect("customer")}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <ShoppingBag className="h-6 w-6 text-brand" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Customer</h3>
                  <p className="text-xs text-muted-foreground">Browse shops, find deals, connect with sellers</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card
              className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => handleTypeSelect("shop_owner")}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Building2 className="h-6 w-6 text-brand" />
                </div>
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
            <Link href="/login" className="text-brand hover:text-brand/80 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const formWidthClass = selectedType === "shop_owner" ? "max-w-md sm:max-w-2xl" : "max-w-md";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-background via-background to-primary/5">
      <div className={`w-full ${formWidthClass} relative`}>
        <button
          onClick={() => {
            setStep("type");
            setSelectedType(null);
            setError("");
            setAlreadyRegistered(false);
          }}
          className="absolute left-0 -top-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="text-center mb-6 pt-6">
          <Link href="/" aria-label="Pakalale Market home" className="mb-3 inline-flex items-center">
            <Image src="/logo.png" alt="Pakalale Market" className="h-11 w-auto" width={320} height={112} priority />
          </Link>
          <h1 className="text-lg font-bold">{selectedType === "customer" ? "Customer Account" : "Shop Owner Account"}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedType === "customer"
              ? "Quick and easy — just your basic info"
              : "Set up your shop profile to start selling"}
          </p>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4 sm:p-6">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg mb-4 text-xs text-destructive">
                <p>{error}</p>
                {alreadyRegistered && (
                  <button
                    type="button"
                    onClick={() => goToSignIn(selectedType === "customer" ? customerForm.getValues("email") : shopForm.getValues("email"))}
                    className="mt-1.5 font-semibold underline underline-offset-2 hover:text-destructive/80"
                  >
                    Sign in to your account instead
                  </button>
                )}
              </div>
            )}

            {selectedType === "customer" ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  Account type: <span className="font-semibold text-foreground">Customer</span>
                </div>
                <GoogleButton intent="signup" onError={setError} />
                <p className="text-center text-xs text-muted-foreground">or create an account with email</p>

                <form onSubmit={customerForm.handleSubmit(onCustomerSubmit)} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">First Name</Label>
                      <Input {...customerForm.register("firstName", { required: "Required" })} placeholder="John" className="h-10" />
                      {customerForm.formState.errors.firstName && (
                        <p className="text-[10px] text-destructive">{customerForm.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Last Name</Label>
                      <Input {...customerForm.register("lastName", { required: "Required" })} placeholder="Doe" className="h-10" />
                      {customerForm.formState.errors.lastName && (
                        <p className="text-[10px] text-destructive">{customerForm.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        {...customerForm.register("email", {
                          required: "Required",
                          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email" },
                        })}
                        placeholder="you@example.com"
                        className="pl-10 h-10"
                      />
                    </div>
                    {customerForm.formState.errors.email && (
                      <p className="text-[10px] text-destructive">{customerForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Phone (optional)</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="tel" {...customerForm.register("phone")} placeholder="+260 9X XXX XXXX" className="pl-10 h-10" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        {...customerForm.register("password", {
                          required: "Required",
                          minLength: { value: 8, message: "Min 8 characters" },
                        })}
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {customerForm.formState.errors.password && (
                      <p className="text-[10px] text-destructive">{customerForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        {...customerForm.register("confirmPassword", { required: "Required" })}
                        placeholder="••••••••"
                        className="pl-10 h-10"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90">
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Create Account <ArrowRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            ) : (
              <form onSubmit={shopForm.handleSubmit(onShopOwnerSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">First Name</Label>
                    <Input {...shopForm.register("firstName", { required: "Required" })} placeholder="John" className="h-10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last Name</Label>
                    <Input {...shopForm.register("lastName", { required: "Required" })} placeholder="Doe" className="h-10" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="email" {...shopForm.register("email", { required: "Required" })} placeholder="you@example.com" className="pl-10 h-10" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="tel" {...shopForm.register("phone", { required: "Required" })} placeholder="+260 9X XXX XXXX" className="pl-10 h-10" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Shop Details
                  </p>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Shop Name</Label>
                        <Input {...shopForm.register("shopName", { required: "Required" })} placeholder="e.g. TechHub Zambia" className="h-10" />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Location</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                          {locations.length > 0 ? (
                            <Select
                              value={selectedLocationId || ""}
                              onValueChange={(value) =>
                                shopForm.setValue("locationId", value ?? "", { shouldDirty: true, shouldValidate: true })
                              }
                            >
                              <SelectTrigger className="h-10 w-full pl-9 pr-3 bg-muted border-border text-left">
                                <span className={`block truncate text-sm ${selectedLocationName ? "text-foreground" : "text-muted-foreground"}`}>
                                  {selectedLocationName || "Select a location"}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {locations.map((loc) => (
                                  <SelectItem key={loc.id} value={loc.id}>
                                    {loc.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value=""
                              placeholder="No locations available yet"
                              className="h-10 pl-9"
                              readOnly
                              disabled
                            />
                          )}
                        </div>
                        {locations.length === 0 && (
                          <p className="text-[10px] text-muted-foreground">New locations are added from the admin panel.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Shop Description</Label>
                      <textarea
                        {...shopForm.register("shopDescription", { required: "Required" })}
                        placeholder="What does your shop sell?"
                        rows={3}
                        className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Categories</Label>
                      <SpecialtyPicker value={selectedSpecialties} onChange={setSelectedSpecialties} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        {...shopForm.register("password", { required: "Required", minLength: { value: 8, message: "Min 8 characters" } })}
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="password"
                        {...shopForm.register("confirmPassword", { required: "Required" })}
                        placeholder="••••••••"
                        className="pl-10 h-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-[11px] text-muted-foreground">
                  Your shop will be reviewed by our team before going live. You&apos;ll be notified once verified.
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || selectedSpecialties.length === 0}
                  className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Create Shop Account <ArrowRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-brand hover:text-brand/80 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
