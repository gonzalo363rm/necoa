import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { DateField } from '@/src/components/DateField';
import { TagGlyph, TAG_ICON_OPTIONS } from '@/src/components/TagGlyph';
import { TagPickerModal } from '@/src/components/TagPickerModal';
import { useAuth } from '@/src/hooks/useAuth';
import {
  demoUser,
  useCreateTransaction,
  useDeleteTransaction,
  useFamilyContext,
  useMembers,
  useTags,
  useTransaction,
  useUpdateTransaction,
} from '@/src/hooks/useFamilyData';
import { formatAmountAsYouType, formatLocaleNumber, normalizeAmountInput } from '@/src/lib/finance';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { randomTagColor, TAG_COLORS } from '@/src/lib/tags';
import { transactionSchema } from '@/src/schemas';
import type { TagCategory, TransactionType } from '@/src/types/domain';

type SplitDraft = { user_id: string; share_pct: string; selected: boolean };

export default function AddTransactionModal() {
  const params = useLocalSearchParams<{ id?: string }>();
  const transactionId = typeof params.id === 'string' ? params.id : null;
  const isEditing = Boolean(transactionId);

  const { user } = useAuth();
  const userId = user?.id ?? (isSupabaseConfigured ? null : demoUser.id);
  const { familyId } = useFamilyContext();
  const membersQuery = useMembers(familyId);
  const tagsQuery = useTags(familyId);
  const existingQuery = useTransaction(transactionId);
  const createTx = useCreateTransaction(familyId, userId);
  const updateTx = useUpdateTransaction(familyId);
  const deleteTx = useDeleteTransaction(familyId);

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [occurredAt, setOccurredAt] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tagId, setTagId] = useState<string | null>(null);
  const [installments, setInstallments] = useState('');
  const [installmentCurrent, setInstallmentCurrent] = useState<number | null>(null);
  const [categoryOverride, setCategoryOverride] = useState<'living' | 'comfort' | null>(null);
  const [showNewTag, setShowNewTag] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagCategory, setNewTagCategory] = useState<TagCategory>('living');
  const [newTagIcon, setNewTagIcon] = useState<string | null>('tag');
  const [newTagColor, setNewTagColor] = useState(randomTagColor());
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [hydrated, setHydrated] = useState(!isEditing);

  useEffect(() => {
    if (isEditing || !membersQuery.data?.length || !userId) return;
    setSplits((current) => {
      const alreadyHasLoggedUser = current.some((s) => s.selected && s.user_id === userId);
      if (alreadyHasLoggedUser && current.length === membersQuery.data!.length) return current;
      return membersQuery.data!.map((m) => ({
        user_id: m.user_id,
        share_pct: m.user_id === userId ? '100' : '0',
        selected: m.user_id === userId,
      }));
    });
  }, [membersQuery.data, userId, isEditing]);

  useEffect(() => {
    if (!isEditing || !existingQuery.data || hydrated) return;
    const tx = existingQuery.data;
    setType(tx.type);
    setAmount(formatAmountAsYouType(formatLocaleNumber(Number(tx.amount))));
    setNote(tx.note ?? '');
    setOccurredAt(tx.occurred_at);
    setTagId(tx.tag_id);
    setInstallments(tx.installment_total ? String(tx.installment_total) : '');
    setInstallmentCurrent(tx.installment_current);
    setCategoryOverride(tx.category_override);
    setShowNewTag(false);

    const txSplits = tx.splits ?? [];
    if (txSplits.length > 0) {
      const selectedIds = new Set(txSplits.map((s) => s.user_id));
      setSplits(
        (membersQuery.data ?? []).map((m) => {
          const found = txSplits.find((s) => s.user_id === m.user_id);
          return {
            user_id: m.user_id,
            share_pct: found ? formatLocaleNumber(Number(found.share_pct)) : '0',
            selected: selectedIds.has(m.user_id),
          };
        }),
      );
    }
    setHydrated(true);
  }, [existingQuery.data, hydrated, isEditing, membersQuery.data]);

  const selectedTag = useMemo(
    () => (tagsQuery.data ?? []).find((t) => t.id === tagId) ?? null,
    [tagId, tagsQuery.data],
  );

  const previewTags = useMemo(() => {
    const all = tagsQuery.data ?? [];
    if (!tagId) return all.slice(0, 8);
    const selected = all.find((t) => t.id === tagId);
    if (!selected) return all.slice(0, 8);
    return [selected, ...all.filter((t) => t.id !== tagId)].slice(0, 8);
  }, [tagId, tagsQuery.data]);
  const needsOverride = selectedTag?.category === 'other' || showNewTag;
  const saving = createTx.isPending || updateTx.isPending || deleteTx.isPending;

  function toggleSplitMember(user_id: string) {
    setSplits((current) => {
      const next = current.map((s) =>
        s.user_id === user_id ? { ...s, selected: !s.selected, share_pct: !s.selected ? s.share_pct : '0' } : s,
      );
      const selected = next.filter((s) => s.selected);
      if (selected.length === 0) return current;
      if (selected.length === 1) {
        return next.map((s) => (s.selected ? { ...s, share_pct: '100' } : { ...s, share_pct: '0' }));
      }
      const equal = (100 / selected.length).toFixed(2).replace('.', ',');
      return next.map((s) => (s.selected ? { ...s, share_pct: equal } : { ...s, share_pct: '0' }));
    });
  }

  function setSplitPct(user_id: string, share_pct: string) {
    setSplits((current) => current.map((s) => (s.user_id === user_id ? { ...s, share_pct, selected: true } : s)));
  }

  async function onSave() {
    const normalizedAmount = normalizeAmountInput(amount);
    setAmount(formatAmountAsYouType(normalizedAmount));

    const selectedSplits = splits
      .filter((s) => s.selected)
      .map((s) => ({ user_id: s.user_id, share_pct: s.share_pct }));

    const parsed = transactionSchema.safeParse({
      type,
      amount: normalizedAmount,
      occurred_at: occurredAt,
      splits: selectedSplits,
      tag_id: type === 'expense' && !showNewTag ? tagId : null,
      note: note || null,
      installment_total: installments || null,
      installment_current: installments
        ? installmentCurrent && installmentCurrent >= 1
          ? installmentCurrent
          : 1
        : null,
      category_override: needsOverride ? categoryOverride : null,
      create_tag: showNewTag
        ? {
            name: newTagName,
            icon: newTagIcon,
            color: newTagColor,
            category: newTagCategory === 'other' ? 'living' : newTagCategory,
          }
        : null,
    });

    if (!parsed.success) {
      Alert.alert('Revisá los datos', parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    if (needsOverride && !showNewTag && !categoryOverride) {
      Alert.alert('Categoría', 'Para Otros, elegí necesidades o comodidades');
      return;
    }

    try {
      if (isEditing && transactionId) {
        await updateTx.mutateAsync({ id: transactionId, values: parsed.data });
      } else {
        await createTx.mutateAsync(parsed.data);
      }
      router.back();
    } catch (e) {
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'No se pudo guardar';
      Alert.alert('Error', message);
    }
  }

  function onDelete() {
    if (!transactionId) return;
    Alert.alert('Eliminar movimiento', '¿Seguro que querés borrarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTx.mutateAsync(transactionId);
            router.back();
          } catch (e) {
            const message =
              e && typeof e === 'object' && 'message' in e
                ? String((e as { message: unknown }).message)
                : 'No se pudo eliminar';
            Alert.alert('Error', message);
          }
        },
      },
    ]);
  }

  if (isEditing && (existingQuery.isLoading || !hydrated)) {
    return (
      <>
        <Stack.Screen options={{ title: 'Editar movimiento', headerShadowVisible: false }} />
        <View className="flex-1 items-center justify-center bg-ink-50">
          <ActivityIndicator color="#0D9488" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ title: isEditing ? 'Editar movimiento' : 'Nuevo movimiento', headerShadowVisible: false }}
      />
      <ScrollView className="flex-1 bg-ink-50" contentContainerClassName="px-5 pb-10 pt-4">
        <View className="mb-3 flex-row gap-2">
          {([
            ['expense', 'Gasto'],
            ['income', 'Ingreso'],
          ] as const).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setType(id)}
              className={`flex-1 items-center rounded-2xl py-3 ${type === id ? 'bg-brand-700' : 'border border-ink-200 bg-white'}`}
            >
              <Text className={type === id ? 'font-bold text-white' : 'font-medium text-ink-700'}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="mb-1 text-sm text-ink-500">Monto</Text>
        <TextInput
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={(v) => setAmount(formatAmountAsYouType(v))}
          onBlur={() =>
            setAmount((current) =>
              current.trim() ? formatAmountAsYouType(normalizeAmountInput(current)) : current,
            )
          }
          placeholder="0,00"
          placeholderTextColor="#94A3B8"
          className="mb-3 rounded-2xl border border-ink-200 bg-white px-4 py-3 text-2xl font-bold text-ink-900"
        />

        <DateField label="Fecha" value={occurredAt} onChange={setOccurredAt} compact />

        <Text className="mb-2 text-sm text-ink-500">Quiénes y en qué %</Text>
        <View className="mb-3 gap-2">
          {(membersQuery.data ?? []).map((m) => {
            const draft = splits.find((s) => s.user_id === m.user_id);
            const active = Boolean(draft?.selected);
            return (
              <View
                key={m.id}
                className={`flex-row items-center gap-2 rounded-2xl border px-3 py-2 ${
                  active ? 'border-brand-600 bg-brand-50' : 'border-ink-200 bg-white'
                }`}
              >
                <Pressable onPress={() => toggleSplitMember(m.user_id)} className="flex-1">
                  <Text className="font-medium text-ink-900">{m.profile?.display_name ?? 'Miembro'}</Text>
                </Pressable>
                {active ? (
                  <TextInput
                    keyboardType="decimal-pad"
                    value={draft?.share_pct ?? ''}
                    onChangeText={(v) => setSplitPct(m.user_id, v)}
                    onBlur={() =>
                      setSplitPct(
                        m.user_id,
                        draft?.share_pct?.trim() ? normalizeAmountInput(draft.share_pct) : '0,00',
                      )
                    }
                    className="w-20 rounded-xl border border-ink-200 bg-white px-2 py-1 text-center text-ink-900"
                    placeholder="%"
                    placeholderTextColor="#94A3B8"
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        {type === 'expense' ? (
          <>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-sm text-ink-500">Etiqueta</Text>
              <Pressable onPress={() => setTagPickerOpen(true)}>
                <Text className="text-sm font-medium text-brand-700">Ver todas</Text>
              </Pressable>
            </View>
            <View className="mb-3 flex-row flex-wrap gap-2">
              {previewTags.map((tag) => {
                const active = !showNewTag && tagId === tag.id;
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => {
                      setShowNewTag(false);
                      setTagId(tag.id);
                      if (tag.category !== 'other') setCategoryOverride(null);
                    }}
                    className={`flex-row items-center gap-2 rounded-full px-3 py-2 ${
                      active ? 'border border-brand-600 bg-brand-100' : 'border border-ink-200 bg-white'
                    }`}
                  >
                    <TagGlyph name={tag.icon} label={tag.name} color={tag.color} size={14} />
                    <Text className="text-xs text-ink-800">{tag.name}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  setShowNewTag(true);
                  setTagId(null);
                  setNewTagColor(randomTagColor());
                }}
                className={`rounded-full px-3 py-2 ${showNewTag ? 'bg-brand-700' : 'bg-ink-900'}`}
              >
                <Text className="text-xs text-white">+ Nuevo</Text>
              </Pressable>
            </View>

            {showNewTag ? (
              <View className="mb-4 rounded-2xl border border-ink-200 bg-white p-3">
                <TextInput
                  value={newTagName}
                  onChangeText={setNewTagName}
                  placeholder="Nombre del tag"
                  placeholderTextColor="#94A3B8"
                  className="rounded-xl border border-ink-200 px-3 py-2 text-ink-900"
                />
                <View className="mt-2 flex-row gap-2">
                  {([
                    ['living', 'Necesidades'],
                    ['comfort', 'Comodidades'],
                  ] as const).map(([id, label]) => (
                    <Pressable
                      key={id}
                      onPress={() => setNewTagCategory(id)}
                      className={`rounded-full px-3 py-1.5 ${newTagCategory === id ? 'bg-brand-700' : 'bg-ink-100'}`}
                    >
                      <Text className={`text-xs ${newTagCategory === id ? 'text-white' : 'text-ink-700'}`}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text className="mb-2 mt-3 text-xs text-ink-500">Color</Text>
                <View className="mb-2 flex-row flex-wrap gap-2">
                  {TAG_COLORS.slice(0, 12).map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setNewTagColor(c)}
                      className={`h-8 w-8 rounded-full ${newTagColor === c ? 'border-2 border-ink-900' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </View>
                <Text className="mb-2 text-xs text-ink-500">Icono (opcional)</Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => setNewTagIcon(null)}
                    className={`h-10 w-10 items-center justify-center rounded-xl ${
                      newTagIcon === null ? 'border border-brand-600 bg-brand-100' : 'bg-ink-50'
                    }`}
                  >
                    <TagGlyph name={null} label={newTagName || 'AA'} color={newTagColor} size={14} />
                  </Pressable>
                  {TAG_ICON_OPTIONS.slice(0, 12).map((opt) => (
                    <Pressable
                      key={opt}
                      onPress={() => setNewTagIcon(opt)}
                      className={`h-10 w-10 items-center justify-center rounded-xl ${
                        newTagIcon === opt ? 'border border-brand-600 bg-brand-100' : 'bg-ink-50'
                      }`}
                    >
                      <TagGlyph name={opt} color={newTagColor} size={16} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {selectedTag?.category === 'other' ? (
              <View className="mb-4">
                <Text className="mb-2 text-sm text-ink-500">Clasificar este gasto</Text>
                <View className="flex-row gap-2">
                  {([
                    ['living', 'Necesidades'],
                    ['comfort', 'Comodidades'],
                  ] as const).map(([id, label]) => (
                    <Pressable
                      key={id}
                      onPress={() => setCategoryOverride(id)}
                      className={`rounded-full px-3 py-1.5 ${
                        categoryOverride === id ? 'bg-brand-700' : 'border border-ink-200 bg-white'
                      }`}
                    >
                      <Text className={`text-xs ${categoryOverride === id ? 'text-white' : 'text-ink-700'}`}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Text className="mb-1 text-sm text-ink-500">Cuotas (opcional)</Text>
            <TextInput
              keyboardType="numeric"
              value={installments}
              onChangeText={setInstallments}
              placeholder="Ej: 6"
              placeholderTextColor="#94A3B8"
              className="mb-4 rounded-2xl border border-ink-200 bg-white px-4 py-3 text-ink-900"
            />
          </>
        ) : null}

        <Text className="mb-1 text-sm text-ink-500">Nota</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Opcional"
          placeholderTextColor="#94A3B8"
          className="mb-6 rounded-2xl border border-ink-200 bg-white px-4 py-3 text-ink-900"
        />

        <Pressable
          onPress={onSave}
          disabled={saving}
          className="items-center rounded-2xl bg-brand-700 py-4 active:opacity-90"
        >
          {saving && !deleteTx.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-bold text-white">
              {isEditing ? 'Guardar cambios' : 'Guardar'}
            </Text>
          )}
        </Pressable>

        {isEditing ? (
          <Pressable
            onPress={onDelete}
            disabled={saving}
            className="mt-3 items-center rounded-2xl border border-danger/30 bg-white py-4"
          >
            {deleteTx.isPending ? (
              <ActivityIndicator color="#DC2626" />
            ) : (
              <Text className="text-base font-bold text-danger">Eliminar movimiento</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>

      <TagPickerModal
        visible={tagPickerOpen}
        tags={tagsQuery.data ?? []}
        selectedId={tagId}
        onClose={() => setTagPickerOpen(false)}
        onSelect={(tag) => {
          setShowNewTag(false);
          setTagId(tag.id);
          if (tag.category !== 'other') setCategoryOverride(null);
        }}
        onCreateNew={() => {
          setTagPickerOpen(false);
          setShowNewTag(true);
          setTagId(null);
          setNewTagColor(randomTagColor());
        }}
      />
    </>
  );
}
