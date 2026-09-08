import { addMonths, format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DateField } from '@/src/components/DateField';
import { TagGlyph } from '@/src/components/TagGlyph';
import { useFamilyContext, useMembers, useTransactions } from '@/src/hooks/useFamilyData';
import { formatMoney, monthRange } from '@/src/lib/finance';
import { formatDisplayDate } from '@/src/lib/tags';
import { useFiltersStore } from '@/src/stores';

function currentMonthKey() {
  return format(new Date(), 'yyyy-MM');
}

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
  const clearDateRange = useFiltersStore((s) => s.clearDateRange);

  const rangeActive = Boolean(dateFrom && dateTo);
  const { familyId } = useFamilyContext();
  const monthBounds = monthRange(month);
  const from = rangeActive ? dateFrom! : monthBounds.from;
  const to = rangeActive ? dateTo! : monthBounds.to;
  const membersQuery = useMembers(familyId);
  const txQuery = useTransactions(familyId, from, to, memberIds, typeFilter);
  const monthDate = parse(`${month}-01`, 'yyyy-MM-dd', new Date());
  const thisMonth = currentMonthKey();
  const canReset = rangeActive || month !== thisMonth;

  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeDraftFrom, setRangeDraftFrom] = useState(dateFrom ?? monthBounds.from);
  const [rangeDraftTo, setRangeDraftTo] = useState(dateTo ?? monthBounds.to);

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

  function shiftMonth(delta: number) {
    clearDateRange();
    setMonth(format(addMonths(monthDate, delta), 'yyyy-MM'));
  }

  function openRange() {
    setRangeDraftFrom(dateFrom ?? monthBounds.from);
    setRangeDraftTo(dateTo ?? monthBounds.to);
    setRangeOpen(true);
  }

  function applyRange() {
    setDateRange(rangeDraftFrom, rangeDraftTo);
    setRangeOpen(false);
  }

  function resetToCurrentMonth() {
    clearDateRange();
    setMonth(thisMonth);
    setRangeOpen(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-ink-50" edges={['top']}>
      <View className="px-5 pt-4">
        <Text className="text-2xl font-bold text-ink-900">Movimientos</Text>

        {rangeActive ? (
          <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-ink-100 bg-white px-3 py-2">
            <Pressable onPress={openRange} className="flex-1 px-2 py-2">
              <Text className="text-xs text-ink-500">Rango · tocá para editar</Text>
              <Text className="font-medium text-ink-900">
                {formatDisplayDate(dateFrom!)} – {formatDisplayDate(dateTo!)}
              </Text>
            </Pressable>
            {canReset ? (
              <Pressable onPress={resetToCurrentMonth} className="rounded-full bg-ink-100 px-3 py-2">
                <Text className="text-xs font-medium text-ink-700">Reiniciar</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View className="mt-4 flex-row items-center rounded-2xl border border-ink-100 bg-white px-2 py-2">
            <Pressable onPress={() => shiftMonth(-1)} className="p-2">
              <ChevronLeft color="#334155" />
            </Pressable>
            <Pressable onPress={openRange} className="flex-1 items-center py-2">
              <Text className="font-medium capitalize text-ink-900">
                {format(monthDate, 'MMMM yyyy', { locale: es })}
              </Text>
              <Text className="mt-0.5 text-[11px] text-ink-400">Tocá para elegir rango</Text>
            </Pressable>
            <Pressable onPress={() => shiftMonth(1)} className="p-2">
              <ChevronRight color="#334155" />
            </Pressable>
            {canReset ? (
              <Pressable onPress={resetToCurrentMonth} className="mr-1 rounded-full bg-ink-100 px-3 py-2">
                <Text className="text-xs font-medium text-ink-700">Reiniciar</Text>
              </Pressable>
            ) : null}
          </View>
        )}

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

      {txQuery.isLoading ? (
        <ActivityIndicator className="mt-10" color="#0D9488" />
      ) : (
        <FlatList
          className="mt-4"
          contentContainerClassName="px-5 pb-28"
          data={txQuery.data ?? []}
          keyExtractor={(item) => item.id}
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
                <View className="flex-1">
                  <Text className="font-medium text-ink-900">
                    {isExpense ? item.tag?.name || 'Gasto' : item.note || 'Ingreso'}
                  </Text>
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

      <Modal visible={rangeOpen} transparent animationType="fade" onRequestClose={() => setRangeOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setRangeOpen(false)}>
          <Pressable className="max-h-[85%] rounded-t-3xl bg-white" onPress={(e) => e.stopPropagation()}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="px-5 pb-10 pt-5"
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-xl font-bold text-ink-900">Rango de fechas</Text>
              <Text className="mt-1 text-sm text-ink-500">
                Esto ignora el selector de mes. Tocá cada fecha para elegirla.
              </Text>

              <View className="mt-4 gap-3">
                <DateField label="Desde" compact value={rangeDraftFrom} onChange={setRangeDraftFrom} />
                <DateField label="Hasta" compact value={rangeDraftTo} onChange={setRangeDraftTo} />
              </View>

              <Pressable onPress={applyRange} className="mt-5 items-center rounded-2xl bg-brand-700 py-3.5">
                <Text className="font-medium text-white">Aplicar rango</Text>
              </Pressable>
              <Pressable onPress={resetToCurrentMonth} className="mt-2 items-center rounded-2xl bg-ink-100 py-3.5">
                <Text className="font-medium text-ink-700">Reiniciar al mes actual</Text>
              </Pressable>
              <Pressable onPress={() => setRangeOpen(false)} className="mt-2 items-center py-3">
                <Text className="font-medium text-ink-500">Cancelar</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
