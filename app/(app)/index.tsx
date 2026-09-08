import { addMonths, format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalProgressBar } from '@/src/components/GoalProgressBar';
import { SurfaceCard } from '@/src/components/SurfaceCard';
import { useBudgetGoals, useFamilyContext, useTransactions } from '@/src/hooks/useFamilyData';
import { computeMonthBreakdown, formatMoney, monthRange } from '@/src/lib/finance';
import { useFiltersStore } from '@/src/stores';

export default function HomeScreen() {
  const month = useFiltersStore((s) => s.month);
  const memberIds = useFiltersStore((s) => s.memberIds);
  const setMonth = useFiltersStore((s) => s.setMonth);
  const { familyId, families } = useFamilyContext();
  const { from, to } = monthRange(month);
  const goalsQuery = useBudgetGoals(familyId);
  const txQuery = useTransactions(familyId, from, to, memberIds);

  const breakdown = computeMonthBreakdown(txQuery.data ?? [], goalsQuery.data);
  const monthDate = parse(`${month}-01`, 'yyyy-MM-dd', new Date());
  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: es });

  function shiftMonth(delta: number) {
    setMonth(format(addMonths(monthDate, delta), 'yyyy-MM'));
  }

  return (
    <SafeAreaView className="flex-1 bg-ink-50" edges={['top']}>
      <ScrollView contentContainerClassName="px-5 pb-28 pt-4" showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold text-brand-800">Necoa</Text>
        <Text className="mt-1 text-sm text-ink-500">
          {families[0]?.name ?? 'Tu familia'} · necesidades · comodidades · ahorro
        </Text>

        <View className="mt-5 flex-row items-center justify-between rounded-2xl bg-white px-3 py-2 border border-ink-100">
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
                  <Text className="text-lg font-bold text-ink-900">{formatMoney(breakdown.expenseTotal)}</Text>
                </View>
                <View>
                  <Text className="text-xs text-ink-500">Ahorro</Text>
                  <Text className="text-lg font-bold text-brand-700">{formatMoney(breakdown.savingsAmount)}</Text>
                </View>
              </View>
            </SurfaceCard>

            <SurfaceCard title="Objetivos" subtitle="Barras vs tu meta familiar">
              <GoalProgressBar
                label="Necesidades"
                actualPct={breakdown.livingPct}
                targetPct={breakdown.goals?.living_pct ?? 40}
                colorClass="bg-living"
                amountLabel={formatMoney(breakdown.livingTotal)}
              />
              <GoalProgressBar
                label="Comodidades"
                actualPct={breakdown.comfortPct}
                targetPct={breakdown.goals?.comfort_pct ?? 30}
                colorClass="bg-comfort"
                amountLabel={formatMoney(breakdown.comfortTotal)}
              />
              <GoalProgressBar
                label="Ahorro"
                actualPct={breakdown.savingsPct}
                targetPct={breakdown.goals?.savings_pct ?? 30}
                colorClass="bg-savings"
                kind="savings"
                amountLabel={formatMoney(breakdown.savingsAmount)}
              />
            </SurfaceCard>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
