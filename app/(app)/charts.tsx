import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageTitle } from '@/src/components/PageTitle';
import { PeriodSelector } from '@/src/components/PeriodSelector';
import { PieBreakdownCard } from '@/src/components/charts/PieBreakdownCard';
import { TrendChartCard } from '@/src/components/charts/TrendChartCard';
import { TagGlyph } from '@/src/components/TagGlyph';
import { WebShell } from '@/src/components/WebShell';
import { useAppRefresh } from '@/src/hooks/useAppRefresh';
import { useFamilyContext, useMembers, useTransactions } from '@/src/hooks/useFamilyData';
import {
  byMember,
  categorySlices,
  expensesByTag,
  monthKeysBetween,
  monthSpanRange,
  monthlyExpenseTotals,
  monthlyTotalsByTag,
  type Slice,
} from '@/src/lib/analytics';
import { formatMoney, monthRange, resolveCategory } from '@/src/lib/finance';
import { formatDisplayDate } from '@/src/lib/tags';
import { useFiltersStore } from '@/src/stores';
import type { Transaction } from '@/src/types/domain';

type DetailState =
  | { kind: 'tag'; id: string; label: string }
  | { kind: 'category'; id: string; label: string }
  | { kind: 'member-expense'; id: string; label: string }
  | { kind: 'member-income'; id: string; label: string }
  | null;

function filterTransactions(rows: Transaction[], detail: NonNullable<DetailState>): Transaction[] {
  if (detail.kind === 'tag') {
    if (detail.id === 'other') {
      // "Otros" del pie = etiquetas fuera del top: no hay IDs fijos; mostrar resto no listado en top
      return rows.filter((tx) => tx.type === 'expense');
    }
    if (detail.id === 'none') {
      return rows.filter((tx) => tx.type === 'expense' && !tx.tag_id);
    }
    return rows.filter((tx) => tx.type === 'expense' && tx.tag_id === detail.id);
  }
  if (detail.kind === 'category') {
    return rows.filter((tx) => {
      if (tx.type !== 'expense') return false;
      const cat = resolveCategory(tx);
      return (cat ?? 'other') === detail.id;
    });
  }
  if (detail.kind === 'member-expense') {
    return rows.filter((tx) => {
      if (tx.type !== 'expense') return false;
      const splits = tx.splits ?? [];
      if (splits.length === 0) return tx.paid_by === detail.id;
      return splits.some((s) => s.user_id === detail.id && Number(s.share_pct) > 0);
    });
  }
  // member-income
  return rows.filter((tx) => {
    if (tx.type !== 'income') return false;
    const splits = tx.splits ?? [];
    if (splits.length === 0) return tx.paid_by === detail.id;
    return splits.some((s) => s.user_id === detail.id && Number(s.share_pct) > 0);
  });
}

export default function ChartsScreen() {
  const month = useFiltersStore((s) => s.month);
  const memberIds = useFiltersStore((s) => s.memberIds);
  const setMonth = useFiltersStore((s) => s.setMonth);
  const range = useFiltersStore((s) => s.chartsRange);
  const setRange = useFiltersStore((s) => s.setChartsRange);
  const { familyId } = useFamilyContext();
  const membersQuery = useMembers(familyId);

  const period = range ?? monthRange(month);
  const span = useMemo(() => {
    if (!range) return monthSpanRange(month, 6);
    return { ...range, months: monthKeysBetween(range.from, range.to) };
  }, [range, month]);
  const [trendTagId, setTrendTagId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>(null);

  const monthTx = useTransactions(familyId, period.from, period.to, memberIds);
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

  const periodLabel = range
    ? `${formatDisplayDate(range.from)} – ${formatDisplayDate(range.to)}`
    : format(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), 'MMMM yyyy', { locale: es });

  const detailRows = useMemo(() => {
    if (!detail) return [];
    const rows = monthTx.data ?? [];
    if (detail.kind === 'tag' && detail.id === 'other') {
      const topIds = new Set(tagSlices.filter((s) => s.id !== 'other').map((s) => s.id));
      return rows.filter(
        (tx) => tx.type === 'expense' && tx.tag_id != null && !topIds.has(tx.tag_id),
      );
    }
    return filterTransactions(rows, detail);
  }, [detail, monthTx.data, tagSlices]);

  const loading = monthTx.isLoading || spanTx.isLoading || membersQuery.isLoading;
  const { refreshing, onRefresh } = useAppRefresh();

  function openTagDetail(tag: { id: string; name: string }) {
    setDetail({ kind: 'tag', id: tag.id, label: tag.name });
  }

  function openSlice(
    kind: 'tag' | 'category' | 'member-expense' | 'member-income',
    slice: Slice,
  ) {
    setDetail({ kind, id: slice.id, label: slice.label });
  }

  return (
    <SafeAreaView className="flex-1 bg-ink-50" edges={['top']}>
      <PageTitle title="Gráficos" />
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
            Tocá una etiqueta o porción para ver sus movimientos.
          </Text>

          <PeriodSelector
            className="mt-4"
            month={month}
            range={range}
            onMonthChange={(next) => {
              setRange(null);
              setMonth(next);
            }}
            onRangeChange={(from, to) => setRange({ from, to })}
            onReset={() => {
              setRange(null);
              setMonth(format(new Date(), 'yyyy-MM'));
            }}
          />

          {loading ? (
            <ActivityIndicator className="mt-10" color="#0D9488" />
          ) : (
            <View className="mt-5 gap-4">
              <PieBreakdownCard
                title="Gastos por etiqueta"
                subtitle={range ? 'Rango seleccionado' : 'Mes seleccionado'}
                slices={tagSlices}
                onSlicePress={(slice) => openSlice('tag', slice)}
              />

              <PieBreakdownCard
                title="Necesidades vs comodidades"
                subtitle={range ? 'Distribución del gasto del rango' : 'Distribución del gasto del mes'}
                slices={catSlices}
                onSlicePress={(slice) => openSlice('category', slice)}
              />

              <TrendChartCard
                totals={trendTotals}
                series={compareSeries}
                tagOptions={tagOptions}
                selectedTagId={trendTagId}
                onSelectTag={setTrendTagId}
                onOpenTagDetail={openTagDetail}
              />

              {showFamily ? (
                <>
                  <PieBreakdownCard
                    title="Gastos por miembro"
                    subtitle="Según splits / quién pagó"
                    slices={expenseMembers}
                    onSlicePress={(slice) => openSlice('member-expense', slice)}
                  />
                  <PieBreakdownCard
                    title="Ingresos por miembro"
                    subtitle="Según splits / quién aportó"
                    slices={incomeMembers}
                    onSlicePress={(slice) => openSlice('member-income', slice)}
                  />
                </>
              ) : null}
            </View>
          )}
        </ScrollView>
      </WebShell>

      <Modal
        visible={detail !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetail(null)}
      >
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-black/40" onPress={() => setDetail(null)} />
          <View className="max-h-[80%] rounded-t-3xl bg-white">
            <View className="border-b border-ink-100 px-5 pb-3 pt-5">
              <Text className="text-xl font-bold text-ink-900">{detail?.label ?? ''}</Text>
              <Text className="mt-1 text-sm text-ink-500">
                {detail?.kind === 'member-income' ? 'Ingresos' : 'Gastos'} · {periodLabel}
                {detailRows.length ? ` · ${detailRows.length} movimiento${detailRows.length === 1 ? '' : 's'}` : ''}
              </Text>
            </View>
            <FlatList
              data={detailRows}
              keyExtractor={(item) => item.id}
              contentContainerClassName="px-5 pb-10 pt-3"
              ListEmptyComponent={
                <Text className="mt-6 text-center text-ink-500">Sin movimientos</Text>
              }
              renderItem={({ item }) => {
                const isExpense = item.type === 'expense';
                return (
                  <Pressable
                    onPress={() => {
                      setDetail(null);
                      router.push({ pathname: '/add-transaction', params: { id: item.id } });
                    }}
                    className="mb-3 flex-row items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3"
                  >
                    <TagGlyph
                      name={item.tag?.icon}
                      label={item.tag?.name ?? (isExpense ? 'Gasto' : 'Ingreso')}
                      color={item.tag?.color ?? (isExpense ? '#DC2626' : '#059669')}
                      background
                      size={18}
                    />
                    <View className="min-w-0 flex-1">
                      <Text className="font-medium text-ink-900" numberOfLines={1}>
                        {isExpense ? item.tag?.name || 'Gasto' : item.note || 'Ingreso'}
                      </Text>
                      {isExpense && item.note ? (
                        <Text className="text-sm text-ink-600" numberOfLines={2}>
                          {item.note}
                        </Text>
                      ) : null}
                      <Text className="text-xs text-ink-500">{formatDisplayDate(item.occurred_at)}</Text>
                    </View>
                    <Text className={`font-bold ${isExpense ? 'text-danger' : 'text-savings'}`}>
                      {isExpense ? '-' : '+'}
                      {formatMoney(Number(item.amount))}
                    </Text>
                  </Pressable>
                );
              }}
            />
            <Pressable
              onPress={() => setDetail(null)}
              className="items-center border-t border-ink-100 py-4"
            >
              <Text className="font-medium text-ink-600">Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
