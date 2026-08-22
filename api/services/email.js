const nodemailer = require('nodemailer');

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || '';
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'Eco Green Solar ERP';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'Eco Green Solar ERP <onboarding@resend.dev>';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const OTP_TTL_MINUTES = 5;

let mailer = null;
if (SMTP_USER && SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000, // fail fast instead of hanging for 60s+
  });
}

if (!BREVO_API_KEY && !RESEND_API_KEY && !mailer) {
  console.warn('[Email OTP] No email service configured (BREVO_API_KEY / RESEND_API_KEY / SMTP_USER+SMTP_PASS) — OTPs will be printed to this console instead of emailed. See comment above for setup.');
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

async function sendOtpEmail(toEmail, otp, customSubject, customBody) {
  const subject = customSubject || 'Your Eco Green Solar ERP Login OTP';
  const text = customBody || `Your OTP is ${otp}. It is valid for ${OTP_TTL_MINUTES} minutes. Do not share this code with anyone.`;
  const html = customBody ? `<div style="font-family:sans-serif; padding:16px; color:#222;"><h2 style="color:#008080;">Eco Green Solar ERP</h2><p style="font-size:14px; line-height:1.5;">${customBody.replace(/\n/g, '<br>')}</p></div>` : `<p>Your OTP is <strong style="font-size:20px;">${otp}</strong>.</p><p>It is valid for ${OTP_TTL_MINUTES} minutes. Do not share this code with anyone.</p>`;

  const errors = [];

  // Try Brevo first — no SMTP port involved (works on Render's free tier),
  // and the domain-authenticated sender can email anyone.
  if (BREVO_API_KEY) {
    if (!BREVO_FROM_EMAIL) {
      errors.push('Brevo: BREVO_FROM_EMAIL is not set.');
    } else {
      try {
        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            sender: { name: BREVO_FROM_NAME, email: BREVO_FROM_EMAIL },
            to: [{ email: toEmail }],
            subject,
            textContent: text,
            htmlContent: html,
          }),
        });
        if (!resp.ok) {
          const detail = await resp.text().catch(() => '');
          throw new Error(`Brevo API error (${resp.status}): ${detail || resp.statusText}`);
        }
        return; // sent successfully — stop here
      } catch (e) {
        console.warn('[Email OTP] Brevo failed, trying next configured service:', e.message);
        errors.push(`Brevo: ${e.message}`);
      }
    }
  }

  // Fall back to Resend if Brevo failed or is not configured (only reaches
  // recipients other than the account owner once a domain is verified there
  // — otherwise it only works for testing).
  if (RESEND_API_KEY) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: RESEND_FROM, to: [toEmail], subject, text, html }),
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => '');
        throw new Error(`Resend API error (${resp.status}): ${detail || resp.statusText}`);
      }
      return; // sent successfully — stop here
    } catch (e) {
      console.warn('[Email OTP] Resend failed, trying next configured service:', e.message);
      errors.push(`Resend: ${e.message}`);
    }
  }

  // Finally, fall back to plain SMTP (only works if the host allows
  // outbound SMTP — Render's free tier does not).
  if (mailer) {
    try {
      await mailer.sendMail({ from: `"Eco Green Solar ERP" <${SMTP_USER}>`, to: toEmail, subject, text, html });
      return; // sent successfully — stop here
    } catch (e) {
      errors.push(`SMTP: ${e.message}`);
    }
  }

  if (errors.length) {
    // Every configured service failed — surface all the reasons together.
    throw new Error(errors.join(' | '));
  }

  // Nothing configured at all — don't crash, just log it so login still works.
  console.log(`[Email OTP] (no email service configured) OTP for ${toEmail}: ${otp}`);
}

function maskEmail(email) {
  const [name, domain] = String(email).split('@');
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 1))}@${domain}`;
}

module.exports = { OTP_TTL_MINUTES, generateOtp, sendOtpEmail, maskEmail };
