"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GOOGLE_AUTH_CHANNEL, type GoogleAuthMessage } from "@/components/auth/GoogleButton";

function GoogleDone() {
  const params = useSearchParams();

  useEffect(() => {
    const ok = params.get("status") === "done";
    const message: GoogleAuthMessage = {
      type: "google-auth",
      status: ok ? "done" : "error",
      error: ok ? undefined : params.get("error") || "google_failed",
    };
    try {
      const channel = new BroadcastChannel(GOOGLE_AUTH_CHANNEL);
      channel.postMessage(message);
      channel.close();
    } catch {
      // The opener message supports browsers without BroadcastChannel.
    }
    try {
      window.opener?.postMessage(message, window.location.origin);
    } catch {
      // The opener may have been closed.
    }
    window.close();
  }, [params]);

  return <main className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">Finishing Google sign-in...</main>;
}

export default function GoogleDonePage() {
  return <Suspense><GoogleDone /></Suspense>;
}