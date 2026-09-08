import { Text, View } from 'react-native';

import { progressTone } from '@/src/lib/finance';

type Props = {
  label: string;
  actualPct: number;
  targetPct: number;
  colorClass: string;
  amountLabel?: string;
  kind?: 'expense' | 'savings';
};

export function GoalProgressBar({
  label,
  actualPct,
  targetPct,
  colorClass,
  amountLabel,
  kind = 'expense',
}: Props) {
  const tone = progressTone(actualPct, targetPct, kind);
  const width = Math.min(100, Math.max(0, actualPct));
  const marker = Math.min(100, Math.max(0, targetPct));

  const toneText =
    kind === 'savings'
      ? tone === 'ok'
        ? 'text-savings'
        : 'text-danger'
      : tone === 'over'
        ? 'text-danger'
        : tone === 'warn'
          ? 'text-warn'
          : 'text-ink-500';

  const barClass =
    kind === 'savings' ? (tone === 'ok' ? 'bg-savings' : 'bg-danger') : colorClass;

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-end justify-between">
        <Text className="font-medium text-ink-900">{label}</Text>
        <Text className={`text-sm ${toneText}`}>
          {actualPct.toFixed(0)}% / meta {targetPct.toFixed(0)}%
        </Text>
      </View>
      <View className="relative h-3 overflow-hidden rounded-full bg-ink-100">
        <View className={`absolute left-0 top-0 h-3 rounded-full ${barClass}`} style={{ width: `${width}%` }} />
        <View
          className="absolute top-0 h-3 w-0.5 bg-ink-900/40"
          style={{ left: `${marker}%` }}
        />
      </View>
      {amountLabel ? <Text className="mt-1 text-xs text-ink-500">{amountLabel}</Text> : null}
    </View>
  );
}
