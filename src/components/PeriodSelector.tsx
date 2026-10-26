import { addMonths, format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { DateField } from '@/src/components/DateField';
import { monthRange } from '@/src/lib/finance';
import { formatDisplayDate } from '@/src/lib/tags';

type Props = {
  month: string;
  range: { from: string; to: string } | null;
  onMonthChange: (month: string) => void;
  onRangeChange: (from: string, to: string) => void;
  onReset: () => void;
  className?: string;
};

export function PeriodSelector({ month, range, onMonthChange, onRangeChange, onReset, className }: Props) {
  const monthDate = parse(`${month}-01`, 'yyyy-MM-dd', new Date());
  const monthBounds = monthRange(month);
  const canReset = range !== null || month !== format(new Date(), 'yyyy-MM');

  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(range?.from ?? monthBounds.from);
  const [draftTo, setDraftTo] = useState(range?.to ?? monthBounds.to);

  function shiftMonth(delta: number) {
    onMonthChange(format(addMonths(monthDate, delta), 'yyyy-MM'));
  }

  function openRange() {
    setDraftFrom(range?.from ?? monthBounds.from);
    setDraftTo(range?.to ?? monthBounds.to);
    setOpen(true);
  }

  function applyRange() {
    const [from, to] = draftFrom <= draftTo ? [draftFrom, draftTo] : [draftTo, draftFrom];
    onRangeChange(from, to);
    setOpen(false);
  }

  function reset() {
    onReset();
    setOpen(false);
  }

  const resetButton = canReset ? (
    <Pressable onPress={reset} className="mr-1 rounded-full bg-ink-100 px-3 py-2">
      <Text className="text-xs font-medium text-ink-700">Reiniciar</Text>
    </Pressable>
  ) : null;

  return (
    <>
      {range ? (
        <View
          className={`flex-row items-center gap-2 rounded-2xl border border-ink-100 bg-white px-3 py-2 ${className ?? ''}`}
        >
          <Pressable onPress={openRange} className="flex-1 px-2 py-2">
            <Text className="text-xs text-ink-500">Rango · tocá para editar</Text>
            <Text className="font-medium text-ink-900">
              {formatDisplayDate(range.from)} – {formatDisplayDate(range.to)}
            </Text>
          </Pressable>
          {resetButton}
        </View>
      ) : (
        <View
          className={`flex-row items-center rounded-2xl border border-ink-100 bg-white px-2 py-2 ${className ?? ''}`}
        >
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
          {resetButton}
        </View>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-black/40" onPress={() => setOpen(false)} />
          <View className="max-h-[85%] rounded-t-3xl bg-white">
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
                <DateField label="Desde" compact value={draftFrom} onChange={setDraftFrom} />
                <DateField label="Hasta" compact value={draftTo} onChange={setDraftTo} />
              </View>

              <Pressable onPress={applyRange} className="mt-5 items-center rounded-2xl bg-brand-700 py-3.5">
                <Text className="font-medium text-white">Aplicar rango</Text>
              </Pressable>
              <Pressable onPress={reset} className="mt-2 items-center rounded-2xl bg-ink-100 py-3.5">
                <Text className="font-medium text-ink-700">Reiniciar al mes actual</Text>
              </Pressable>
              <Pressable onPress={() => setOpen(false)} className="mt-2 items-center py-3">
                <Text className="font-medium text-ink-500">Cancelar</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
