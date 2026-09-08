import { endOfMonth, format, parse, startOfMonth } from 'date-fns';

import type { BudgetGoals, MonthBreakdown, Tag, TagCategory, Transaction } from '@/src/types/domain';

export function monthRange(month: string) {
  const date = parse(`${month}-01`, 'yyyy-MM-dd', new Date());
  return {
    from: format(startOfMonth(date), 'yyyy-MM-dd'),
    to: format(endOfMonth(date), 'yyyy-MM-dd'),
    label: format(date, 'MMMM yyyy'),
  };
}

export function resolveCategory(tx: Transaction, tag?: Tag | null): TagCategory | null {
  if (tx.type !== 'expense') return null;
  if (tx.category_override) return tx.category_override;
  return tag?.category ?? tx.tag?.category ?? 'other';
}

export function computeMonthBreakdown(
  transactions: Transaction[],
  goals?: BudgetGoals | null,
): MonthBreakdown & { goals: BudgetGoals | null } {
  let incomeTotal = 0;
  let expenseTotal = 0;
  let livingTotal = 0;
  let comfortTotal = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    if (tx.type === 'income') {
      incomeTotal += amount;
      continue;
    }
    expenseTotal += amount;
    const category = resolveCategory(tx);
    if (category === 'living') livingTotal += amount;
    else if (category === 'comfort') comfortTotal += amount;
    else {
      // "other" without override counts toward living by default for progress safety
      livingTotal += amount;
    }
  }

  const base = incomeTotal > 0 ? incomeTotal : 0;
  const savingsAmount = Math.max(0, incomeTotal - expenseTotal);
  const livingPct = base ? (livingTotal / base) * 100 : 0;
  const comfortPct = base ? (comfortTotal / base) * 100 : 0;
  const savingsPct = base ? (savingsAmount / base) * 100 : 0;

  return {
    incomeTotal,
    expenseTotal,
    livingTotal,
    comfortTotal,
    livingPct,
    comfortPct,
    savingsPct,
    savingsAmount,
    goals: goals ?? null,
  };
}

export function formatMoney(amount: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Acepta `1234,56`, `1.234,56` o `1234.56`. */
export function parseLocaleNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;

  const trimmed = value.trim().replace(/\s/g, '');
  if (!trimmed) return Number.NaN;

  if (trimmed.includes(',') && trimmed.includes('.')) {
    return Number(trimmed.replace(/\./g, '').replace(',', '.'));
  }
  if (trimmed.includes(',')) {
    return Number(trimmed.replace(',', '.'));
  }
  return Number(trimmed);
}

/** Formatea número para inputs: siempre 2 decimales con coma (`100` → `100,00`). */
export function formatLocaleNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

/** Completa el texto del monto a 2 decimales; si no hay coma, la agrega. */
export function normalizeAmountInput(value: string): string {
  const n = parseLocaleNumber(value);
  if (!Number.isFinite(n)) return value.trim();
  return formatLocaleNumber(n);
}

export function progressTone(
  actual: number,
  target: number,
  kind: 'expense' | 'savings' = 'expense',
): 'ok' | 'warn' | 'over' | 'under' {
  if (kind === 'savings') {
    if (actual >= target) return 'ok';
    return 'under';
  }
  if (actual > target) return 'over';
  if (actual >= target * 0.9) return 'warn';
  return 'ok';
}
