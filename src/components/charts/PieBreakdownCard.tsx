import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { SurfaceCard } from '@/src/components/SurfaceCard';
import { formatCompact, type Slice } from '@/src/lib/analytics';
import { formatMoney } from '@/src/lib/finance';

type Props = {
  title: string;
  subtitle?: string;
  slices: Slice[];
  emptyLabel?: string;
};

export function PieBreakdownCard({ title, subtitle, slices, emptyLabel = 'Sin datos' }: Props) {
  const [mode, setMode] = useState<'pct' | 'amount'>('pct');
  const total = useMemo(() => slices.reduce((s, x) => s + x.amount, 0), [slices]);

  const data = slices.map((s) => ({
    value: s.amount,
    color: s.color,
    text: mode === 'pct' ? `${s.pct.toFixed(0)}%` : formatCompact(s.amount),
  }));

  return (
    <SurfaceCard
      title={title}
      subtitle={subtitle}
      right={
        <Pressable
          onPress={() => setMode((m) => (m === 'pct' ? 'amount' : 'pct'))}
          className="rounded-full bg-ink-100 px-3 py-1.5"
        >
          <Text className="text-xs font-medium text-ink-700">{mode === 'pct' ? '%' : '$'}</Text>
        </Pressable>
      }
    >
      {slices.length === 0 || total <= 0 ? (
        <Text className="py-8 text-center text-sm text-ink-500">{emptyLabel}</Text>
      ) : (
        <View className="items-center pt-2">
          <Pressable onPress={() => setMode((m) => (m === 'pct' ? 'amount' : 'pct'))}>
            <PieChart
              data={data}
              donut
              radius={96}
              innerRadius={58}
              focusOnPress
              sectionAutoFocus
              centerLabelComponent={() => (
                <View className="items-center px-2">
                  <Text className="text-[10px] text-ink-500">{mode === 'pct' ? 'Total' : 'Suma'}</Text>
                  <Text className="text-center text-xs font-bold text-ink-900">
                    {mode === 'pct' ? '100%' : formatCompact(total)}
                  </Text>
                </View>
              )}
            />
          </Pressable>
          <Text className="mb-3 mt-1 text-[11px] text-ink-400">Tocá el gráfico para cambiar % / monto</Text>
          <View className="w-full gap-2">
            {slices.map((s) => (
              <View key={s.id} className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <Text className="text-sm text-ink-700">{s.label}</Text>
                </View>
                <Text className="text-sm font-medium text-ink-900">
                  {mode === 'pct' ? `${s.pct.toFixed(1)}%` : formatMoney(s.amount)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </SurfaceCard>
  );
}
