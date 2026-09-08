import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { isEmailConfigured, sendEmail } from '../_shared/email.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Tx = {
  type: 'expense' | 'income';
  amount: number;
  paid_by: string;
  category_override: 'living' | 'comfort' | null;
  tags: { category: 'living' | 'comfort' | 'other'; name: string } | null;
};

serve(async (_req) => {
  try {
    if (!isEmailConfigured()) {
      return new Response(JSON.stringify({ ok: false, reason: 'BREVO_API_KEY missing' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    const month = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const from = month.toISOString().slice(0, 10);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString().slice(0, 10);

    const { data: families, error } = await supabase.from('families').select('id, name');
    if (error) throw error;

    if (!families?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'No families yet' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;

    for (const family of families ?? []) {
      const [{ data: goals }, { data: members }, { data: transactions }] = await Promise.all([
        supabase.from('budget_goals').select('*').eq('family_id', family.id).maybeSingle(),
        supabase
          .from('family_members')
          .select('user_id, profiles(email, display_name)')
          .eq('family_id', family.id)
          .eq('status', 'active'),
        supabase
          .from('transactions')
          .select('type, amount, paid_by, category_override, tags(category, name)')
          .eq('family_id', family.id)
          .gte('occurred_at', from)
          .lte('occurred_at', to),
      ]);

      const txs = (transactions ?? []) as unknown as Tx[];
      let income = 0;
      let living = 0;
      let comfort = 0;
      let expenses = 0;
      const byMember: Record<string, number> = {};

      for (const tx of txs) {
        const amount = Number(tx.amount);
        if (tx.type === 'income') {
          income += amount;
          continue;
        }
        expenses += amount;
        byMember[tx.paid_by] = (byMember[tx.paid_by] ?? 0) + amount;
        const category = tx.category_override ?? tx.tags?.category ?? 'other';
        if (category === 'comfort') comfort += amount;
        else living += amount;
      }

      const savings = Math.max(0, income - expenses);
      const livingPct = income ? (living / income) * 100 : 0;
      const comfortPct = income ? (comfort / income) * 100 : 0;
      const savingsPct = income ? (savings / income) * 100 : 0;

      const html = `
        <h2>Resumen Necoa · ${family.name}</h2>
        <p>Período ${from} → ${to}</p>
        <ul>
          <li>Necesidades: ${livingPct.toFixed(0)}% (meta ${goals?.living_pct ?? 40}%)</li>
          <li>Comodidades: ${comfortPct.toFixed(0)}% (meta ${goals?.comfort_pct ?? 30}%)</li>
          <li>Ahorro: ${savingsPct.toFixed(0)}% (meta ${goals?.savings_pct ?? 30}%)</li>
        </ul>
        <h3>Gastos por miembro</h3>
        <ul>
          ${(members ?? [])
            .map((m) => {
              const profile = m.profiles as { display_name?: string } | null;
              const spent = byMember[m.user_id] ?? 0;
              return `<li>${profile?.display_name ?? m.user_id}: $${spent.toFixed(0)}</li>`;
            })
            .join('')}
        </ul>
      `;

      for (const m of members ?? []) {
        const profile = m.profiles as { email?: string } | null;
        if (!profile?.email) continue;
        await sendEmail({
          to: profile.email,
          subject: `Resumen mensual Necoa · ${family.name}`,
          html,
        });
        sent += 1;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
