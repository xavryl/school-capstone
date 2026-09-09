import 'server-only';

/**
 * Brevo transactional email. 300 messages a day on the free tier, and unlike
 * most free email APIs it will send to arbitrary addresses without you owning
 * a domain first -- which is why it is here rather than Resend.
 *
 * Missing key = no-op. The app stays usable before you have credentials, and
 * the console line tells you what would have gone out.
 */
type Mail = { to: string; subject: string; text: string };

export async function sendMail({ to, subject, text }: Mail): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!key || !from) {
    console.info(`[email skipped: no BREVO_API_KEY] to=${to} subject=${subject}`);
    return false;
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: from, name: process.env.MAIL_FROM_NAME ?? 'One-Stop Services' },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });
    if (!res.ok) {
      console.error(`[email failed ${res.status}] ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    // Never let a mail outage break the transaction that triggered it.
    console.error('[email error]', err);
    return false;
  }
}

export function statusEmail(reference: string, status: string, note: string | null) {
  const label: Record<string, string> = {
    pending: 'is queued for processing',
    processing: 'is being processed',
    ready: 'is ready for pickup',
    completed: 'has been released',
    cancelled: 'has been cancelled',
  };
  return {
    subject: `Request ${reference} — ${status}`,
    text:
      `Your request ${reference} ${label[status] ?? `is now ${status}`}.\n\n` +
      (note ? `Note from the office: ${note}\n\n` : '') +
      `Track it any time at /track/${reference}\n`,
  };
}
