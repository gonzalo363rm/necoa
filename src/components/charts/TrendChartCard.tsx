import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { MultiLineTrend } from '@/src/components/charts/MultiLineTrend';
import { SurfaceCard } from '@/src/components/SurfaceCard';
import { formatCompact, type MonthPoint, type TagSeries } from '@/src/lib/analytics';
import { formatMoney } from '@/src/lib/finance';

type Props = {
  totals: MonthPoint[];
  series: TagSeries[];
  tagOptions: { id: string; name: string; color: string }[];
  selectedTagId: string | null;
  onSelectTag: (id: string | null) => void;
  /** Abrir listado de movimientos de esa etiqueta (mes actual). */
  onOpenTagDetail?: (tag: { id: string; name: string; color: string }) => void;
};

export function TrendChartCard({
  totals,
  series,
  tagOptions,
  selectedTagId,
  onSelectTag,
  onOpenTagDetail,
}: Props) {
  const [mode, setMode] = useState<'pct' | 'amount'>('amount');

  const maxTotal = Math.max(1, ...totals.map((t) => t.amount));

  const barData = useMemo(() => {
    return totals.map((t) => ({
      value: mode === 'amount' ? t.amount : maxTotal > 0 ? (t.amount / maxTotal) * 100 : 0,
      label: t.label,
      frontColor: selectedTagId
        ? tagOptions.find((x) => x.id === selectedTagId)?.color ?? '#0D9488'
        : '#0D9488',
      topLabelComponent: () => (
        <Text className="text-[9px] text-ink-500">
          {mode === 'amount' ? formatCompact(t.amount) : `${((t.amount / maxTotal) * 100).toFixed(0)}`}
        </Text>
      ),
    }));
  }, [totals, mode, maxTotal, selectedTagId, tagOptions]);

  const amountMax = useMemo(() => {
    let m = 1;
    for (const s of series) {
      for (const p of s.points) m = Math.max(m, p.amount);
    }
    return m;
  }, [series]);

  const multiLines = useMemo(
    () =>
      series.slice(0, 4).map((s) => ({
        id: s.tagId,
        color: s.color,
        values: s.points.map((p) =>
          mode === 'pct' ? (amountMax > 0 ? (p.amount / amountMax) * 100 : 0) : p.amount,
        ),
      })),
    [series, mode, amountMax],
  );

  const labels = useMemo(() => {
    const fromSeries = series[0]?.points.map((p) => p.label) ?? [];
    if (fromSeries.length) return fromSeries;
    return totals.map((t) => t.label);
  }, [series, totals]);

  const showCompare = !selectedTagId && multiLines.length > 0 && labels.length > 0;
  const chartWidth = Math.max(280, totals.length * 48);

  return (
    <SurfaceCard
      title="Tendencia de gastos"
      subtitle={
        selectedTagId
          ? 'Mes a mes para la etiqueta elegida'
          : 'Barras = total · líneas = top etiquetas'
      }
      right={
        <Pressable
          onPress={() => setMode((m) => (m === 'pct' ? 'amount' : 'pct'))}
          className="rounded-full bg-ink-100 px-3 py-1.5"
        >
          <Text className="text-xs font-medium text-ink-700">{mode === 'pct' ? '%' : '$'}</Text>
        </Pressable>
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => onSelectTag(null)}
            className={`rounded-full px-3 py-1.5 ${!selectedTagId ? 'bg-brand-700' : 'border border-ink-200 bg-white'}`}
          >
            <Text className={!selectedTagId ? 'text-xs font-medium text-white' : 'text-xs text-ink-700'}>
              Todas
            </Text>
          </Pressable>
          {tagOptions.slice(0, 12).map((t) => {
            const active = selectedTagId === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => onSelectTag(active ? null : t.id)}
                onLongPress={() => onOpenTagDetail?.(t)}
                delayLongPress={280}
                className={`rounded-full px-3 py-1.5 ${active ? 'bg-brand-700' : 'border border-ink-200 bg-white'}`}
              >
                <Text className={active ? 'text-xs font-medium text-white' : 'text-xs text-ink-700'}>{t.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {selectedTagId || !showCompare ? (
        <BarChart
          data={barData}
          barWidth={28}
          spacing={18}
          roundedTop
          hideRules
          xAxisThickness={0}
          yAxisThickness={0}
          yAxisTextStyle={{ color: '#94A3B8', fontSize: 10 }}
          xAxisLabelTextStyle={{ color: '#64748B', fontSize: 10 }}
          noOfSections={4}
          maxValue={mode === 'pct' ? 100 : undefined}
          formatYLabel={(v) => (mode === 'pct' ? `${Number(v).toFixed(0)}` : formatCompact(Number(v)))}
          height={180}
          width={chartWidth}
        />
      ) : (
        <View>
          <BarChart
            data={barData}
            barWidth={22}
            spacing={20}
            roundedTop
            hideRules
            xAxisThickness={0}
            yAxisThickness={0}
            yAxisTextStyle={{ color: '#94A3B8', fontSize: 10 }}
            xAxisLabelTextStyle={{ color: '#64748B', fontSize: 10 }}
            noOfSections={4}
            maxValue={mode === 'pct' ? 100 : undefined}
            formatYLabel={(v) => (mode === 'pct' ? `${Number(v).toFixed(0)}` : formatCompact(Number(v)))}
            height={160}
            width={chartWidth}
            frontColor="#CCFBF1"
          />
          <Text className="mb-2 mt-4 text-xs font-medium text-ink-500">Top etiquetas (líneas)</Text>
          <MultiLineTrend
            labels={labels}
            lines={multiLines}
            maxValue={mode === 'pct' ? 100 : amountMax}
            height={180}
            width={chartWidth}
            formatY={(v) => (mode === 'pct' ? `${Number(v).toFixed(0)}` : formatCompact(Number(v)))}
          />
          <View className="mt-3 flex-row flex-wrap gap-3">
            {series.map((s) => (
              <Pressable
                key={s.tagId}
                onPress={() =>
                  onOpenTagDetail?.({ id: s.tagId, name: s.label, color: s.color })
                }
                className="flex-row items-center gap-1.5 rounded-full px-1 py-0.5 active:bg-ink-50"
              >
                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <Text className="text-xs text-ink-700">{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Text className="mt-2 text-[11px] text-ink-400">Usá % / $ arriba para cambiar la escala</Text>

      {selectedTagId ? (
        <Text className="mt-3 text-xs text-ink-500">
          Último mes: {formatMoney(totals[totals.length - 1]?.amount ?? 0)}
          {totals.length > 1
            ? ` · vs anterior ${formatMoney(totals[totals.length - 2]?.amount ?? 0)}`
            : ''}
        </Text>
      ) : null}
    </SurfaceCard>
  );
}
