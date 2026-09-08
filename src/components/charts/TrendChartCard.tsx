import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';

import { SurfaceCard } from '@/src/components/SurfaceCard';
import { formatCompact, type MonthPoint, type TagSeries } from '@/src/lib/analytics';
import { formatMoney } from '@/src/lib/finance';

type Props = {
  totals: MonthPoint[];
  series: TagSeries[];
  tagOptions: { id: string; name: string; color: string }[];
  selectedTagId: string | null;
  onSelectTag: (id: string | null) => void;
};

export function TrendChartCard({ totals, series, tagOptions, selectedTagId, onSelectTag }: Props) {
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

  const lineMax = useMemo(() => {
    if (mode === 'pct') return 100;
    let m = 1;
    for (const s of series) {
      for (const p of s.points) m = Math.max(m, p.amount);
    }
    return m;
  }, [series, mode]);

  const showCompare = !selectedTagId && series.length > 0;

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
                className={`rounded-full px-3 py-1.5 ${active ? 'bg-brand-700' : 'border border-ink-200 bg-white'}`}
              >
                <Text className={active ? 'text-xs font-medium text-white' : 'text-xs text-ink-700'}>{t.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Pressable onPress={() => setMode((m) => (m === 'pct' ? 'amount' : 'pct'))}>
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
            width={Math.max(280, totals.length * 48)}
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
              width={Math.max(280, totals.length * 48)}
              frontColor="#CCFBF1"
            />
            <Text className="mb-2 mt-4 text-xs font-medium text-ink-500">Top etiquetas (líneas)</Text>
            <LineChart
              data={series[0]?.points.map((p) => ({
                value: mode === 'pct' ? (p.amount / lineMax) * 100 : p.amount,
                label: p.label,
              }))}
              data2={series[1]?.points.map((p) => ({
                value: mode === 'pct' ? (p.amount / lineMax) * 100 : p.amount,
              }))}
              data3={series[2]?.points.map((p) => ({
                value: mode === 'pct' ? (p.amount / lineMax) * 100 : p.amount,
              }))}
              data4={series[3]?.points.map((p) => ({
                value: mode === 'pct' ? (p.amount / lineMax) * 100 : p.amount,
              }))}
              height={180}
              width={Math.max(280, totals.length * 48)}
              spacing={36}
              thickness={2}
              thickness2={2}
              thickness3={2}
              thickness4={2}
              color={series[0]?.color ?? '#0D9488'}
              color2={series[1]?.color ?? '#D97706'}
              color3={series[2]?.color ?? '#7C3AED'}
              color4={series[3]?.color ?? '#2563EB'}
              hideDataPoints={false}
              dataPointsRadius={3}
              hideRules
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: '#94A3B8', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#64748B', fontSize: 10 }}
              noOfSections={4}
              maxValue={mode === 'pct' ? 100 : lineMax}
              formatYLabel={(v) => (mode === 'pct' ? `${Number(v).toFixed(0)}` : formatCompact(Number(v)))}
            />
            <View className="mt-3 flex-row flex-wrap gap-3">
              {series.map((s) => (
                <View key={s.tagId} className="flex-row items-center gap-1.5">
                  <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <Text className="text-xs text-ink-700">{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Pressable>

      {selectedTagId ? (
        <Text className="mt-3 text-xs text-ink-500">
          Último mes:{' '}
          {formatMoney(totals[totals.length - 1]?.amount ?? 0)}
          {totals.length > 1
            ? ` · vs anterior ${formatMoney(totals[totals.length - 2]?.amount ?? 0)}`
            : ''}
        </Text>
      ) : null}
    </SurfaceCard>
  );
}
