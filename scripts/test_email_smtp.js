// scripts/test_email_smtp.js
require('dotenv').config();
const nodemailer = require('nodemailer');

const {
  SMTP_HOST = 'smtppro.zoho.in',
  SMTP_PORT = 465,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  SMTP_FROM_NAME = 'Eco Green Solar ERP'
} = process.env;

const targetToEmail = process.argv[2] || SMTP_USER || 'admin@ecogreensolar.co.in';

console.log('====================================================');
console.log('       ZOHO / SMTP EMAIL CONFIGURATION TEST');
console.log('====================================================');
console.log('SMTP Host      :', SMTP_HOST);
console.log('SMTP Port      :', SMTP_PORT);
console.log('SMTP Secure    :', SMTP_SECURE !== undefined ? SMTP_SECURE : (Number(SMTP_PORT) === 465));
console.log('SMTP User      :', SMTP_USER);
console.log('SMTP Password  :', SMTP_PASS ? '******** (' + SMTP_PASS.length + ' chars)' : '[NOT SET]');
console.log('Recipient Email:', targetToEmail);
console.log('----------------------------------------------------');

if (!SMTP_USER || !SMTP_PASS) {
  console.error('❌ ERROR: SMTP_USER or SMTP_PASS is missing in .env file!');
  process.exit(1);
}

const isSecure = SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: isSecure,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000
});

async function runTest() {
  console.log('1. Verifying SMTP server connection & credentials...');
  try {
    await transporter.verify();
    console.log('✅ SMTP Connection & Authentication Successful!');
  } catch (err) {
    console.error('❌ SMTP Verification Failed:');
    console.error('   Message:', err.message);
    if (err.response) console.error('   Server Response:', err.response);
    if (err.code) console.error('   Error Code:', err.code);

    console.log('\n--- Troubleshooting Zoho Mail Error ---');
    console.log('1. "554 5.7.8 Access Restricted" means:');
    console.log('   a) If Two-Factor Authentication (2FA/TFA) is enabled on your Zoho account,');
    console.log('      you MUST use an "Application-Specific Password" (App Password) instead of your regular login password.');
    console.log('      👉 Go to: Zoho Accounts (accounts.zoho.in) -> Security -> App Passwords -> Generate New Password.');
    console.log('   b) Check if Outgoing SMTP Access is enabled for info@vprotech.online:');
    console.log('      👉 Go to: Zoho Mail -> Settings -> Mail Accounts -> Outgoing (SMTP) -> Ensure checkbox/toggle is Enabled.');
    console.log('   c) Verify your region domain: India (smtppro.zoho.in / smtp.zoho.in), US (smtppro.zoho.com / smtp.zoho.com).');
    process.exit(1);
  }

  console.log('\n2. Sending test email to:', targetToEmail);
  const senderAddress = SMTP_FROM || `"${SMTP_FROM_NAME}" <${SMTP_USER}>`;

  const mailOptions = {
    from: senderAddress,
    to: targetToEmail,
    subject: 'Eco Green Solar ERP — Zoho SMTP Test Email',
    text: `Hello,\n\nThis is a test email sent from Eco Green Solar ERP using Zoho Mail SMTP (${SMTP_HOST}:${SMTP_PORT}).\n\nTimestamp: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\nStatus: WORKING`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #059669; margin: 0;">Eco Green Solar ERP</h2>
          <span style="font-size: 13px; color: #64748b;">Enterprise Mail Delivery Engine</span>
        </div>
        <p style="font-size: 15px; color: #1e293b; line-height: 1.6;">
          Hello,
        </p>
        <p style="font-size: 15px; color: #1e293b; line-height: 1.6;">
          Your <strong>Zoho Mail SMTP</strong> integration is working successfully! The ERP system is now fully configured to send automated notifications, OTPs, challans, and reports.
        </p>
        <div style="background: #f8fafc; border-left: 4px solid #059669; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
          <div style="font-size: 13px; color: #334155; margin-bottom: 4px;"><strong>SMTP Server:</strong> ${SMTP_HOST}:${SMTP_PORT}</div>
          <div style="font-size: 13px; color: #334155; margin-bottom: 4px;"><strong>Sender Account:</strong> ${SMTP_USER}</div>
          <div style="font-size: 13px; color: #334155;"><strong>Sent At:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
        </div>
        <p style="font-size: 13px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
          This is an automated test message from Eco Green Solar ERP.
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
    console.log('   Message ID:', info.messageId);
    console.log('   Response  :', info.response);
    console.log('\n🎉 Zoho SMTP Integration is working 100% properly!');
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
    process.exit(1);
  }
}

runTest();
