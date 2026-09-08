const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const BREVO_SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL') ?? 'noreply@necoa.app';
const BREVO_SENDER_NAME = Deno.env.get('BREVO_SENDER_NAME') ?? 'Necoa';

export function isEmailConfigured() {
  return Boolean(BREVO_API_KEY);
}

/** Envía mail vía API transaccional de Brevo (mismo cupo que SMTP; apto para Edge Functions). */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!BREVO_API_KEY) {
    return { sent: false as const, reason: 'BREVO_API_KEY missing' };
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo error ${res.status}: ${body}`);
  }

  return { sent: true as const };
}
