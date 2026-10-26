import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatRepeatLabel, RepeatPicker, type RepeatValue } from '@/src/components/RepeatPicker';
import { listItemDraftSchema } from '@/src/schemas';
import type { ListItemWithEntry } from '@/src/types/domain';

type Props = {
  visible: boolean;
  item: ListItemWithEntry | null;
  /** Repetición de la categoría (para mostrar contexto de "Como la categoría"). */
  categoryRepeatMonths: number | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    repeat_mode: 'inherit' | 'custom';
    repeat_months: number | null;
  }) => Promise<void>;
};

export function ListItemEditModal({
  visible,
  item,
  categoryRepeatMonths,
  saving,
  onClose,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [repeat, setRepeat] = useState<RepeatValue>({ mode: 'inherit', months: null });

  useEffect(() => {
    if (!visible || !item) return;
    setName(item.name);
    if (item.repeat_mode === 'inherit') {
      setRepeat({ mode: 'inherit', months: null });
    } else {
      setRepeat({ mode: 'custom', months: item.repeat_months });
    }
  }, [visible, item]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Item', 'Ingresá el nombre del item');
      return;
    }
    const payload = {
      name: name.trim(),
      repeat_mode: repeat.mode,
      repeat_months: repeat.mode === 'custom' ? repeat.months : null,
    };
    const parsed = listItemDraftSchema.safeParse(payload);
    if (!parsed.success) {
      Alert.alert('Item', parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    try {
      await onSave({ ...parsed.data, repeat_months: parsed.data.repeat_months ?? null });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar');
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            className="rounded-t-3xl bg-white"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between border-b border-ink-100 px-5 py-4">
              <Text className="text-xl font-bold text-ink-900">Editar item</Text>
              <Pressable
                onPress={onClose}
                className="h-9 w-9 items-center justify-center rounded-full bg-ink-100"
                hitSlop={8}
              >
                <X color="#334155" size={18} />
              </Pressable>
            </View>

            <View className="gap-4 px-5 py-4">
              <View>
                <Text className="mb-1 text-xs font-medium text-ink-500">Nombre</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Nombre del item"
                  placeholderTextColor="#94A3B8"
                  className="rounded-2xl border border-ink-200 px-4 py-3 text-ink-900"
                  autoFocus
                />
              </View>

              <View>
                <Text className="mb-2 text-xs font-medium text-ink-500">Repetición</Text>
                <Text className="mb-2 text-xs text-ink-400">
                  Categoría: {formatRepeatLabel(categoryRepeatMonths)}
                </Text>
                <RepeatPicker value={repeat} onChange={setRepeat} allowInherit />
              </View>

              <Pressable
                onPress={handleSave}
                disabled={saving}
                className="items-center rounded-2xl bg-brand-700 py-3.5 active:opacity-90"
              >
                <Text className="font-semibold text-white">{saving ? 'Guardando…' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
