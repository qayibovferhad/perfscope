import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/index.js';

let transporter: Transporter | null | undefined;

/** Lazily built from SMTP_* env; null (disabled) when SMTP_HOST is not set. */
function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!config.smtp.host) {
    console.warn('[Mailer] SMTP_HOST not set — email alerts disabled');
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host:   config.smtp.host,
    port:   config.smtp.port,
    secure: config.smtp.secure,
    ...(config.smtp.user
      ? { auth: { user: config.smtp.user, pass: config.smtp.pass ?? '' } }
      : {}),
  });
  return transporter;
}

export const Mailer = {
  isAvailable(): boolean {
    return Boolean(config.smtp.host);
  },

  async send(to: string, subject: string, text: string, html?: string): Promise<void> {
    const t = getTransporter();
    if (!t) return;
    await t.sendMail({ from: config.smtp.from, to, subject, text, ...(html ? { html } : {}) });
  },
};
