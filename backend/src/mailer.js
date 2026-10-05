import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true", // true for port 465, false for STARTTLS (587)
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function sendVerificationEmail({ to, name, link }) {
  const mailer = getTransporter();
  if (!mailer) {
    // No SMTP configured: in development, print the link so sign-up can still be tested.
    if (process.env.NODE_ENV === "production") throw new Error("SMTP is not configured");
    console.warn(`[mailer] SMTP_HOST not set — verification link for ${to}:\n  ${link}`);
    return;
  }

  const greeting = name ? `Hi ${name},` : "Hi,";
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Verify your CiviGuide AI email address",
    text: `${greeting}\n\nConfirm your email address to finish creating your CiviGuide AI account:\n${link}\n\nThis link expires in 24 hours. If you didn't sign up, you can ignore this email.`,
    html: `<p>${escapeHtml(greeting)}</p>
<p>Confirm your email address to finish creating your CiviGuide AI account:</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">Verify email</a></p>
<p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${escapeHtml(link)}</p>
<p style="color:#666;font-size:13px">This link expires in 24 hours. If you didn't sign up, you can ignore this email.</p>`,
  });
}
