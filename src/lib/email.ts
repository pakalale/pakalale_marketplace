import nodemailer, { type Transporter } from "nodemailer";
import type { NextRequest } from "next/server";

let transporter: Transporter | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }
  const port = Number(SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export function emailVerificationEnabled() {
  return getTransporter() !== null || process.env.NODE_ENV !== "production";
}

export function appUrl(request: NextRequest) {
  const configured = process.env.APP_URL || process.env.NEXTAUTH_URL;
  return (configured || request.nextUrl.origin).replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export async function sendVerificationEmail(to: string, firstName: string, url: string) {
  const transport = getTransporter();
  if (!transport) {
    console.info(`[email not configured] Confirm account for ${to}: ${url}`);
    return;
  }

  const safeName = escapeHtml(firstName);
  const mail = {
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Confirm your email for PakalaleMarket.com",
    text: `Welcome, ${firstName}! Confirm your email to finish creating your account: ${url}\n\nThis link expires in 24 hours.`,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0b1736"><h1>Welcome, ${safeName}!</h1><p>Confirm your email to finish creating your Pakalale account.</p><p><a href="${url}">Confirm my email</a></p><p>This link expires in 24 hours. If you did not create an account, ignore this email.</p></body></html>`,
  };
  try {
    await transport.sendMail(mail);
  } catch (error) {
    // Fall back to the authenticated SMTP sender if a custom From address is rejected.
    if (mail.from !== process.env.SMTP_USER && process.env.SMTP_USER) {
      console.warn("Verification email send failed with configured From; retrying with SMTP user:", error);
      await transport.sendMail({ ...mail, from: process.env.SMTP_USER });
    } else {
      throw error;
    }
  }
}