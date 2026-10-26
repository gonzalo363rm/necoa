import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Plus, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RepeatPicker, type RepeatValue } from '@/src/components/RepeatPicker';
import { listCategorySchema, listItemDraftSchema } from '@/src/schemas';
import type { ListCategory } from '@/src/types/domain';

type ItemDraft = {
  key: string;
  name: string;
  repeat: RepeatValue;
};

export type ListCategoryModalMode = 'create' | 'add-items' | 'edit';

type Props = {
  visible: boolean;
  mode: ListCategoryModalMode;
  category?: ListCategory | null;
  saving?: boolean;
  onClose: () => void;
  onSaveCreate: (payload: {
    name: string;
    repeat_months: number | null;
    items: { name: string; repeat_mode: 'inherit' | 'custom'; repeat_months: number | null }[];
  }) => Promise<void>;
  onSaveEdit: (payload: { name: string; repeat_months: number | null }) => Promise<void>;
  onSaveItems: (
    items: { name: string; repeat_mode: 'inherit' | 'custom'; repeat_months: number | null }[],
  ) => Promise<void>;
};

function newDraft(inheritDefault = true): ItemDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    repeat: inheritDefault ? { mode: 'inherit', months: null } : { mode: 'custom', months: null },
  };
}

function draftsToPayload(drafts: ItemDraft[]) {
  return drafts.map((d) => ({
    name: d.name.trim(),
    repeat_mode: d.repeat.mode,
    repeat_months: d.repeat.mode === 'custom' ? d.repeat.months : null,
  }));
}

/** Exige texto en cada fila de item; no descarta filas vacías en silencio. */
function validateItemDrafts(drafts: ItemDraft[]): { ok: true; payload: ReturnType<typeof draftsToPayload> } | { ok: false; message: string } {
  if (drafts.length === 0) {
    return { ok: false, message: 'Agregá al menos un item' };
  }
  for (let i = 0; i < drafts.length; i++) {
    const trimmed = drafts[i]!.name.trim();
    if (!trimmed) {
      return { ok: false, message: `Completá el nombre del item ${i + 1}` };
    }
  }
  const payload = draftsToPayload(drafts);
  for (const row of payload) {
    const ok = listItemDraftSchema.safeParse(row);
    if (!ok.success) {
      return { ok: false, message: ok.error.issues[0]?.message ?? 'Item inválido' };
    }
  }
  return { ok: true, payload };
}

export function ListCategoryModal({
  visible,
  mode,
  category,
  saving,
  onClose,
  onSaveCreate,
  onSaveEdit,
  onSaveItems,
}: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [catRepeat, setCatRepeat] = useState<RepeatValue>({ mode: 'custom', months: null });
  const [items, setItems] = useState<ItemDraft[]>([newDraft()]);

  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && category) {
      setName(category.name);
      setCatRepeat({ mode: 'custom', months: category.repeat_months });
      setItems([]);
      return;
    }
    if (mode === 'add-items') {
      setName('');
      setItems([newDraft(true)]);
      return;
    }
    // create
    setName('');
    setCatRepeat({ mode: 'custom', months: null });
    setItems([newDraft(true)]);
  }, [visible, mode, category]);

  const title =
    mode === 'create' ? 'Nueva categoría' : mode === 'edit' ? 'Editar categoría' : 'Agregar items';

  async function onSave() {
    try {
      if (mode === 'edit') {
        if (!name.trim()) {
          Alert.alert('Categoría', 'Ingresá el nombre de la categoría');
          return;
        }
        const parsed = listCategorySchema.safeParse({
          name,
          repeat_months: catRepeat.months,
        });
        if (!parsed.success) {
          Alert.alert('Revisá los datos', parsed.error.issues[0]?.message ?? 'Datos inválidos');
          return;
        }
        await onSaveEdit({ name: parsed.data.name, repeat_months: parsed.data.repeat_months });
        return;
      }

      if (mode === 'add-items') {
        const validated = validateItemDrafts(items);
        if (!validated.ok) {
          Alert.alert('Items', validated.message);
          return;
        }
        await onSaveItems(validated.payload);
        return;
      }

      // create
      if (!name.trim()) {
        Alert.alert('Categoría', 'Ingresá el nombre de la categoría');
        return;
      }
      const parsed = listCategorySchema.safeParse({
        name,
        repeat_months: catRepeat.months,
      });
      if (!parsed.success) {
        Alert.alert('Revisá los datos', parsed.error.issues[0]?.message ?? 'Datos inválidos');
        return;
      }
      // Al crear se puede guardar sin items solo si hay una fila vacía única → se ignora.
      // Si hay más de una fila o alguna con texto parcial, se exige nombre en todas.
      const hasAnyText = items.some((d) => d.name.trim().length > 0);
      const onlyBlankSingle = items.length === 1 && !hasAnyText;
      let payload: ReturnType<typeof draftsToPayload> = [];
      if (!onlyBlankSingle) {
        const validated = validateItemDrafts(items);
        if (!validated.ok) {
          Alert.alert('Items', validated.message);
          return;
        }
        payload = validated.payload;
      }
      await onSaveCreate({
        name: parsed.data.name,
        repeat_months: parsed.data.repeat_months,
        items: payload,
      });
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
          className="max-h-[90%] rounded-t-3xl bg-white"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="flex-row items-center justify-between border-b border-ink-100 px-5 py-4">
            <Text className="text-xl font-bold text-ink-900">{title}</Text>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full bg-ink-100"
              hitSlop={8}
            >
              <X color="#334155" size={18} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-4 px-5 py-4"
            showsVerticalScrollIndicator={false}
          >
            {mode !== 'add-items' ? (
              <>
                <View>
                  <Text className="mb-1 text-xs font-medium text-ink-500">Nombre</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Ej. Supermercado"
                    placeholderTextColor="#94A3B8"
                    className="rounded-2xl border border-ink-200 px-4 py-3 text-ink-900"
                    autoFocus={mode === 'create' || mode === 'edit'}
                  />
                </View>
                <View>
                  <Text className="mb-2 text-xs font-medium text-ink-500">
                    Repetición por defecto de la categoría
                  </Text>
                  <RepeatPicker value={catRepeat} onChange={setCatRepeat} />
                </View>
              </>
            ) : null}

            {mode !== 'edit' ? (
              <View>
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs font-medium text-ink-500">Items</Text>
                  <Pressable
                    onPress={() => setItems((curr) => [...curr, newDraft(true)])}
                    className="flex-row items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5"
                  >
                    <Plus color="#0F766E" size={14} />
                    <Text className="text-xs font-medium text-brand-700">Agregar</Text>
                  </Pressable>
                </View>

                {items.map((item, index) => (
                  <View
                    key={item.key}
                    className="mb-3 rounded-2xl border border-ink-100 bg-ink-50 p-3"
                  >
                    <View className="flex-row items-center gap-2">
                      <TextInput
                        value={item.name}
                        onChangeText={(t) =>
                          setItems((curr) =>
                            curr.map((row, i) => (i === index ? { ...row, name: t } : row)),
                          )
                        }
                        placeholder={`Item ${index + 1}`}
                        placeholderTextColor="#94A3B8"
                        className="flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-ink-900"
                      />
                      <Pressable
                        onPress={() => setItems((curr) => curr.filter((_, i) => i !== index))}
                        className="rounded-full bg-white p-2"
                        disabled={items.length <= 1}
                      >
                        <Trash2 color={items.length <= 1 ? '#CBD5E1' : '#DC2626'} size={16} />
                      </Pressable>
                    </View>
                    <View className="mt-2">
                      <RepeatPicker
                        compact
                        allowInherit
                        value={item.repeat}
                        onChange={(next) =>
                          setItems((curr) =>
                            curr.map((row, i) => (i === index ? { ...row, repeat: next } : row)),
                          )
                        }
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View className="border-t border-ink-100 px-5 pt-3">
            <Pressable
              onPress={onSave}
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
