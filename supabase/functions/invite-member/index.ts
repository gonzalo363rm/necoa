import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { isEmailConfigured, sendEmail } from '../_shared/email.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_WEB_URL = Deno.env.get('APP_WEB_URL') ?? 'https://necoa.vercel.app';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    if (!isEmailConfigured()) {
      return jsonResponse(
        { error: 'Email no configurado: falta BREVO_API_KEY en secrets de la Edge Function' },
        503,
      );
    }

    const { family_id, email } = await req.json();
    if (!family_id || !email) {
      return jsonResponse({ error: 'family_id and email required' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: invite, error } = await supabase
      .from('family_invites')
      .select('token, families(name)')
      .eq('family_id', family_id)
      .eq('email', email)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!invite) {
      return jsonResponse({ error: 'Invite not found' }, 404);
    }

    const deepLink = `necoa://invite?token=${invite.token}`;
    const webLink = `${APP_WEB_URL}/invite?token=${invite.token}`;
    const familyName = (invite.families as { name?: string } | null)?.name ?? 'Grupo Familiar';

    await sendEmail({
      to: email,
      subject: `Te invitaron a ${familyName} en Necoa`,
      html: `
        <p>Te invitaron a compartir finanzas en <strong>${familyName}</strong> (Necoa).</p>
        <p><a href="${deepLink}">Abrir en la app</a></p>
        <p><a href="${webLink}">Abrir en el navegador</a></p>
      `,
    });

    return jsonResponse({ ok: true, sent: true, deepLink, webLink });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
