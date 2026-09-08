import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { isEmailConfigured, sendEmail } from '../_shared/email.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const { family_id, email } = await req.json();
    if (!family_id || !email) {
      return new Response(JSON.stringify({ error: 'family_id and email required' }), { status: 400 });
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
      return new Response(JSON.stringify({ error: 'Invite not found' }), { status: 404 });
    }

    const deepLink = `necoa://invite?token=${invite.token}`;
    const familyName = (invite.families as { name?: string } | null)?.name ?? 'tu familia';

    if (isEmailConfigured()) {
      await sendEmail({
        to: email,
        subject: `Te invitaron a ${familyName} en Necoa`,
        html: `<p>Te invitaron a compartir finanzas en <strong>Necoa</strong>.</p><p><a href="${deepLink}">Unirme a la familia</a></p>`,
      });
    }

    return new Response(JSON.stringify({ ok: true, deepLink }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
