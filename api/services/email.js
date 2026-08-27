// api/services/email.js
// ---------------------------------------------------------------------------
// Enterprise Email Dispatch Engine with Zoho Mail / SMTP Integration,
// Multi-provider fallback (Brevo, Resend), and Attachment Support.
// ---------------------------------------------------------------------------

const nodemailer = require('nodemailer');

const OTP_TTL_MINUTES = 5;

/**
 * Creates and returns a configured Nodemailer transporter from environment variables.
 */
function getSmtpTransporter() {
  const host = process.env.SMTP_HOST || 'smtppro.zoho.in';
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const secure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

/**
 * Verifies SMTP connection health.
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function verifySmtpConnection() {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    return { success: false, message: 'SMTP_USER or SMTP_PASS not configured in .env' };
  }
  try {
    await transporter.verify();
    return { success: true, message: 'SMTP server is ready to deliver messages.' };
  } catch (err) {
    return { success: false, message: err.message, error: err };
  }
}

/**
 * Generic reusable email sending function.
 * Supports: HTML, Plain text, Attachments, Custom Sender, CC/BCC.
 * 
 * @param {Object} options
 * @param {string|Array<string>} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject line
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.html] - HTML body
 * @param {string} [options.from] - Custom sender (defaults to SMTP_FROM / SMTP_USER)
 * @param {string|Array<string>} [options.cc] - Carbon copy recipients
 * @param {string|Array<string>} [options.bcc] - Blind carbon copy recipients
 * @param {Array<Object>} [options.attachments] - Array of nodemailer attachment objects
 * @returns {Promise<{success: boolean, messageId?: string, provider: string}>}
 */
async function sendEmail({ to, subject, text, html, from, cc, bcc, attachments = [] }) {
  if (!to) {
    throw new Error('Recipient email (to) is required.');
  }
  if (!subject) {
    throw new Error('Email subject is required.');
  }

  const errors = [];
  const toList = Array.isArray(to) ? to.join(', ') : to;

  const defaultFromName = process.env.SMTP_FROM_NAME || 'Eco Green Solar ERP';
  const defaultFromUser = process.env.SMTP_USER || 'info@vprotech.online';
  const defaultSender = process.env.SMTP_FROM || `"${defaultFromName}" <${defaultFromUser}>`;
  const senderAddress = from || defaultSender;

  // 1. Primary: Zoho Mail / Custom SMTP Transporter
  const mailer = getSmtpTransporter();
  if (mailer) {
    try {
      const info = await mailer.sendMail({
        from: senderAddress,
        to: toList,
        cc,
        bcc,
        subject,
        text,
        html,
        attachments
      });
      return { success: true, messageId: info.messageId, provider: 'smtp' };
    } catch (err) {
      console.warn('[Email Service] SMTP dispatch failed, checking fallback providers:', err.message);
      errors.push(`SMTP (${process.env.SMTP_HOST || 'Zoho'}): ${err.message}`);
    }
  }

  // 2. Secondary Fallback: Brevo API
  const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
  const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || '';
  const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || defaultFromName;

  if (BREVO_API_KEY && BREVO_FROM_EMAIL) {
    try {
      const recipientArray = (Array.isArray(to) ? to : [to]).map(e => ({ email: e.trim() }));
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: BREVO_FROM_NAME, email: BREVO_FROM_EMAIL },
          to: recipientArray,
          subject,
          textContent: text || '',
          htmlContent: html || text || '',
        }),
      });

      if (!resp.ok) {
        const detail = await resp.text().catch(() => '');
        throw new Error(`Brevo API error (${resp.status}): ${detail || resp.statusText}`);
      }
      return { success: true, provider: 'brevo' };
    } catch (err) {
      console.warn('[Email Service] Brevo fallback failed:', err.message);
      errors.push(`Brevo: ${err.message}`);
    }
  }

  // 3. Tertiary Fallback: Resend API
  const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
  const RESEND_FROM = process.env.RESEND_FROM || `Eco Green Solar ERP <onboarding@resend.dev>`;

  if (RESEND_API_KEY) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: Array.isArray(to) ? to : [to],
          subject,
          text,
          html
        }),
      });

      if (!resp.ok) {
        const detail = await resp.text().catch(() => '');
        throw new Error(`Resend API error (${resp.status}): ${detail || resp.statusText}`);
      }
      return { success: true, provider: 'resend' };
    } catch (err) {
      console.warn('[Email Service] Resend fallback failed:', err.message);
      errors.push(`Resend: ${err.message}`);
    }
  }

  // If providers were configured and all failed
  if (errors.length > 0) {
    throw new Error(`Email delivery failed across configured services: ${errors.join(' | ')}`);
  }

  // If no providers are configured at all (dev mock)
  console.log(`[Email Service] (No active email provider) Message for ${toList}: Subject: "${subject}"`);
  return { success: true, provider: 'mock' };
}

/**
 * Generates a random 6-digit numeric OTP code.
 */
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Sends a standardized OTP verification email (used by Auth and Password Reset flows).
 */
async function sendOtpEmail(toEmail, otp, customSubject, customBody) {
  const subject = customSubject || 'Your Eco Green Solar ERP Login OTP';
  const text = customBody || `Your OTP is ${otp}. It is valid for ${OTP_TTL_MINUTES} minutes. Do not share this code with anyone.`;
  const html = customBody
    ? `<div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #059669; margin: 0 0 16px 0;">Eco Green Solar ERP</h2>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">${customBody.replace(/\n/g, '<br>')}</p>
        <div style="background: #f1f5f9; padding: 14px 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0f172a; font-family: monospace;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #64748b;">This OTP is valid for ${OTP_TTL_MINUTES} minutes. Do not disclose this OTP to anyone.</p>
       </div>`
    : `<div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #059669; margin: 0 0 16px 0;">Eco Green Solar ERP</h2>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">Use the following One-Time Password (OTP) to securely access your account:</p>
        <div style="background: #f1f5f9; padding: 14px 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0f172a; font-family: monospace;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #64748b;">This OTP is valid for ${OTP_TTL_MINUTES} minutes. Do not disclose this OTP to anyone.</p>
       </div>`;

  await sendEmail({
    to: toEmail,
    subject,
    text,
    html
  });
}

/**
 * Masks an email for privacy display in the UI (e.g., in**@vprotech.online)
 */
function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 1))}@${domain}`;
}

module.exports = {
  OTP_TTL_MINUTES,
  getSmtpTransporter,
  verifySmtpConnection,
  sendEmail,
  sendOtpEmail,
  generateOtp,
  maskEmail
};
