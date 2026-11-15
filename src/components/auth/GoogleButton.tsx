"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { destinationAfterLogin, safeNextPath } from "@/lib/authRedirect";
import { useAuthStore } from "@/store/authStore";

export const GOOGLE_AUTH_CHANNEL = "pakalale-google-auth";

export interface GoogleAuthMessage {
  type: "google-auth";
  status: "done" | "error";
  error?: string;
}

export const GOOGLE_ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in is unavailable. Please use email and password.",
  google_cancelled: "Google sign-in was cancelled.",
  google_unverified: "Google did not confirm this email address.",
  google_email_needs_verification: "Confirm your email first, then try Google sign-in again.",
  google_account_type_exists: "This Google account is already linked to a non-customer account. Sign in with that account instead.",
  google_failed: "We could not sign you in with Google. Please try again.",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-[18px] w-[18px]">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function GoogleButton({
  onError,
  intent = "signin",
  label,
}: {
  onError?: (message: string) => void;
  intent?: "signin" | "signup";
  label?: string;
}) {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [waiting, setWaiting] = useState(false);
  const waitingRef = useRef(false);
  const targetRef = useRef<string | null>(null);

  useEffect(() => {
    const handle = async (data: unknown) => {
      const message = data as GoogleAuthMessage | null;
      if (message?.type !== "google-auth" || !waitingRef.current) return;
      waitingRef.current = false;
      setWaiting(false);
      if (message.status !== "done") {
        onError?.(GOOGLE_ERRORS[message.error || ""] || GOOGLE_ERRORS.google_failed);
        return;
      }

      try {
        const response = await fetch("/api/auth/me");
        const result = await response.json();
        if (!response.ok || !result.user) throw new Error("Session missing");
        login(result.user);
        sessionStorage.removeItem("redirectAfterLogin");
        router.replace(destinationAfterLogin(result.user.role, targetRef.current));
      } catch {
        onError?.(GOOGLE_ERRORS.google_failed);
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(GOOGLE_AUTH_CHANNEL);
      channel.onmessage = (event) => handle(event.data);
    } catch {
      // Older browsers use the opener message below.
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin) handle(event.data);
    };
    window.addEventListener("message", onMessage);
    return () => {
      channel?.close();
      window.removeEventListener("message", onMessage);
    };
  }, [login, onError, router]);

  const start = () => {
    const params = new URLSearchParams(window.location.search);
    targetRef.current = safeNextPath(params.get("next")) || safeNextPath(sessionStorage.getItem("redirectAfterLogin"));
    const query = new URLSearchParams({ intent });
    if (targetRef.current) query.set("next", targetRef.current);
    const width = 480;
    const height = 640;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const popup = window.open(
      `/api/auth/google?mode=popup&${query.toString()}`,
      "pakalale-google",
      `popup,width=${width},height=${height},left=${left},top=${top}`
    );
    if (!popup) {
      const redirectQuery = new URLSearchParams({ intent });
      if (targetRef.current) redirectQuery.set("next", targetRef.current);
      window.location.replace(`/api/auth/google?${redirectQuery.toString()}`);
      return;
    }

    waitingRef.current = true;
    setWaiting(true);
    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        setWaiting(false);
      }
    }, 700);
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={waiting}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-70"
    >
      {waiting ? <Loader2 className="h-[18px] w-[18px] animate-spin text-brand" /> : <GoogleMark />}
      {waiting ? "Waiting for Google..." : label || (intent === "signup" ? "Create customer account with Google" : "Sign in with Google")}
    </button>
  );
}