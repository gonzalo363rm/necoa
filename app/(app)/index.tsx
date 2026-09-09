import { addMonths, format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Tags } from 'lucide-react-native';
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

import { GoalProgressBar } from '@/src/components/GoalProgressBar';
import { SurfaceCard } from '@/src/components/SurfaceCard';
import { TagGlyph } from '@/src/components/TagGlyph';
import { WebShell } from '@/src/components/WebShell';
import { useAppRefresh } from '@/src/hooks/useAppRefresh';
import { useBudgetGoals, useFamilyContext, useTransactions } from '@/src/hooks/useFamilyData';
import { computeMonthBreakdown, formatMoney, monthRange, resolveCategory } from '@/src/lib/finance';
import { formatDisplayDate } from '@/src/lib/tags';
import { useFiltersStore } from '@/src/stores';
import type { Transaction } from '@/src/types/domain';

type GoalKind = 'living' | 'comfort' | 'savings';

const GOAL_TITLES: Record<GoalKind, string> = {
  living: 'Necesidades',
  comfort: 'Comodidades',
  savings: 'Ahorro',
};

function filterByGoal(transactions: Transaction[], kind: GoalKind): Transaction[] {
  if (kind === 'savings') {
    return transactions.filter((tx) => tx.type === 'income');
  }
  return transactions.filter((tx) => {
    if (tx.type !== 'expense') return false;
    const category = resolveCategory(tx);
    if (kind === 'living') return category === 'living' || category === 'other' || !category;
    return category === 'comfort';
  });
}

export default function HomeScreen() {
  const month = useFiltersStore((s) => s.month);
  const memberIds = useFiltersStore((s) => s.memberIds);
  const setMonth = useFiltersStore((s) => s.setMonth);
  const { familyId, families } = useFamilyContext();
  const { from, to } = monthRange(month);
  const goalsQuery = useBudgetGoals(familyId);
  const txQuery = useTransactions(familyId, from, to, memberIds);
  const { refreshing, onRefresh } = useAppRefresh();

  const breakdown = computeMonthBreakdown(txQuery.data ?? [], goalsQuery.data);
  const monthDate = parse(`${month}-01`, 'yyyy-MM-dd', new Date());
  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: es });

  const [goalDetail, setGoalDetail] = useState<GoalKind | null>(null);

  const detailRows = useMemo(() => {
    if (!goalDetail) return [];
    return filterByGoal(txQuery.data ?? [], goalDetail);
  }, [goalDetail, txQuery.data]);

  function shiftMonth(delta: number) {
    setMonth(format(addMonths(monthDate, delta), 'yyyy-MM'));
  }

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
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Pressable onPress={onRefresh} hitSlop={8}>
                <Text className="text-3xl font-bold text-brand-800">Necoa</Text>
              </Pressable>
              <Text className="mt-1 text-sm text-ink-500">
                {families[0]?.name ?? 'Tu familia'} · necesidades · comodidades · ahorro
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(app)/tags')}
              className="mt-1 h-10 w-10 items-center justify-center rounded-full border border-ink-100 bg-white"
            >
              <Tags color="#0F766E" size={18} />
            </Pressable>
          </View>

          <View className="mt-5 flex-row items-center justify-between rounded-2xl border border-ink-100 bg-white px-3 py-2">
            <Pressable onPress={() => shiftMonth(-1)} className="p-2">
              <ChevronLeft color="#334155" />
            </Pressable>
            <Text className="font-medium capitalize text-ink-900">{monthLabel}</Text>
            <Pressable onPress={() => shiftMonth(1)} className="p-2">
              <ChevronRight color="#334155" />
            </Pressable>
          </View>

          {txQuery.isLoading || goalsQuery.isLoading ? (
            <ActivityIndicator className="mt-10" color="#0D9488" />
          ) : (
            <View className="mt-5 gap-4">
              <SurfaceCard title="Resumen del mes" subtitle="Sobre ingresos del período">
                <View className="mt-2 flex-row justify-between">
                  <View>
                    <Text className="text-xs text-ink-500">Ingresos</Text>
                    <Text className="text-lg font-bold text-savings">{formatMoney(breakdown.incomeTotal)}</Text>
                  </View>
                  <View>
                    <Text className="text-xs text-ink-500">Gastos</Text>
                    <Text className="text-lg font-bold text-danger">{formatMoney(breakdown.expenseTotal)}</Text>
                  </View>
                  <View>
                    <Text className="text-xs text-ink-500">Ahorro</Text>
                    <Text className="text-lg font-bold text-brand-700">{formatMoney(breakdown.savingsAmount)}</Text>
                  </View>
                </View>
              </SurfaceCard>

              <SurfaceCard title="Objetivos" subtitle="Tocá una barra para ver el detalle">
                <GoalProgressBar
                  label="Necesidades"
                  actualPct={breakdown.livingPct}
                  targetPct={breakdown.goals?.living_pct ?? 40}
                  colorClass="bg-living"
                  amountLabel={formatMoney(breakdown.livingTotal)}
                  onPress={() => setGoalDetail('living')}
                />
                <GoalProgressBar
                  label="Comodidades"
                  actualPct={breakdown.comfortPct}
                  targetPct={breakdown.goals?.comfort_pct ?? 30}
                  colorClass="bg-comfort"
                  amountLabel={formatMoney(breakdown.comfortTotal)}
                  onPress={() => setGoalDetail('comfort')}
                />
                <GoalProgressBar
                  label="Ahorro"
                  actualPct={breakdown.savingsPct}
                  targetPct={breakdown.goals?.savings_pct ?? 30}
                  colorClass="bg-savings"
                  kind="savings"
                  amountLabel={formatMoney(breakdown.savingsAmount)}
                  onPress={() => setGoalDetail('savings')}
                />
              </SurfaceCard>
            </View>
          )}
        </ScrollView>
      </WebShell>

      <Modal visible={goalDetail !== null} transparent animationType="fade" onRequestClose={() => setGoalDetail(null)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setGoalDetail(null)}>
          <Pressable
            className="max-h-[80%] rounded-t-3xl bg-white"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="border-b border-ink-100 px-5 pb-3 pt-5">
              <Text className="text-xl font-bold text-ink-900">
                {goalDetail ? GOAL_TITLES[goalDetail] : ''}
              </Text>
              <Text className="mt-1 text-sm text-ink-500">
                {goalDetail === 'savings'
                  ? 'Ingresos del mes (el ahorro es lo que queda tras los gastos)'
                  : `Gastos de ${goalDetail ? GOAL_TITLES[goalDetail].toLowerCase() : ''} en ${monthLabel}`}
              </Text>
            </View>
            <FlatList
              data={detailRows}
              keyExtractor={(item) => item.id}
              contentContainerClassName="px-5 pb-10 pt-3"
              ListEmptyComponent={
                <Text className="mt-6 text-center text-ink-500">Sin movimientos en esta categoría</Text>
              }
              renderItem={({ item }) => {
                const isExpense = item.type === 'expense';
                return (
                  <Pressable
                    onPress={() => {
                      setGoalDetail(null);
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
            <Pressable onPress={() => setGoalDetail(null)} className="items-center border-t border-ink-100 py-4">
              <Text className="font-medium text-ink-600">Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
