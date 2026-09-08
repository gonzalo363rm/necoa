export const TAG_COLORS = [
  '#0D9488',
  '#14B8A6',
  '#059669',
  '#16A34A',
  '#65A30D',
  '#CA8A04',
  '#D97706',
  '#EA580C',
  '#F97316',
  '#DC2626',
  '#E11D48',
  '#DB2777',
  '#C026D3',
  '#9333EA',
  '#7C3AED',
  '#6366F1',
  '#2563EB',
  '#0284C7',
  '#0891B2',
  '#0E7490',
  '#334155',
  '#475569',
  '#64748B',
  '#78716C',
  '#B45309',
  '#BE185D',
  '#1D4ED8',
  '#4338CA',
  '#7E22CE',
  '#0F766E',
] as const;

export function randomTagColor() {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]!;
}

export function tagInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  if (parts.length === 0) return '?';
  return parts.map((p) => p[0]!.toUpperCase()).join('');
}

export function formatDisplayDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}
