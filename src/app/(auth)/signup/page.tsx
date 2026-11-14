"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type UseFormReturn } from "react-hook-form";
import { ShoppingBag, ArrowLeft, ArrowRight, Mail, Lock, Phone, MapPin, Loader2, Eye, EyeOff, Building2 } from "lucide-react";
import SpecialtyPicker from "@/components/SpecialtyPicker";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthShell, { ContinueShopping, FormAlert } from "@/components/auth/AuthShell";
import GoogleButton, { OrDivider } from "@/components/auth/GoogleButton";
import { destinationAfterLogin, rememberReturnPath, returnTarget, safeNextPath, takeReturnPath } from "@/lib/authRedirect";

type AccountType = "customer" | "shop_owner";

interface SignupForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  locationId: string;
  shopName: string;
  shopDescription: string;
}

const MIN_PASSWORD = 8;
const inputClass = "h-11 rounded-xl";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function IconInput({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {children}
    </div>
  );
}

function PasswordFields({ form, show, onToggle }: { form: UseFormReturn<SignupForm>; show: boolean; onToggle: () => void }) {
  const { register, formState: { errors }, getValues } = form;
  return (
    <>
      <Field label="Password" error={errors.password?.message}>
        <IconInput icon={Lock}>
          <Input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD} characters`}
            className={`${inputClass} pl-10 pr-10`}
            {...register("password", {
              required: "Choose a password",
              minLength: { value: MIN_PASSWORD, message: `Use at least ${MIN_PASSWORD} characters` },
            })}
          />
          <button type="button" onClick={onToggle} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </IconInput>
      </Field>
      <Field label="Confirm password" error={errors.confirmPassword?.message}>
        <IconInput icon={Lock}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Type it again"
            className={`${inputClass} pl-10`}
            {...register("confirmPassword", {
              required: "Confirm your password",
              validate: (value) => value === getValues("password") || "Passwords don't match",
            })}
          />
        </IconInput>
      </Field>
    </>
  );
}

function CheckYourEmail({ email, onBack }: { email: string; onBack: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const resend = async () => {
    setState("sending");
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  };

  return (
    <AuthShell
      illustration="mail"
      title="Check your inbox"
      tagline="One quick step left."
      subtitle={<>We sent a confirmation link to <strong className="text-foreground">{email}</strong>. Open it to activate your account.</>}
      footer={<>Already confirmed? <Link href="/login" className="font-semibold text-brand hover:underline">Sign in</Link></>}
    >
      <div className="space-y-3">
        {state === "sent" && <FormAlert tone="success">A new link is on its way.</FormAlert>}
        {state === "error" && <FormAlert tone="error">We could not send the email. Please try again in a minute.</FormAlert>}
        <p className="text-sm text-muted-foreground">The link works for 24 hours. Can&apos;t find it? Check your spam folder.</p>
        <Button onClick={resend} disabled={state === "sending"} variant="outline" className="h-11 w-full rounded-full font-semibold">
          {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend email"}
        </Button>
        <ContinueShopping variant="outline" />
        <button onClick={onBack} className="w-full text-sm font-medium text-muted-foreground hover:text-foreground">
          Used the wrong email? Start again
        </button>
      </div>
    </AuthShell>
  );
}

function SignupFlow() {
  const router = useRouter();
  const params = useSearchParams();
  // "Sell on Pakalale" links here with ?as=seller to skip straight to the shop form.
  const sellerIntent = params.get("as") === "seller";
  const { login, logout, isAuthenticated, user, hasCheckedSession, validateSession } = useAuthStore();
  // Set once this page signs the new account in and hands off, so the guest
  // guard below does not race it to the home page.
  const [leaving, setLeaving] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(sellerIntent ? "shop_owner" : null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [sentTo, setSentTo] = useState("");
  const form = useForm<SignupForm>();
  const { register, handleSubmit, formState: { errors } } = form;

  const next = safeNextPath(params.get("next"));

  // Keep the destination across the email round trip (the link opens in this browser).
  useEffect(() => {
    if (next) rememberReturnPath(next);
  }, [next]);

  // These pages sit outside the site layout, so confirm the session here.
  useEffect(() => {
    validateSession();
  }, [validateSession]);

  // Guests only: someone already signed in goes to the store, replacing this
  // entry so Back cannot return here. A buyer who came to sell stays to read
  // why they need a seller account.
  const buyerWantsToSell = sellerIntent && isAuthenticated && user?.role === "customer";
  useEffect(() => {
    if (leaving || !hasCheckedSession || buyerWantsToSell) return;
    if (isAuthenticated && user) router.replace("/");
  }, [leaving, hasCheckedSession, isAuthenticated, user, router, buyerWantsToSell]);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((data) => setLocations(data.locations || []))
      .catch(() => {});
  }, []);

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    setError("");
    try {
      const isShop = accountType === "shop_owner";
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          role: accountType,
          phone: data.phone,
          next: next ?? undefined,
          ...(isShop && {
            location: locations.find((l) => l.id === data.locationId)?.name || "",
            shop: {
              name: data.shopName,
              description: data.shopDescription,
              locationId: data.locationId,
              specialties: selectedSpecialties,
            },
          }),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Could not create your account");
        return;
      }

      if (result.verificationRequired) {
        setSentTo(data.email);
        return;
      }

      // Email confirmation is switched off: sign straight in.
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.user) {
        // Replace, not push: Back from the next page must not return here.
        setLeaving(true);
        const target = returnTarget(next);
        takeReturnPath();
        login(loginData.user);
        router.replace(destinationAfterLogin(loginData.user.role, target));
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (buyerWantsToSell) {
    return (
      <AuthShell
        illustration="shop"
        title="Open a shop on Pakalale"
        tagline="Reach buyers across Zambia."
        subtitle={<>You&apos;re signed in as <strong className="text-foreground">{user?.email}</strong>, a buyer account. Shops use a separate seller account, so register your shop with a different email address.</>}
      >
        <div className="space-y-2">
          <Button onClick={() => logout()} className="h-11 w-full rounded-full font-semibold">
            Sign out and register a shop
          </Button>
          <ContinueShopping variant="outline" />
        </div>
      </AuthShell>
    );
  }

  if (sentTo) return <CheckYourEmail email={sentTo} onBack={() => { setSentTo(""); form.reset(); }} />;

  const signInLink = (
    <>Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-brand hover:underline">Sign in</Link></>
  );

  if (!accountType) {
    const options = [
      { type: "customer" as const, icon: ShoppingBag, title: "I want to shop", text: "Browse local shops, save favourites and order." },
      { type: "shop_owner" as const, icon: Building2, title: "I want to sell", text: "Open your shop, list products and reach buyers." },
    ];
    return (
      <AuthShell illustration="shop" title="Create your account" subtitle="How will you use PakalaleMarket.com?" tagline="Your market, in your pocket." footer={signInLink}>
        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option.type}
              onClick={() => { setAccountType(option.type); setError(""); }}
              className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-brand/30 hover:bg-brand/5"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-brand">
                <option.icon className="h-6 w-6" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{option.title}</span>
                <span className="block text-xs text-muted-foreground">{option.text}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </AuthShell>
    );
  }

  const isShop = accountType === "shop_owner";

  return (
    <AuthShell
      illustration={isShop ? "shop" : "welcome"}
      title={isShop ? "Open your shop" : "Create your account"}
      subtitle={isShop ? "Tell us about you and your shop." : "Just the basics. It takes a minute."}
      tagline={isShop ? "Reach buyers across Zambia." : "Your market, in your pocket."}
      footer={signInLink}
    >
      <button onClick={() => { setAccountType(null); setError(""); }} className="-mt-2 mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Change account type
      </button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
        {error && <FormAlert tone="error">{error}</FormAlert>}

        {!isShop && (
          <>
            <GoogleButton next={next} label="Sign up with Google" onError={setError} />
            <OrDivider text="or use your email" />
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName?.message}>
            <Input autoComplete="given-name" className={inputClass} {...register("firstName", { required: "Required" })} />
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            <Input autoComplete="family-name" className={inputClass} {...register("lastName", { required: "Required" })} />
          </Field>
        </div>

        <Field label="Email" error={errors.email?.message}>
          <IconInput icon={Mail}>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={`${inputClass} pl-10`}
              {...register("email", {
                required: "Required",
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address" },
              })}
            />
          </IconInput>
        </Field>

        <Field label={isShop ? "Phone" : "Phone (optional)"} error={errors.phone?.message}>
          <IconInput icon={Phone}>
            <Input type="tel" autoComplete="tel" placeholder="+260 9X XXX XXXX" className={`${inputClass} pl-10`} {...register("phone", isShop ? { required: "Required" } : {})} />
          </IconInput>
        </Field>

        {isShop && (
          <>
            <p className="flex items-center gap-1.5 border-t border-border pt-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Shop details
            </p>
            <Field label="Shop name" error={errors.shopName?.message}>
              <Input placeholder="e.g. TechHub Zambia" className={inputClass} {...register("shopName", { required: "Required" })} />
            </Field>
            <Field label="Market" error={errors.locationId?.message}>
              <IconInput icon={MapPin}>
                <select {...register("locationId", { required: "Choose a market" })} className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Select a market</option>
                  {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                </select>
              </IconInput>
            </Field>
            <Field label="What do you sell?" error={errors.shopDescription?.message}>
              <textarea {...register("shopDescription", { required: "Required" })} rows={2} placeholder="A short description of your shop" className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </Field>
            <Field label="Specialties">
              <SpecialtyPicker value={selectedSpecialties} onChange={setSelectedSpecialties} />
            </Field>
          </>
        )}

        <PasswordFields form={form} show={showPassword} onToggle={() => setShowPassword(!showPassword)} />

        {isShop && (
          <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
            Our team reviews new shops before they go live. We&apos;ll let you know once you&apos;re verified.
          </p>
        )}

        <Button type="submit" disabled={isLoading || (isShop && selectedSpecialties.length === 0)} className="h-11 w-full rounded-full text-sm font-semibold">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{isShop ? "Create shop account" : "Create account"} <ArrowRight className="ml-1 h-4 w-4" /></>}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupFlow />
    </Suspense>
  );
}
