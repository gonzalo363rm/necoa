import { addMonths, endOfMonth, format, parse, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

import type { FamilyMember, Tag, Transaction, TransactionType } from '@/src/types/domain';

export type Slice = {
  id: string;
  label: string;
  color: string;
  amount: number;
  pct: number;
};

export type MonthPoint = {
  month: string; // yyyy-MM
  label: string;
  amount: number;
};

export type TagSeries = {
  tagId: string;
  label: string;
  color: string;
  points: MonthPoint[];
};

function shareOf(tx: Transaction, userId: string): number {
  const splits = tx.splits ?? [];
  if (splits.length === 0) {
    return tx.paid_by === userId ? 1 : 0;
  }
  const found = splits.find((s) => s.user_id === userId);
  return found ? Number(found.share_pct) / 100 : 0;
}

export function lastNMonthKeys(anchorMonth: string, n: number): string[] {
  const base = parse(`${anchorMonth}-01`, 'yyyy-MM-dd', new Date());
  return Array.from({ length: n }, (_, i) => format(subMonths(base, n - 1 - i), 'yyyy-MM'));
}

/** Inclusive from first day of oldest month to last day of newest. */
export function monthSpanRange(anchorMonth: string, monthsBack: number) {
  const keys = lastNMonthKeys(anchorMonth, monthsBack);
  const first = parse(`${keys[0]}-01`, 'yyyy-MM-dd', new Date());
  const last = parse(`${keys[keys.length - 1]}-01`, 'yyyy-MM-dd', new Date());
  return {
    months: keys,
    from: format(startOfMonth(first), 'yyyy-MM-dd'),
    to: format(endOfMonth(last), 'yyyy-MM-dd'),
  };
}

export function expensesByTag(transactions: Transaction[], limit = 8): Slice[] {
  const map = new Map<string, { label: string; color: string; amount: number }>();
  let total = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const amount = Number(tx.amount);
    total += amount;
    const id = tx.tag_id ?? 'none';
    const label = tx.tag?.name ?? 'Sin etiqueta';
    const color = tx.tag?.color ?? '#64748B';
    const prev = map.get(id) ?? { label, color, amount: 0 };
    prev.amount += amount;
    map.set(id, prev);
  }

  const rows = [...map.entries()]
    .map(([id, row]) => ({
      id,
      label: row.label,
      color: row.color,
      amount: row.amount,
      pct: total > 0 ? (row.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  if (rows.length <= limit) return rows;

  const head = rows.slice(0, limit - 1);
  const rest = rows.slice(limit - 1);
  const otherAmount = rest.reduce((s, r) => s + r.amount, 0);
  return [
    ...head,
    {
      id: 'other',
      label: 'Otros',
      color: '#94A3B8',
      amount: otherAmount,
      pct: total > 0 ? (otherAmount / total) * 100 : 0,
    },
  ];
}

export function byMember(
  transactions: Transaction[],
  members: FamilyMember[],
  type: TransactionType,
): Slice[] {
  const colors = ['#0D9488', '#D97706', '#7C3AED', '#2563EB', '#DC2626', '#059669'];
  let total = 0;
  const amounts = new Map<string, number>();

  for (const m of members) amounts.set(m.user_id, 0);

  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const amount = Number(tx.amount);
    total += amount;
    for (const m of members) {
      const part = amount * shareOf(tx, m.user_id);
      amounts.set(m.user_id, (amounts.get(m.user_id) ?? 0) + part);
    }
  }

  return members
    .map((m, i) => {
      const amount = amounts.get(m.user_id) ?? 0;
      return {
        id: m.user_id,
        label: m.profile?.display_name ?? 'Miembro',
        color: colors[i % colors.length]!,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      };
    })
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function monthlyExpenseTotals(transactions: Transaction[], months: string[]): MonthPoint[] {
  const map = new Map(months.map((m) => [m, 0]));
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const key = tx.occurred_at.slice(0, 7);
    if (!map.has(key)) continue;
    map.set(key, (map.get(key) ?? 0) + Number(tx.amount));
  }
  return months.map((month) => {
    const d = parse(`${month}-01`, 'yyyy-MM-dd', new Date());
    return {
      month,
      label: format(d, 'MMM', { locale: es }),
      amount: map.get(month) ?? 0,
    };
  });
}

export function monthlyTotalsByTag(
  transactions: Transaction[],
  months: string[],
  tagIds?: string[] | null,
  topN = 4,
): TagSeries[] {
  const allowed =
    tagIds && tagIds.length > 0
      ? new Set(tagIds)
      : null;

  const totals = new Map<string, { label: string; color: string; byMonth: Map<string, number>; sum: number }>();

  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.tag_id) continue;
    if (allowed && !allowed.has(tx.tag_id)) continue;
    const key = tx.occurred_at.slice(0, 7);
    if (!months.includes(key)) continue;

    const entry =
      totals.get(tx.tag_id) ??
      ({
        label: tx.tag?.name ?? 'Tag',
        color: tx.tag?.color ?? '#64748B',
        byMonth: new Map(months.map((m) => [m, 0])),
        sum: 0,
      } satisfies { label: string; color: string; byMonth: Map<string, number>; sum: number });

    const amount = Number(tx.amount);
    entry.byMonth.set(key, (entry.byMonth.get(key) ?? 0) + amount);
    entry.sum += amount;
    entry.label = tx.tag?.name ?? entry.label;
    entry.color = tx.tag?.color ?? entry.color;
    totals.set(tx.tag_id, entry);
  }

  let series = [...totals.entries()].map(([tagId, row]) => ({
    tagId,
    label: row.label,
    color: row.color,
    sum: row.sum,
    points: months.map((month) => {
      const d = parse(`${month}-01`, 'yyyy-MM-dd', new Date());
      return {
        month,
        label: format(d, 'MMM', { locale: es }),
        amount: row.byMonth.get(month) ?? 0,
      };
    }),
  }));

  series.sort((a, b) => b.sum - a.sum);
  if (!allowed) series = series.slice(0, topN);

  return series.map(({ tagId, label, color, points }) => ({ tagId, label, color, points }));
}

export function categorySlices(transactions: Transaction[]): Slice[] {
  let living = 0;
  let comfort = 0;
  let other = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const amount = Number(tx.amount);
    const cat = tx.category_override ?? tx.tag?.category ?? 'other';
    if (cat === 'living') living += amount;
    else if (cat === 'comfort') comfort += amount;
    else other += amount;
  }
  const total = living + comfort + other;
  return [
    { id: 'living', label: 'Necesidades', color: '#0D9488', amount: living, pct: total ? (living / total) * 100 : 0 },
    { id: 'comfort', label: 'Comodidades', color: '#D97706', amount: comfort, pct: total ? (comfort / total) * 100 : 0 },
    { id: 'other', label: 'Otros', color: '#64748B', amount: other, pct: total ? (other / total) * 100 : 0 },
  ].filter((s) => s.amount > 0);
}

export function formatCompact(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(Math.round(amount));
}

export function tagFilterOptions(tags: Tag[], usedIds: string[]) {
  const used = new Set(usedIds);
  return tags.filter((t) => used.has(t.id));
}
