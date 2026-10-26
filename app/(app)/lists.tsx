import { addMonths, format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Minus,
  Pencil,
  Plus,
  Square,
  Trash2,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListCategoryModal, type ListCategoryModalMode } from '@/src/components/ListCategoryModal';
import { PageTitle } from '@/src/components/PageTitle';
import { ListItemEditModal } from '@/src/components/ListItemEditModal';
import { CategoryItemsList } from '@/src/components/lists/CategoryItemsList';
import { ListsScroll } from '@/src/components/lists/ListsScroll';
import { formatRepeatLabel } from '@/src/components/RepeatPicker';
import { WebShell } from '@/src/components/WebShell';
import { useAppRefresh } from '@/src/hooks/useAppRefresh';
import { useAuth } from '@/src/hooks/useAuth';
import { useFamilyContext } from '@/src/hooks/useFamilyData';
import {
  useAddListItems,
  useArchiveListItems,
  useListMonth,
  useReorderListItems,
  useSaveListCategory,
  useSetEntriesStatus,
  useUpdateListItem,
} from '@/src/hooks/useLists';
import { useFiltersStore } from '@/src/stores';
import type { ListCategoryWithItems, ListItemWithEntry } from '@/src/types/domain';

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; categoryId: string }
  | { mode: 'add-items'; categoryId: string }
  | null;

function categoryDoneCount(cat: ListCategoryWithItems) {
  const active = cat.items.filter((i) => i.entry && i.entry.status !== 'skipped');
  const done = active.filter((i) => i.entry?.status === 'done').length;
  return { done, total: active.length };
}

function isCategoryComplete(cat: ListCategoryWithItems) {
  const { done, total } = categoryDoneCount(cat);
  return total > 0 && done === total;
}

export default function ListsScreen() {
  const month = useFiltersStore((s) => s.month);
  const setMonth = useFiltersStore((s) => s.setMonth);
  const { familyId } = useFamilyContext();
  const { user } = useAuth();
  const listsQuery = useListMonth(familyId, month);
  const { refreshing, onRefresh } = useAppRefresh();

  const saveCategory = useSaveListCategory(familyId, month);
  const addItems = useAddListItems(familyId, month);
  const setStatus = useSetEntriesStatus(familyId);
  const archiveItems = useArchiveListItems(familyId);
  const reorderItems = useReorderListItems(familyId);
  const updateItem = useUpdateListItem(familyId, month);

  const [showDone, setShowDone] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);
  const [editingItem, setEditingItem] = useState<ListItemWithEntry | null>(null);
  const [deleteSheet, setDeleteSheet] = useState(false);
  const [localItems, setLocalItems] = useState<Record<string, ListItemWithEntry[]>>({});

  const monthDate = parse(`${month}-01`, 'yyyy-MM-dd', new Date());
  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: es });

  const categories = useMemo(() => {
    const rows = listsQuery.data ?? [];
    if (showDone) return rows;
    return rows
      .filter((cat) => !isCategoryComplete(cat))
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((i) => i.entry?.status !== 'done'),
      }));
  }, [listsQuery.data, showDone]);

  useEffect(() => {
    const next: Record<string, ListItemWithEntry[]> = {};
    for (const cat of categories) {
      next[cat.id] = cat.items;
    }
    setLocalItems(next);
  }, [categories]);

  const selectedEntries = useMemo(() => {
    const all = (listsQuery.data ?? []).flatMap((c) => c.items);
    return all.filter((i) => i.entry && selected.has(i.entry.id));
  }, [listsQuery.data, selected]);

  const selectedEntryIds = selectedEntries.map((i) => i.entry!.id);

  function shiftMonth(delta: number) {
    setSelected(new Set());
    setMonth(format(addMonths(monthDate, delta), 'yyyy-MM'));
  }

  function toggleExpand(id: string) {
    setExpanded((curr) => ({ ...curr, [id]: !(curr[id] ?? true) }));
  }

  function isExpanded(id: string) {
    return expanded[id] ?? true;
  }

  function toggleSelect(entryId: string) {
    setSelected((curr) => {
      const next = new Set(curr);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  async function toggleItemDone(item: ListItemWithEntry) {
    if (!item.entry) return;
    const nextStatus = item.entry.status === 'done' ? 'pending' : 'done';
    await setStatus.mutateAsync({
      entryIds: [item.entry.id],
      status: nextStatus,
      userId: user?.id,
    });
  }

  async function toggleCategoryDone(cat: ListCategoryWithItems) {
    const entries = cat.items.filter((i) => i.entry);
    if (entries.length === 0) return;
    const allDone = entries.every((i) => i.entry?.status === 'done');
    await setStatus.mutateAsync({
      entryIds: entries.map((i) => i.entry!.id),
      status: allDone ? 'pending' : 'done',
      userId: user?.id,
    });
  }

  function categoryDoneState(cat: ListCategoryWithItems): 'none' | 'some' | 'all' {
    const entries = cat.items.filter((i) => i.entry);
    if (entries.length === 0) return 'none';
    const doneCount = entries.filter((i) => i.entry?.status === 'done').length;
    if (doneCount === 0) return 'none';
    if (doneCount === entries.length) return 'all';
    return 'some';
  }

  async function deleteThisMonth() {
    await setStatus.mutateAsync({ entryIds: selectedEntryIds, status: 'skipped' });
    setSelected(new Set());
    setDeleteSheet(false);
  }

  async function deleteAllMonths() {
    const itemIds = [...new Set(selectedEntries.map((i) => i.id))];
    await archiveItems.mutateAsync(itemIds);
    setSelected(new Set());
    setDeleteSheet(false);
  }

  function generatePayment() {
    if (selectedEntries.length === 0) return;
    const byCat = new Map<string, string[]>();
    for (const cat of listsQuery.data ?? []) {
      const names = cat.items
        .filter((i) => i.entry && selected.has(i.entry.id))
        .map((i) => i.name);
      if (names.length) byCat.set(cat.name, names);
    }
    const note = [...byCat.entries()]
      .map(([cat, names]) => `${cat}: ${names.join(', ')}`)
      .join('\n');
    const listEntryIds = selectedEntryIds.join(',');
    setSelected(new Set());
    router.push({
      pathname: '/add-transaction',
      params: { note, listEntryIds },
    });
  }

  const editingCategory =
    modal && (modal.mode === 'edit' || modal.mode === 'add-items')
      ? (listsQuery.data ?? []).find((c) => c.id === modal.categoryId) ?? null
      : null;

  const modalMode: ListCategoryModalMode = modal?.mode ?? 'create';
  const saving =
    saveCategory.isPending || addItems.isPending || setStatus.isPending || updateItem.isPending;

  const editingItemCategory = useMemo(() => {
    if (!editingItem) return null;
    return (listsQuery.data ?? []).find((c) => c.id === editingItem.category_id) ?? null;
  }, [editingItem, listsQuery.data]);

  return (
    <SafeAreaView className="flex-1 bg-ink-50" edges={['top']}>
      <PageTitle title="Listas" />
      <WebShell>
        <ListsScroll
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#0D9488"
              colors={['#0D9488']}
            />
          }
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-ink-900">Mis Listas</Text>
            <Pressable
              onPress={() => setModal({ mode: 'create' })}
              className="rounded-full bg-brand-700 px-4 py-2"
            >
              <Text className="text-sm font-medium text-white">+ Nueva categoría</Text>
            </Pressable>
          </View>

          <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-ink-100 bg-white px-3 py-2">
            <Pressable onPress={() => shiftMonth(-1)} className="p-2">
              <ChevronLeft color="#334155" />
            </Pressable>
            <Text className="font-medium capitalize text-ink-900">{monthLabel}</Text>
            <Pressable onPress={() => shiftMonth(1)} className="p-2">
              <ChevronRight color="#334155" />
            </Pressable>
          </View>

          <View className="mt-3 flex-row items-center justify-between rounded-2xl border border-ink-100 bg-white px-4 py-3">
            <Text className="text-sm text-ink-700">Mostrar listos</Text>
            <Switch
              value={showDone}
              onValueChange={setShowDone}
              trackColor={{ false: '#CBD5E1', true: '#5EEAD4' }}
              thumbColor={showDone ? '#0F766E' : '#f4f4f5'}
            />
          </View>
          <Text className="mt-2 text-xs text-ink-400">
            Tocá el check para marcar listo · Manténé para seleccionar · Arrastrá el asa para reordenar
          </Text>

          {listsQuery.isLoading ? (
            <ActivityIndicator className="mt-10" color="#0D9488" />
          ) : categories.length === 0 ? (
            <Text className="mt-10 text-center text-ink-500">
              {showDone
                ? 'Todavía no hay categorías. Creá la primera con “+ Nueva categoría”.'
                : 'No hay pendientes este mes. Activá “Mostrar listos” o creá una categoría.'}
            </Text>
          ) : (
            <View className="mt-4 gap-3">
              {categories.map((cat) => {
                const source = (listsQuery.data ?? []).find((c) => c.id === cat.id) ?? cat;
                const { done, total } = categoryDoneCount(source);
                const check = categoryDoneState(cat);
                const open = isExpanded(cat.id);
                const items = localItems[cat.id] ?? cat.items;
                return (
                  <View key={cat.id} className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
                    <View className="flex-row items-center gap-2 px-3 py-3">
                      <Pressable onPress={() => toggleCategoryDone(cat)} hitSlop={6} className="p-1">
                        {check === 'all' ? (
                          <CheckSquare color="#0F766E" size={22} />
                        ) : check === 'some' ? (
                          <Minus color="#0F766E" size={22} />
                        ) : (
                          <Square color="#94A3B8" size={22} />
                        )}
                      </Pressable>
                      <Pressable onPress={() => toggleExpand(cat.id)} className="min-w-0 flex-1">
                        <Text className="font-semibold text-ink-900" numberOfLines={1}>
                          {cat.name}
                        </Text>
                        <Text className="text-xs text-ink-500">
                          {done}/{total} listos
                          {cat.repeat_months != null
                            ? ` · ${formatRepeatLabel(cat.repeat_months)}`
                            : ' · Sin repetir'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setModal({ mode: 'add-items', categoryId: cat.id })}
                        className="rounded-full bg-brand-50 p-2"
                      >
                        <Plus color="#0F766E" size={16} />
                      </Pressable>
                      <Pressable
                        onPress={() => setModal({ mode: 'edit', categoryId: cat.id })}
                        className="rounded-full bg-ink-50 p-2"
                      >
                        <Pencil color="#64748B" size={16} />
                      </Pressable>
                      <Pressable onPress={() => toggleExpand(cat.id)} className="p-1">
                        {open ? (
                          <ChevronUp color="#64748B" size={18} />
                        ) : (
                          <ChevronDown color="#64748B" size={18} />
                        )}
                      </Pressable>
                    </View>

                    {open ? (
                      <View className="border-t border-ink-50 px-1 pb-2 pt-1">
                        {items.length === 0 ? (
                          <Text className="py-2 text-center text-sm text-ink-400">
                            Sin items este mes
                          </Text>
                        ) : (
                          <CategoryItemsList
                            items={items}
                            selectedEntryIds={selected}
                            onToggleDone={toggleItemDone}
                            onToggleSelect={toggleSelect}
                            onEdit={setEditingItem}
                            onReorder={(data) => {
                              setLocalItems((curr) => ({ ...curr, [cat.id]: data }));
                              reorderItems.mutate(data.map((i) => i.id));
                            }}
                          />
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </ListsScroll>

        {selected.size > 0 ? (
          <View className="absolute bottom-24 left-4 right-4 rounded-2xl border border-ink-100 bg-white px-3 py-3 shadow-lg shadow-black/10">
            <Text className="mb-2 text-center text-xs text-ink-500">
              {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
            </Text>
            <View className="flex-row flex-wrap justify-center gap-2">
              <Pressable
                onPress={() => setDeleteSheet(true)}
                className="rounded-full border border-danger/30 bg-red-50 px-3 py-2"
              >
                <Text className="text-xs font-medium text-danger">Eliminar</Text>
              </Pressable>
              <Pressable
                onPress={generatePayment}
                className="rounded-full border border-ink-200 bg-ink-50 px-3 py-2"
              >
                <Text className="text-xs font-medium text-ink-800">Generar pago</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </WebShell>

      <ListCategoryModal
        visible={modal !== null}
        mode={modalMode}
        category={editingCategory}
        saving={saving}
        onClose={() => setModal(null)}
        onSaveCreate={async (payload) => {
          await saveCategory.mutateAsync({
            values: { name: payload.name, repeat_months: payload.repeat_months },
            items: payload.items,
          });
          setModal(null);
        }}
        onSaveEdit={async (payload) => {
          if (!modal || modal.mode !== 'edit') return;
          await saveCategory.mutateAsync({
            id: modal.categoryId,
            values: { name: payload.name, repeat_months: payload.repeat_months },
          });
          setModal(null);
        }}
        onSaveItems={async (items) => {
          if (!modal || modal.mode !== 'add-items') return;
          await addItems.mutateAsync({ categoryId: modal.categoryId, items });
          setModal(null);
        }}
      />

      <ListItemEditModal
        visible={editingItem !== null}
        item={editingItem}
        categoryRepeatMonths={editingItemCategory?.repeat_months ?? null}
        saving={updateItem.isPending}
        onClose={() => setEditingItem(null)}
        onSave={async (payload) => {
          if (!editingItem) return;
          await updateItem.mutateAsync({
            id: editingItem.id,
            name: payload.name,
            repeat_mode: payload.repeat_mode,
            repeat_months: payload.repeat_months,
          });
          setEditingItem(null);
        }}
      />

      <Modal visible={deleteSheet} transparent animationType="fade" onRequestClose={() => setDeleteSheet(false)}>
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-black/40" onPress={() => setDeleteSheet(false)} />
          <View className="rounded-t-3xl bg-white px-5 pb-10 pt-5">
            <View className="mb-4 items-center">
              <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <Trash2 color="#DC2626" size={22} />
              </View>
              <Text className="text-lg font-bold text-ink-900">Eliminar selección</Text>
              <Text className="mt-1 text-center text-sm text-ink-500">
                ¿Solo de este mes o de todos los meses?
              </Text>
            </View>
            <Pressable
              onPress={deleteThisMonth}
              className="mb-2 items-center rounded-2xl border border-ink-200 py-3"
            >
              <Text className="font-medium text-ink-800">Solo este mes</Text>
            </Pressable>
            <Pressable
              onPress={deleteAllMonths}
              className="mb-2 items-center rounded-2xl bg-danger py-3"
            >
              <Text className="font-medium text-white">Todos los meses</Text>
            </Pressable>
            <Pressable onPress={() => setDeleteSheet(false)} className="items-center py-3">
              <Text className="text-ink-500">Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
