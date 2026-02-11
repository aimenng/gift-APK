import nodemailer from 'nodemailer';
import { config } from './config.js';

let transporter;

const buildError = (message) => {
  const error = new Error(message);
  error.status = 500;
  return error;
};

const getTransporter = () => {
  if (transporter) return transporter;

  const { host, port, secure, user, pass } = config.smtp;
  if (!host || !user || !pass || !config.smtp.from) {
    throw buildError(
      'SMTP is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.'
    );
  }

  // In serverless environments (Vercel), avoid pooled connections —
  // each invocation may be a fresh container, so pool keep-alive adds overhead.
  const isServerless = !!process.env.VERCEL;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(isServerless
      ? { pool: false }
      : { pool: true, maxConnections: 5, maxMessages: 100 }),
    connectionTimeout: 15_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
};

const sendMail = async ({ to, subject, text, html }) => {
  const mailer = getTransporter();
  await mailer.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
    html,
  });
};

export const sendSignupCodeEmail = async (toEmail, code) => {
  const ttlMinutes = config.verificationCodeTtlMinutes;
  const subject = '【Gifts】邮箱验证码';
  const text = `你的 Gifts 注册验证码是 ${code}，${ttlMinutes} 分钟内有效。`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1f2937;">
      <h2 style="margin:0 0 12px;">Gifts 邮箱验证</h2>
      <p>你的验证码如下：</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:12px 0;color:#64723f;">${code}</p>
      <p>验证码 <strong>${ttlMinutes} 分钟</strong>内有效，请勿泄露给他人。</p>
    </div>
  `;

  await sendMail({
    to: toEmail,
    subject,
    text,
    html,
  });
};

export const sendPasswordResetCodeEmail = async (toEmail, code) => {
  const ttlMinutes = config.verificationCodeTtlMinutes;
  const subject = '【Gifts】重置密码验证码';
  const text = `你的 Gifts 重置密码验证码是 ${code}，${ttlMinutes} 分钟内有效。`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1f2937;">
      <h2 style="margin:0 0 12px;">Gifts 重置密码</h2>
      <p>你的验证码如下：</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:12px 0;color:#64723f;">${code}</p>
      <p>验证码 <strong>${ttlMinutes} 分钟</strong>内有效，请勿泄露给他人。</p>
      <p style="font-size:12px;color:#6b7280;">如果这不是你的操作，请忽略本邮件并尽快修改邮箱密码。</p>
    </div>
  `;

  await sendMail({
    to: toEmail,
    subject,
    text,
    html,
  });
};

export const sendBindingConfirmEmail = async ({
  toEmail,
  requesterName,
  requesterEmail,
  inviteCode,
  confirmUrl,
}) => {
  const ttlHours = config.bindingRequestTtlHours;
  const subject = '【Gifts】关系绑定确认请求';
  const text = `${requesterName} (${requesterEmail}) 希望绑定你的邀请码 ${inviteCode}。请在 ${ttlHours} 小时内打开此链接确认：${confirmUrl}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.7;color:#1f2937;">
      <h2 style="margin:0 0 12px;">Gifts 关系绑定确认</h2>
      <p><strong>${requesterName}</strong>（${requesterEmail}）正在请求绑定你的邀请码：</p>
      <p style="font-size:20px;font-weight:700;letter-spacing:2px;margin:10px 0;color:#64723f;">${inviteCode}</p>
      <p>请在 ${ttlHours} 小时内点击下面按钮确认：</p>
      <p style="margin:18px 0;">
        <a href="${confirmUrl}" style="display:inline-block;padding:10px 18px;background:#64723f;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
          同意绑定
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280;">如果不是你本人操作，请忽略这封邮件。</p>
    </div>
  `;

  await sendMail({
    to: toEmail,
    subject,
    text,
    html,
  });
};
