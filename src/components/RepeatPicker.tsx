import { Pressable, Text, TextInput, View } from 'react-native';

export type RepeatValue = {
  /** Para items: inherit | custom. Para categoría siempre custom. */
  mode: 'inherit' | 'custom';
  /** null = sin repetir; N = cada N meses */
  months: number | null;
};

type Props = {
  value: RepeatValue;
  onChange: (next: RepeatValue) => void;
  /** Si true, muestra la opción "Como la categoría". */
  allowInherit?: boolean;
  compact?: boolean;
};

const PRESETS: { id: string; label: string; apply: (allowInherit: boolean) => RepeatValue }[] = [
  {
    id: 'inherit',
    label: 'Como la categoría',
    apply: () => ({ mode: 'inherit', months: null }),
  },
  {
    id: 'none',
    label: 'Sin repetir',
    apply: () => ({ mode: 'custom', months: null }),
  },
  {
    id: 'monthly',
    label: 'Todos los meses',
    apply: () => ({ mode: 'custom', months: 1 }),
  },
  {
    id: 'custom',
    label: 'Cada X meses',
    apply: () => ({ mode: 'custom', months: 3 }),
  },
];

function activePresetId(value: RepeatValue, allowInherit: boolean): string {
  if (allowInherit && value.mode === 'inherit') return 'inherit';
  if (value.months === null) return 'none';
  if (value.months === 1) return 'monthly';
  return 'custom';
}

export function RepeatPicker({ value, onChange, allowInherit = false, compact = false }: Props) {
  const active = activePresetId(value, allowInherit);
  const options = PRESETS.filter((p) => p.id !== 'inherit' || allowInherit);

  return (
    <View className={compact ? 'gap-1.5' : 'gap-2'}>
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const selected = active === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.apply(allowInherit))}
              className={`rounded-full px-3 py-1.5 ${
                selected ? 'bg-brand-700' : 'border border-ink-200 bg-white'
              }`}
            >
              <Text className={selected ? 'text-xs font-medium text-white' : 'text-xs text-ink-700'}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {active === 'custom' ? (
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-ink-600">Cada</Text>
          <TextInput
            keyboardType="number-pad"
            value={value.months != null && value.months > 1 ? String(value.months) : '2'}
            onChangeText={(t) => {
              const n = parseInt(t.replace(/\D/g, ''), 10);
              onChange({ mode: 'custom', months: Number.isFinite(n) && n >= 2 ? n : 2 });
            }}
            className="w-14 rounded-xl border border-ink-200 px-3 py-2 text-center text-ink-900"
          />
          <Text className="text-sm text-ink-600">meses</Text>
        </View>
      ) : null}
    </View>
  );
}

export function formatRepeatLabel(months: number | null, inherited = false): string {
  if (inherited) return 'Como cat.';
  if (months == null) return 'Una vez';
  if (months === 1) return 'Mensual';
  return `c/${months} meses`;
}
