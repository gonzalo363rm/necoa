const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const BREVO_SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL') ?? 'noreply@necoa.app';
const BREVO_SENDER_NAME = Deno.env.get('BREVO_SENDER_NAME') ?? 'Necoa';

export function isEmailConfigured() {
  return Boolean(BREVO_API_KEY);
}

/** Envía mail vía API transaccional de Brevo. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
      ...(opts.text ? { textContent: opts.text } : {}),
      // Evita wraps sendibt2.com que rompen deep links / demoran el redirect.
      headers: {
        'X-Mailin-custom': 'necoa-invite',
        'charset': 'utf-8',
      },
      params: {
        // Algunos planes leen esto vía config de cuenta; el HTML usa solo HTTPS.
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo error ${res.status}: ${body}`);
  }

  return { sent: true as const };
}
