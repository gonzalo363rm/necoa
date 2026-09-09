import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PieBreakdownCard } from '@/src/components/charts/PieBreakdownCard';
import { TrendChartCard } from '@/src/components/charts/TrendChartCard';
import { WebShell } from '@/src/components/WebShell';
import { useAppRefresh } from '@/src/hooks/useAppRefresh';
import { useFamilyContext, useMembers, useTransactions } from '@/src/hooks/useFamilyData';
import {
  byMember,
  categorySlices,
  expensesByTag,
  monthSpanRange,
  monthlyExpenseTotals,
  monthlyTotalsByTag,
} from '@/src/lib/analytics';
import { monthRange } from '@/src/lib/finance';
import { useFiltersStore } from '@/src/stores';

export default function ChartsScreen() {
  const month = useFiltersStore((s) => s.month);
  const memberIds = useFiltersStore((s) => s.memberIds);
  const { familyId } = useFamilyContext();
  const membersQuery = useMembers(familyId);

  const monthBounds = monthRange(month);
  const span = monthSpanRange(month, 6);
  const [trendTagId, setTrendTagId] = useState<string | null>(null);

  const monthTx = useTransactions(familyId, monthBounds.from, monthBounds.to, memberIds);
  const spanTx = useTransactions(familyId, span.from, span.to, memberIds, 'all');

  const members = membersQuery.data ?? [];
  const showFamily = members.length > 1;

  const tagSlices = useMemo(() => expensesByTag(monthTx.data ?? []), [monthTx.data]);
  const catSlices = useMemo(() => categorySlices(monthTx.data ?? []), [monthTx.data]);
  const expenseMembers = useMemo(
    () => byMember(monthTx.data ?? [], members, 'expense'),
    [monthTx.data, members],
  );
  const incomeMembers = useMemo(
    () => byMember(monthTx.data ?? [], members, 'income'),
    [monthTx.data, members],
  );

  const tagSeries = useMemo(
    () =>
      monthlyTotalsByTag(
        spanTx.data ?? [],
        span.months,
        trendTagId ? [trendTagId] : null,
        4,
      ),
    [spanTx.data, span.months, trendTagId],
  );

  const trendTotals = useMemo(() => {
    if (trendTagId && tagSeries[0]) {
      return tagSeries[0].points;
    }
    return monthlyExpenseTotals(spanTx.data ?? [], span.months);
  }, [trendTagId, tagSeries, spanTx.data, span.months]);

  const compareSeries = useMemo(
    () => (trendTagId ? [] : monthlyTotalsByTag(spanTx.data ?? [], span.months, null, 4)),
    [trendTagId, spanTx.data, span.months],
  );

  const tagOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const tx of spanTx.data ?? []) {
      if (tx.type !== 'expense' || !tx.tag_id || !tx.tag) continue;
      map.set(tx.tag_id, { id: tx.tag_id, name: tx.tag.name, color: tx.tag.color ?? '#64748B' });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [spanTx.data]);

  const loading = monthTx.isLoading || spanTx.isLoading || membersQuery.isLoading;
  const { refreshing, onRefresh } = useAppRefresh();

  return (
    <SafeAreaView className="flex-1 bg-ink-50" edges={['top']}>
      <WebShell>
        <ScrollView
          contentContainerClassName="px-5 pb-28 pt-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0D9488"
              colors={['#0D9488']}
            />
          }
        >
          <Text className="text-2xl font-bold text-ink-900">Gráficos</Text>
          <Text className="mt-1 text-sm text-ink-500">
            Tocá un gráfico o el chip % / $ para alternar porcentaje y montos.
          </Text>

          {loading ? (
            <ActivityIndicator className="mt-10" color="#0D9488" />
          ) : (
            <View className="mt-5 gap-4">
              <PieBreakdownCard
                title="Gastos por etiqueta"
                subtitle="Mes seleccionado en Resumen"
                slices={tagSlices}
              />

              <PieBreakdownCard
                title="Necesidades vs comodidades"
                subtitle="Distribución del gasto del mes"
                slices={catSlices}
              />

              <TrendChartCard
                totals={trendTotals}
                series={compareSeries}
                tagOptions={tagOptions}
                selectedTagId={trendTagId}
                onSelectTag={setTrendTagId}
              />

              {showFamily ? (
                <>
                  <PieBreakdownCard
                    title="Gastos por miembro"
                    subtitle="Según splits / quién pagó"
                    slices={expenseMembers}
                  />
                  <PieBreakdownCard
                    title="Ingresos por miembro"
                    subtitle="Según splits / quién aportó"
                    slices={incomeMembers}
                  />
                </>
              ) : null}
            </View>
          )}
        </ScrollView>
      </WebShell>
    </SafeAreaView>
  );
}
