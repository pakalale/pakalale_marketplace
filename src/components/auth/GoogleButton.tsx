"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { destinationAfterLogin, returnTarget, takeReturnPath } from "@/lib/authRedirect";
import { useAuthStore } from "@/store/authStore";

export const GOOGLE_AUTH_CHANNEL = "pakalale-google-auth";

export interface GoogleAuthMessage {
  type: "google-auth";
  status: "done" | "error";
  error?: string;
}

export const GOOGLE_ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in isn't available right now. Please use your email and password.",
  google_cancelled: "Google sign-in was cancelled.",
  google_unverified: "Your Google account's email isn't verified, so we can't use it to sign you in.",
  google_failed: "We couldn't sign you in with Google. Please try again.",
};

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * "Continue with Google". Google's pages open in a popup, so this tab's
 * history never contains them and Back after signing in cannot land there.
 * When the popup reports success, this tab signs in and replaces the sign-in
 * page with the page the person came from. If popups are blocked, it falls
 * back to a full-page redirect.
 */
export default function GoogleButton({
  next,
  label = "Continue with Google",
  onError,
}: {
  next?: string | null;
  label?: string;
  onError?: (message: string) => void;
}) {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [waiting, setWaiting] = useState(false);
  const waitingRef = useRef(false);
  const targetRef = useRef<string | null>(null);
  useEffect(() => {
    const handle = async (data: unknown) => {
      const message = data as GoogleAuthMessage | null;
      // Only the tab that opened the popup acts, and only once (the popup
      // reports on two channels).
      if (message?.type !== "google-auth" || !waitingRef.current) return;
      waitingRef.current = false;
      setWaiting(false);

      if (message.status !== "done") {
        onError?.(GOOGLE_ERRORS[message.error ?? ""] ?? GOOGLE_ERRORS.google_failed);
        return;
      }
      try {
        const res = await fetch("/api/auth/me");
        const body = await res.json();
        if (!res.ok || !body.user) throw new Error();
        login(body.user);
        takeReturnPath();
        router.replace(destinationAfterLogin(body.user.role, targetRef.current));
      } catch {
        onError?.(GOOGLE_ERRORS.google_failed);
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(GOOGLE_AUTH_CHANNEL);
      channel.onmessage = (event) => handle(event.data);
    } catch {
      /* older browser: rely on postMessage from the popup */
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin) handle(event.data);
    };
    window.addEventListener("message", onMessage);
    return () => {
      channel?.close();
      window.removeEventListener("message", onMessage);
    };
  }, [login, router, onError]);

  const start = () => {
    const target = returnTarget(next);
    targetRef.current = target;
    const query = target ? `next=${encodeURIComponent(target)}` : "";

    const width = 480;
    const height = 640;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const popup = window.open(
      `/api/auth/google?mode=popup${query ? `&${query}` : ""}`,
      "pakalale-google",
      `popup,width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      // Popup blocked: go the long way round. Replacing this entry keeps the
      // sign-in page out of history; the callback returns to `target`.
      window.location.replace(`/api/auth/google${query ? `?${query}` : ""}`);
      return;
    }

    waitingRef.current = true;
    setWaiting(true);
    // Stop the spinner if the popup goes away. Keep listening: some browsers
    // report a cross-site popup as closed while it is still open.
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
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-70"
    >
      {waiting ? <Loader2 className="h-[18px] w-[18px] animate-spin text-brand" /> : <GoogleLogo />}
      {waiting ? "Waiting for Google..." : label}
    </button>
  );
}

export function OrDivider({ text = "or" }: { text?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {text}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
