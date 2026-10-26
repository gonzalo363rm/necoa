import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';
import type { ListCategoryFormValues, ListItemDraftValues } from '@/src/schemas';
import type {
  ListCategory,
  ListCategoryWithItems,
  ListEntry,
  ListEntryStatus,
  ListItem,
} from '@/src/types/domain';

function monthStart(monthKey: string): string {
  return `${monthKey}-01`;
}

function effectiveRepeat(item: ListItem, category: ListCategory): number | null {
  if (item.repeat_mode === 'custom') return item.repeat_months;
  return category.repeat_months;
}

async function regeneratePendingFromMonth(familyId: string, fromMonth: string) {
  const from = monthStart(fromMonth);
  const { error: delError } = await supabase
    .from('list_entries')
    .delete()
    .eq('family_id', familyId)
    .eq('status', 'pending')
    .gte('month', from);
  if (delError) throw delError;
  const { error } = await supabase.rpc('ensure_list_entries', {
    fid: familyId,
    month_start: from,
  });
  if (error) throw error;
}

export function useListMonth(familyId: string | null, month: string) {
  return useQuery({
    queryKey: ['lists', familyId, month],
    enabled: Boolean(familyId),
    queryFn: async (): Promise<ListCategoryWithItems[]> => {
      if (!isSupabaseConfigured || !familyId) return [];

      const monthDate = monthStart(month);
      const { error: ensureError } = await supabase.rpc('ensure_list_entries', {
        fid: familyId,
        month_start: monthDate,
      });
      if (ensureError) throw ensureError;

      const [{ data: categories, error: catError }, { data: items, error: itemsError }, { data: entries, error: entriesError }] =
        await Promise.all([
          supabase
            .from('list_categories')
            .select('*')
            .eq('family_id', familyId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true }),
          supabase
            .from('list_items')
            .select('*')
            .eq('family_id', familyId)
            .is('archived_at', null)
            .order('sort_order', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase
            .from('list_entries')
            .select('*')
            .eq('family_id', familyId)
            .eq('month', monthDate)
            .neq('status', 'skipped'),
        ]);

      if (catError) throw catError;
      if (itemsError) throw itemsError;
      if (entriesError) throw entriesError;

      const entryByItem = new Map<string, ListEntry>();
      for (const e of (entries ?? []) as ListEntry[]) {
        entryByItem.set(e.item_id, e);
      }

      const cats = (categories ?? []) as ListCategory[];
      const allItems = (items ?? []) as ListItem[];

      return cats.map((cat) => {
        const visible = allItems
          .filter((i) => i.category_id === cat.id)
          .map((item) => ({
            ...item,
            entry: entryByItem.get(item.id) ?? null,
            effective_repeat_months: effectiveRepeat(item, cat),
          }))
          // Solo items con entrada este mes; la categoría se muestra igual si queda vacía.
          .filter((item) => item.entry !== null);

        return { ...cat, items: visible };
      });
    },
  });
}

export function useSaveListCategory(familyId: string | null, month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      values: ListCategoryFormValues;
      /** Solo al crear: items iniciales */
      items?: ListItemDraftValues[];
    }) => {
      if (!isSupabaseConfigured || !familyId) return null;
      const monthDate = monthStart(month);

      if (input.id) {
        const { data: prev, error: prevError } = await supabase
          .from('list_categories')
          .select('repeat_months')
          .eq('id', input.id)
          .single();
        if (prevError) throw prevError;

        const { error } = await supabase
          .from('list_categories')
          .update({
            name: input.values.name,
            repeat_months: input.values.repeat_months,
          })
          .eq('id', input.id)
          .eq('family_id', familyId);
        if (error) throw error;

        if (prev?.repeat_months !== input.values.repeat_months) {
          await regeneratePendingFromMonth(familyId, month);
        }
        return input.id;
      }

      const { data: cat, error } = await supabase
        .from('list_categories')
        .insert({
          family_id: familyId,
          name: input.values.name,
          repeat_months: input.values.repeat_months,
        })
        .select('id')
        .single();
      if (error) throw error;

      const drafts = input.items ?? input.values.items ?? [];
      if (drafts.length > 0) {
        // Primero en el draft = más arriba (sort_order más alto).
        const rows = drafts.map((d, index) => ({
          family_id: familyId,
          category_id: cat.id,
          name: d.name,
          repeat_mode: d.repeat_mode,
          repeat_months: d.repeat_mode === 'custom' ? (d.repeat_months ?? null) : null,
          start_month: monthDate,
          sort_order: drafts.length - index,
        }));
        const { error: itemsError } = await supabase.from('list_items').insert(rows);
        if (itemsError) throw itemsError;
      }

      const { error: ensureError } = await supabase.rpc('ensure_list_entries', {
        fid: familyId,
        month_start: monthDate,
      });
      if (ensureError) throw ensureError;

      return cat.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  });
}

async function nextSortOrder(categoryId: string): Promise<number> {
  const { data, error } = await supabase
    .from('list_items')
    .select('sort_order')
    .eq('category_id', categoryId)
    .is('archived_at', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.sort_order ?? 0) + 1;
}

export function useAddListItems(familyId: string | null, month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { categoryId: string; items: ListItemDraftValues[] }) => {
      if (!isSupabaseConfigured || !familyId) return;
      if (input.items.length === 0) return;
      const monthDate = monthStart(month);
      const next = await nextSortOrder(input.categoryId);
      // Nuevos arriba: el primero del draft queda con el sort_order más alto.
      const base = next + input.items.length - 1;
      const rows = input.items.map((d, index) => ({
        family_id: familyId,
        category_id: input.categoryId,
        name: d.name,
        repeat_mode: d.repeat_mode,
        repeat_months: d.repeat_mode === 'custom' ? (d.repeat_months ?? null) : null,
        start_month: monthDate,
        sort_order: base - index,
      }));
      const { error } = await supabase.from('list_items').insert(rows);
      if (error) throw error;
      const { error: ensureError } = await supabase.rpc('ensure_list_entries', {
        fid: familyId,
        month_start: monthDate,
      });
      if (ensureError) throw ensureError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  });
}

/** Persiste el orden visual (primer id = más arriba = sort_order más alto). */
export function useReorderListItems(familyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!isSupabaseConfigured || !familyId || orderedIds.length === 0) return;
      const total = orderedIds.length;
      await Promise.all(
        orderedIds.map(async (id, index) => {
          const { error } = await supabase
            .from('list_items')
            .update({ sort_order: total - index })
            .eq('id', id)
            .eq('family_id', familyId);
          if (error) throw error;
        }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  });
}

export function useSetEntriesStatus(familyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { entryIds: string[]; status: ListEntryStatus; userId?: string | null }) => {
      if (!isSupabaseConfigured || !familyId || input.entryIds.length === 0) return;
      const patch =
        input.status === 'done'
          ? {
              status: 'done' as const,
              done_at: new Date().toISOString(),
              done_by: input.userId ?? null,
            }
          : {
              status: input.status,
              done_at: null,
              done_by: null,
            };
      const { error } = await supabase
        .from('list_entries')
        .update(patch)
        .in('id', input.entryIds)
        .eq('family_id', familyId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  });
}

export function useArchiveListItems(familyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (!isSupabaseConfigured || !familyId || itemIds.length === 0) return;
      const { error } = await supabase
        .from('list_items')
        .update({ archived_at: new Date().toISOString() })
        .in('id', itemIds)
        .eq('family_id', familyId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  });
}

export function useDeleteListCategory(familyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categoryId: string) => {
      if (!isSupabaseConfigured || !familyId) return;
      const { error } = await supabase
        .from('list_categories')
        .delete()
        .eq('id', categoryId)
        .eq('family_id', familyId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  });
}

export function useUpdateListItem(familyId: string | null, month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      repeat_mode?: 'inherit' | 'custom';
      repeat_months?: number | null;
    }) => {
      if (!isSupabaseConfigured || !familyId) return;
      const { data: prev, error: prevError } = await supabase
        .from('list_items')
        .select('repeat_mode, repeat_months')
        .eq('id', input.id)
        .single();
      if (prevError) throw prevError;

      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.repeat_mode !== undefined) patch.repeat_mode = input.repeat_mode;
      if (input.repeat_months !== undefined) patch.repeat_months = input.repeat_months;

      const { error } = await supabase
        .from('list_items')
        .update(patch)
        .eq('id', input.id)
        .eq('family_id', familyId);
      if (error) throw error;

      const ruleChanged =
        (input.repeat_mode !== undefined && input.repeat_mode !== prev.repeat_mode) ||
        (input.repeat_months !== undefined && input.repeat_months !== prev.repeat_months);
      if (ruleChanged) {
        await regeneratePendingFromMonth(familyId, month);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists'] }),
  });
}
