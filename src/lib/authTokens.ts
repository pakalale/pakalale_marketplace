import { createHash, randomBytes } from "node:crypto";

export function createEmailToken() {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashEmailToken(token) };
}

export function hashEmailToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;