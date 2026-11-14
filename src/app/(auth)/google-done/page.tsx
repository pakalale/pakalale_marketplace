"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { GOOGLE_AUTH_CHANNEL, GOOGLE_ERRORS, type GoogleAuthMessage } from "@/components/auth/GoogleButton";

/**
 * The Google popup ends here. It tells the tab that opened it how sign-in
 * went, then closes. If the browser keeps it open (e.g. it opened as a tab),
 * the person can carry on from here.
 */
function GoogleDone() {
  const params = useSearchParams();
  const ok = params.get("status") === "done";
  const error = params.get("error") || "google_failed";
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const message: GoogleAuthMessage = { type: "google-auth", status: ok ? "done" : "error", error: ok ? undefined : error };
    try {
      const channel = new BroadcastChannel(GOOGLE_AUTH_CHANNEL);
      channel.postMessage(message);
      channel.close();
    } catch {
      /* older browser: the opener message below still works */
    }
    try {
      window.opener?.postMessage(message, window.location.origin);
    } catch {
      /* opener gone */
    }
    window.close();
    const timer = window.setTimeout(() => setStuck(true), 800);
    return () => window.clearTimeout(timer);
  }, [ok, error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <div className="max-w-sm">
        {!stuck ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
        ) : ok ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-3 text-xl font-bold text-brand">You&apos;re signed in</h1>
            <p className="mt-1 text-sm text-muted-foreground">You can close this window and go back to PakalaleMarket.</p>
            <button
              onClick={() => window.location.replace("/")}
              className="mt-5 h-11 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
            >
              Continue Shopping
            </button>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-3 text-xl font-bold text-brand">Google sign-in didn&apos;t finish</h1>
            <p className="mt-1 text-sm text-muted-foreground">{GOOGLE_ERRORS[error] ?? GOOGLE_ERRORS.google_failed}</p>
            <button
              onClick={() => window.location.replace("/login")}
              className="mt-5 h-11 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function GoogleDonePage() {
  return (
    <Suspense>
      <GoogleDone />
    </Suspense>
  );
}
