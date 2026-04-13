import nodemailer from 'nodemailer';
import crypto from 'crypto';

let emailTransporter: nodemailer.Transporter | null = null;

function getMailConfig() {
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || '';
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
  const fromEmail = process.env.SMTP_FROM_EMAIL || smtpUser || 'sherbing.contact@gmail.com';
  const fromName = process.env.SMTP_FROM_NAME || 'Sherbing';

  return { smtpUser, smtpPass, fromEmail, fromName };
}

function getEmailTransporter() {
  if (emailTransporter) return emailTransporter;

  const { smtpUser, smtpPass } = getMailConfig();
  if (!smtpUser || !smtpPass) return null;

  emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') !== 'false',
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return emailTransporter;
}

async function sendMail(options: { to: string; subject: string; html: string; text: string }) {
  const mailer = getEmailTransporter();
  if (!mailer) {
    return { success: false, error: 'Email service not configured' };
  }

  const { fromEmail, fromName } = getMailConfig();

  try {
    await mailer.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: fromEmail,
    });

    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send email' };
  }
}

export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function sendVerificationEmail(
  email: string,
  code: string,
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  return sendMail({
    to: email,
    subject: 'Verify Your Sherbing Account',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin: 0 0 16px;">Welcome to Sherbing, ${fullName}!</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 36px; font-weight: 700; letter-spacing: 6px; margin: 16px 0; color: #16a34a;">${code}</div>
        <p>Enter this code on the verification page. It expires in 10 minutes.</p>
        <p style="color: #6b7280; font-size: 12px;">If you didn't sign up for Sherbing, you can safely ignore this email.</p>
      </div>
    `,
    text: `Welcome to Sherbing, ${fullName}!\n\nYour verification code is: ${code}\n\nEnter this code on the verification page. It expires in 10 minutes.\n\nIf you didn't sign up for Sherbing, you can safely ignore this email.`,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  fullName: string,
  resetLink: string
): Promise<{ success: boolean; error?: string }> {
  return sendMail({
    to: email,
    subject: 'Reset Your Sherbing Password',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin: 0 0 16px;">Password Reset Request</h2>
        <p>Hi ${fullName},</p>
        <p>We received a request to reset your Sherbing password. Click the link below to create a new password:</p>
        <p style="margin: 20px 0;">
          <a href="${resetLink}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Reset Password</a>
        </p>
        <p style="color: #6b7280; font-size: 12px;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 12px;">Or copy and paste this link in your browser: <a href="${resetLink}" style="color: #16a34a;">${resetLink}</a></p>
      </div>
    `,
    text: `Password Reset Request\n\nHi ${fullName},\n\nWe received a request to reset your Sherbing password. Visit this link to create a new password:\n\n${resetLink}\n\nThis link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.`,
  });
}

export async function sendBookingConfirmation(
  email: string,
  fullName: string,
  bookingId: string,
  services: string,
  address: string,
  price: number,
  scheduledDate?: string,
  scheduledTime?: string
): Promise<{ success: boolean; error?: string }> {
  const scheduledInfo = scheduledDate ? `<p><strong>Scheduled Date:</strong> ${new Date(scheduledDate).toLocaleDateString()} ${scheduledTime || 'TBD'}</p>` : '';

  return sendMail({
    to: email,
    subject: `Booking Confirmed: ${bookingId}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin: 0 0 16px;">Your Booking is Confirmed!</h2>
        <p>Hi ${fullName},</p>
        <p>Thank you for booking with Sherbing. Here are your booking details:</p>
        <p><strong>Booking ID:</strong> ${bookingId}</p>
        <p><strong>Services:</strong> ${services}</p>
        <p><strong>Address:</strong> ${address}</p>
        ${scheduledInfo}
        <p><strong>Estimated Price:</strong> $${price.toFixed(2)}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p>We'll contact you soon to confirm your appointment. You can manage your booking at <a href="https://sherbing.com/account">sherbing.com/account</a></p>
        <p>Questions? Contact us anytime at ${process.env.SMTP_FROM_EMAIL || 'sherbing.contact@gmail.com'}</p>
      </div>
    `,
    text: `Your Booking is Confirmed!\n\nBooking ID: ${bookingId}\nServices: ${services}\nAddress: ${address}\nEstimated Price: $${price.toFixed(2)}\n\nManage your booking at sherbing.com/account`,
  });
}
