import DateTimePicker from '@expo/ui/community/datetime-picker';
import { format, isValid, parse } from 'date-fns';
import { createElement, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { formatDisplayDate } from '@/src/lib/tags';

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
};

function toDate(value: string) {
  const parsed = parse(value, 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : new Date();
}

function WebDateInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return createElement('input', {
    type: 'date',
    value,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    style: {
      width: '100%',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      borderStyle: 'solid',
      backgroundColor: '#F8FAFC',
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 12,
      paddingRight: 12,
      fontSize: 14,
      fontWeight: '500',
      color: '#0F172A',
      boxSizing: 'border-box',
    },
  });
}

export function DateField({ label, value, onChange, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const date = toDate(value);

  if (Platform.OS === 'web') {
    return (
      <View className={compact ? 'mb-0' : 'mb-4'}>
        {label ? <Text className="mb-1 text-xs text-ink-500">{label}</Text> : null}
        <WebDateInput value={value} onChange={onChange} />
      </View>
    );
  }

  return (
    <View className={compact ? 'mb-0' : 'mb-4'}>
      {label ? <Text className="mb-1 text-xs text-ink-500">{label}</Text> : null}

      <Pressable
        onPress={() => setOpen((current) => !current)}
        className={`rounded-xl border border-ink-200 bg-ink-50 px-3 ${compact ? 'py-2.5' : 'py-3'}`}
      >
        <Text className="text-sm font-medium text-ink-900">{formatDisplayDate(value)}</Text>
      </Pressable>

      {open ? (
        <View className="mt-2 overflow-hidden rounded-2xl border border-ink-100 bg-white">
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            presentation="inline"
            locale="es_AR"
            themeVariant="light"
            accentColor="#0D9488"
            style={{
              width: '100%',
              height: Platform.OS === 'ios' ? 216 : 340,
              alignSelf: 'stretch',
            }}
            onValueChange={(_event, selectedDate) => {
              if (!selectedDate) return;
              onChange(format(selectedDate, 'yyyy-MM-dd'));
              if (Platform.OS === 'android') setOpen(false);
            }}
          />
          {Platform.OS === 'ios' ? (
            <Pressable onPress={() => setOpen(false)} className="items-center border-t border-ink-100 py-3">
              <Text className="font-medium text-brand-700">Listo</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
