import { format } from 'date-fns';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PageTitle } from '@/src/components/PageTitle';
import { PeriodSelector } from '@/src/components/PeriodSelector';
import { TagGlyph } from '@/src/components/TagGlyph';
import { WebShell } from '@/src/components/WebShell';
import { useAppRefresh } from '@/src/hooks/useAppRefresh';
import { useFamilyContext, useMembers, useTransactions } from '@/src/hooks/useFamilyData';
import { formatMoney, monthRange } from '@/src/lib/finance';
import { formatDisplayDate } from '@/src/lib/tags';
import { useFiltersStore } from '@/src/stores';

export default function TransactionsScreen() {
  const month = useFiltersStore((s) => s.month);
  const memberIds = useFiltersStore((s) => s.memberIds);
  const typeFilter = useFiltersStore((s) => s.typeFilter);
  const dateFrom = useFiltersStore((s) => s.dateFrom);
  const dateTo = useFiltersStore((s) => s.dateTo);
  const setMonth = useFiltersStore((s) => s.setMonth);
  const toggleMember = useFiltersStore((s) => s.toggleMember);
  const clearMembers = useFiltersStore((s) => s.clearMembers);
  const setTypeFilter = useFiltersStore((s) => s.setTypeFilter);
  const setDateRange = useFiltersStore((s) => s.setDateRange);

  const rangeActive = Boolean(dateFrom && dateTo);
  const { familyId } = useFamilyContext();
  const monthBounds = monthRange(month);
  const from = rangeActive ? dateFrom! : monthBounds.from;
  const to = rangeActive ? dateTo! : monthBounds.to;
  const membersQuery = useMembers(familyId);
  const txQuery = useTransactions(familyId, from, to, memberIds, typeFilter);
  const { refreshing, onRefresh } = useAppRefresh();

  const summary = useMemo(() => {
    const rows = txQuery.data ?? [];
    let income = 0;
    let expense = 0;
    for (const tx of rows) {
      const amount = Number(tx.amount);
      if (tx.type === 'income') income += amount;
      else expense += amount;
    }
    return { income, expense, total: income - expense };
  }, [txQuery.data]);

  return (
    <SafeAreaView className="flex-1 bg-ink-50" edges={['top']}>
      <PageTitle title="Movimientos" />
      <WebShell>
      <View className="px-5 pt-4">
        <Text className="text-2xl font-bold text-ink-900">Movimientos</Text>

        <PeriodSelector
          className="mt-4"
          month={month}
          range={rangeActive ? { from: dateFrom!, to: dateTo! } : null}
          onMonthChange={setMonth}
          onRangeChange={setDateRange}
          onReset={() => setMonth(format(new Date(), 'yyyy-MM'))}
        />

        <View className="mt-3 flex-row gap-2">
          {(
            [
              ['all', 'Todos'],
              ['expense', 'Gastos'],
              ['income', 'Ingresos'],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setTypeFilter(id)}
              className={`rounded-full px-3 py-1.5 ${typeFilter === id ? 'bg-brand-700' : 'border border-ink-200 bg-white'}`}
            >
              <Text className={typeFilter === id ? 'text-xs font-medium text-white' : 'text-xs text-ink-700'}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2">
          <Pressable
            onPress={clearMembers}
            className={`rounded-full px-3 py-1.5 ${memberIds.length === 0 ? 'bg-brand-700' : 'border border-ink-200 bg-white'}`}
          >
            <Text className={memberIds.length === 0 ? 'text-xs font-medium text-white' : 'text-xs text-ink-700'}>
              Todos
            </Text>
          </Pressable>
          {(membersQuery.data ?? []).map((m) => {
            const active = memberIds.includes(m.user_id);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggleMember(m.user_id)}
                className={`rounded-full px-3 py-1.5 ${active ? 'bg-brand-700' : 'border border-ink-200 bg-white'}`}
              >
                <Text className={active ? 'text-xs font-medium text-white' : 'text-xs text-ink-700'}>
                  {m.profile?.display_name ?? 'Miembro'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-3 flex-row justify-between rounded-2xl border border-ink-100 bg-white px-4 py-3">
          <View>
            <Text className="text-xs text-ink-500">Ingresos</Text>
            <Text className="font-bold text-savings">{formatMoney(summary.income)}</Text>
          </View>
          <View>
            <Text className="text-xs text-ink-500">Gastos</Text>
            <Text className="font-bold text-danger">{formatMoney(summary.expense)}</Text>
          </View>
          <View>
            <Text className="text-xs text-ink-500">Total</Text>
            <Text className={`font-bold ${summary.total >= 0 ? 'text-brand-700' : 'text-danger'}`}>
              {formatMoney(summary.total)}
            </Text>
          </View>
        </View>
      </View>

      {txQuery.isLoading && !refreshing ? (
        <ActivityIndicator className="mt-10" color="#0D9488" />
      ) : (
        <FlatList
          className="mt-4"
          contentContainerClassName="px-5 pb-28"
          data={txQuery.data ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0D9488"
              colors={['#0D9488']}
            />
          }
          ListEmptyComponent={<Text className="mt-8 text-center text-ink-500">Sin movimientos</Text>}
          renderItem={({ item }) => {
            const isExpense = item.type === 'expense';
            const splitLabel =
              (item.splits?.length ?? 0) > 1
                ? ` · ${(item.splits ?? [])
                    .map((s) => `${s.profile?.display_name?.split(' ')[0] ?? '?'}${Number(s.share_pct).toFixed(0)}%`)
                    .join(' · ')}`
                : '';
            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/add-transaction',
                    params: { id: item.id },
                  })
                }
                className="mb-3 flex-row items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3 active:opacity-90"
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
                  {item.note && isExpense ? (
                    <Text className="text-sm text-ink-600" numberOfLines={2}>
                      {item.note}
                    </Text>
                  ) : null}
                  <Text className="text-xs text-ink-500">
                    {formatDisplayDate(item.occurred_at)}
                    {item.installment_total
                      ? ` · cuota ${item.installment_current ?? 1}/${item.installment_total}`
                      : ''}
                    {splitLabel}
                  </Text>
                </View>
                <Text className={`font-bold ${isExpense ? 'text-danger' : 'text-savings'}`}>
                  {isExpense ? '-' : '+'}
                  {formatMoney(Number(item.amount))}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      </WebShell>

    </SafeAreaView>
  );
}
