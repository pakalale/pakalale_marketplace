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
    secure: port === 465, // 465 is TLS from the start; 587 upgrades with STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export function isEmailConfigured() {
  return getTransporter() !== null;
}

/**
 * Whether new accounts must confirm their email. Without SMTP in production
 * we cannot send the link, so verification is skipped rather than locking new
 * users out; in development the link is printed to the server log instead.
 */
export function emailVerificationEnabled() {
  return isEmailConfigured() || process.env.NODE_ENV !== "production";
}

/** Base URL for links in emails. */
export function appUrl(request: NextRequest) {
  const configured = process.env.APP_URL || process.env.NEXTAUTH_URL;
  return (configured || request.nextUrl.origin).replace(/\/$/, "");
}

const BRAND_BLUE = "#002583";
const BRAND_YELLOW = "#ffb800";

function layout({ heading, body, cta, url, footnote }: { heading: string; body: string; cta: string; url: string; footnote: string }) {
  return `<!doctype html>
<html><body style="margin:0;background:#f5f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0b1736">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:${BRAND_BLUE};padding:20px 28px;color:#ffffff;font-size:18px;font-weight:700">
          <span style="color:${BRAND_YELLOW}">&#9679;</span> PakalaleMarket.com
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND_BLUE}">${heading}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6">${body}</p>
          <a href="${url}" style="display:inline-block;background:${BRAND_YELLOW};color:${BRAND_BLUE};font-weight:700;font-size:15px;text-decoration:none;padding:12px 28px;border-radius:999px">${cta}</a>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#5b6683">${footnote}<br>If the button does not work, copy this link:<br><span style="word-break:break-all">${url}</span></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function send(to: string, subject: string, html: string, text: string, url: string) {
  const transport = getTransporter();
  if (!transport) {
    // Development without SMTP: print the link so the flow can still be tested.
    console.info(`\n[email not configured] ${subject} for ${to}:\n${url}\n`);
    return;
  }
  await transport.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    text,
  });
}

export async function sendVerificationEmail(to: string, firstName: string, url: string) {
  const subject = "Confirm your email for PakalaleMarket.com";
  const html = layout({
    heading: `Welcome, ${escapeHtml(firstName)}!`,
    body: "Please confirm this is your email address to finish creating your account.",
    cta: "Confirm my email",
    url,
    footnote: "This link expires in 24 hours. If you did not create an account, you can ignore this email.",
  });
  const text = `Welcome, ${firstName}! Confirm your email to finish creating your account:\n${url}\n\nThis link expires in 24 hours.`;
  await send(to, subject, html, text, url);
}

export async function sendPasswordResetEmail(to: string, firstName: string, url: string) {
  const subject = "Reset your PakalaleMarket.com password";
  const html = layout({
    heading: "Reset your password",
    body: `Hi ${escapeHtml(firstName)}, we received a request to reset your password. Choose a new one with the button below.`,
    cta: "Choose a new password",
    url,
    footnote: "This link expires in 1 hour. If you did not ask for this, ignore this email and your password stays the same.",
  });
  const text = `Hi ${firstName}, reset your password here:\n${url}\n\nThis link expires in 1 hour. If you did not ask for this, ignore this email.`;
  await send(to, subject, html, text, url);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
