import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';
import { useSessionStore } from '@/src/stores';
import type { BudgetGoals, Family, FamilyMember, Tag, Transaction, TransactionType } from '@/src/types/domain';
import type { BudgetGoalsFormValues, TagFormValues, TransactionFormValues } from '@/src/schemas';

import { DEMO_FAMILY, DEMO_GOALS, DEMO_MEMBERS, DEMO_TAGS, DEMO_TRANSACTIONS, demoUser } from '@/src/lib/demo';

const TX_SELECT =
  '*, tag:tags(*), payer:profiles!transactions_paid_by_fkey(*), splits:transaction_splits(*, profile:profiles(*))';

function primaryPayerId(values: TransactionFormValues) {
  const sorted = [...values.splits].sort((a, b) => Number(b.share_pct) - Number(a.share_pct));
  return sorted[0]?.user_id ?? values.paid_by!;
}

async function resolveTagId(familyId: string, values: TransactionFormValues): Promise<string | null> {
  if (values.type !== 'expense') return null;
  if (values.create_tag) {
    const { data, error } = await supabase
      .from('tags')
      .insert({
        family_id: familyId,
        name: values.create_tag.name,
        icon: values.create_tag.icon ?? null,
        color: values.create_tag.color,
        category: values.create_tag.category,
        is_system: false,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }
  return values.tag_id ?? null;
}

async function replaceSplits(transactionId: string, values: TransactionFormValues) {
  const { error: delError } = await supabase.from('transaction_splits').delete().eq('transaction_id', transactionId);
  if (delError) throw delError;
  const { error } = await supabase.from('transaction_splits').insert(
    values.splits.map((s) => ({
      transaction_id: transactionId,
      user_id: s.user_id,
      share_pct: s.share_pct,
    })),
  );
  if (error) throw error;
}

export function useFamilyContext() {
  const activeFamilyId = useSessionStore((s) => s.activeFamilyId);
  const setActiveFamilyId = useSessionStore((s) => s.setActiveFamilyId);

  const familiesQuery = useQuery({
    queryKey: ['families'],
    queryFn: async (): Promise<Family[]> => {
      if (!isSupabaseConfigured) return [DEMO_FAMILY];
      const { data: memberships, error } = await supabase
        .from('family_members')
        .select('family_id, families(*)')
        .eq('status', 'active');
      if (error) throw error;
      const families = (memberships ?? [])
        .map((m) => m.families as unknown as Family | Family[] | null)
        .flatMap((f) => (Array.isArray(f) ? f : f ? [f] : []));
      return families;
    },
  });

  const families = familiesQuery.data ?? [];
  const activeIsValid = Boolean(activeFamilyId && families.some((f) => f.id === activeFamilyId));
  const familyId = activeIsValid ? activeFamilyId : (families[0]?.id ?? null);

  useEffect(() => {
    if (!familiesQuery.isSuccess) return;

    const list = familiesQuery.data ?? [];
    // Evita IDs viejos en storage (p. ej. después de borrar users/familias en DB).
    if (activeFamilyId && !list.some((f) => f.id === activeFamilyId)) {
      setActiveFamilyId(list[0]?.id ?? null);
      return;
    }
    if (!activeFamilyId && list[0]?.id) {
      setActiveFamilyId(list[0].id);
    }
  }, [familiesQuery.data, familiesQuery.isSuccess, activeFamilyId, setActiveFamilyId]);

  return {
    familyId,
    families,
    isLoading: familiesQuery.isLoading,
    setActiveFamilyId,
    refetch: familiesQuery.refetch,
  };
}

export function useMembers(familyId: string | null) {
  return useQuery({
    queryKey: ['members', familyId],
    enabled: Boolean(familyId),
    queryFn: async (): Promise<FamilyMember[]> => {
      if (!isSupabaseConfigured) return DEMO_MEMBERS;
      const { data, error } = await supabase
        .from('family_members')
        .select('*, profile:profiles(*)')
        .eq('family_id', familyId!)
        .eq('status', 'active');
      if (error) throw error;
      return (data ?? []) as FamilyMember[];
    },
  });
}

export function useBudgetGoals(familyId: string | null) {
  return useQuery({
    queryKey: ['budget-goals', familyId],
    enabled: Boolean(familyId),
    queryFn: async (): Promise<BudgetGoals> => {
      if (!isSupabaseConfigured) return DEMO_GOALS;
      const { data, error } = await supabase.from('budget_goals').select('*').eq('family_id', familyId!).single();
      if (error) throw error;
      return data as BudgetGoals;
    },
  });
}

function sortTagsByUsage(tags: Tag[], tagIds: (string | null)[]) {
  const counts = new Map<string, number>();
  for (const tagId of tagIds) {
    if (!tagId) continue;
    counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
  }
  return [...tags].sort((a, b) => {
    const diff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });
}

export function useTags(familyId: string | null) {
  return useQuery({
    queryKey: ['tags', familyId],
    enabled: Boolean(familyId),
    queryFn: async (): Promise<Tag[]> => {
      if (!isSupabaseConfigured) {
        return sortTagsByUsage(
          DEMO_TAGS,
          DEMO_TRANSACTIONS.map((t) => t.tag_id),
        );
      }

      const [{ data, error }, { data: usage, error: usageError }] = await Promise.all([
        supabase.from('tags').select('*').or(`is_system.eq.true,family_id.eq.${familyId}`),
        supabase.from('transactions').select('tag_id').eq('family_id', familyId!).not('tag_id', 'is', null),
      ]);
      if (error) throw error;
      if (usageError) throw usageError;

      return sortTagsByUsage(
        (data ?? []) as Tag[],
        (usage ?? []).map((row) => row.tag_id as string | null),
      );
    },
  });
}

export function useTransactions(
  familyId: string | null,
  from: string,
  to: string,
  memberIds: string[],
  typeFilter: 'all' | TransactionType = 'all',
) {
  return useQuery({
    queryKey: ['transactions', familyId, from, to, memberIds, typeFilter],
    enabled: Boolean(familyId),
    queryFn: async (): Promise<Transaction[]> => {
      if (!isSupabaseConfigured) {
        return DEMO_TRANSACTIONS.filter((t) => t.occurred_at >= from && t.occurred_at <= to)
          .filter((t) => typeFilter === 'all' || t.type === typeFilter)
          .filter((t) => {
            if (memberIds.length === 0) return true;
            const splitIds = (t.splits ?? []).map((s) => s.user_id);
            return memberIds.some((id) => splitIds.includes(id) || t.paid_by === id);
          });
      }

      const { data, error } = await supabase
        .from('transactions')
        .select(TX_SELECT)
        .eq('family_id', familyId!)
        .gte('occurred_at', from)
        .lte('occurred_at', to)
        .order('occurred_at', { ascending: false });
      if (error) throw error;

      return ((data ?? []) as Transaction[])
        .filter((t) => typeFilter === 'all' || t.type === typeFilter)
        .filter((t) => {
          if (memberIds.length === 0) return true;
          const splitIds = (t.splits ?? []).map((s) => s.user_id);
          return memberIds.some((id) => splitIds.includes(id) || t.paid_by === id);
        });
    },
  });
}

export function useCreateFamily() {
  const qc = useQueryClient();
  const setActiveFamilyId = useSessionStore((s) => s.setActiveFamilyId);
  return useMutation({
    mutationFn: async (name: string) => {
      if (!isSupabaseConfigured) {
        setActiveFamilyId(DEMO_FAMILY.id);
        return DEMO_FAMILY;
      }
      const { data, error } = await supabase.rpc('create_family_with_defaults', { family_name: name });
      if (error) throw error;
      return data as Family;
    },
    onSuccess: (family) => {
      setActiveFamilyId(family.id);
      qc.invalidateQueries({ queryKey: ['families'] });
    },
  });
}

export function useSaveBudgetGoals(familyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: BudgetGoalsFormValues) => {
      if (!isSupabaseConfigured || !familyId) return values;
      const { error } = await supabase
        .from('budget_goals')
        .update({
          living_pct: values.living_pct,
          comfort_pct: values.comfort_pct,
          savings_pct: values.savings_pct,
        })
        .eq('family_id', familyId);
      if (error) throw error;
      return values;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-goals', familyId] }),
  });
}

export function useUpsertTag(familyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TagFormValues & { id?: string; is_system?: boolean }) => {
      if (!isSupabaseConfigured || !familyId) return payload;
      if (payload.id && payload.is_system) {
        const { error } = await supabase.from('tag_overrides').upsert({
          family_id: familyId,
          tag_id: payload.id,
          name: payload.name,
          icon: payload.icon ?? null,
          color: payload.color,
          category: payload.category,
        });
        if (error) throw error;
        return payload;
      }
      if (payload.id) {
        const { error } = await supabase
          .from('tags')
          .update({
            name: payload.name,
            icon: payload.icon ?? null,
            color: payload.color,
            category: payload.category,
          })
          .eq('id', payload.id)
          .eq('family_id', familyId);
        if (error) throw error;
        return payload;
      }
      const { error } = await supabase.from('tags').insert({
        family_id: familyId,
        name: payload.name,
        icon: payload.icon ?? null,
        color: payload.color,
        category: payload.category,
        is_system: false,
      });
      if (error) throw error;
      return payload;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags', familyId] }),
  });
}

export function useCreateTransaction(familyId: string | null, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      if (!isSupabaseConfigured || !familyId || !userId) {
        return { ok: true as const };
      }

      const tagId = await resolveTagId(familyId, values);
      const paidBy = primaryPayerId(values);
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          family_id: familyId,
          type: values.type,
          amount: values.amount,
          occurred_at: values.occurred_at,
          paid_by: paidBy,
          created_by: userId,
          tag_id: values.type === 'expense' ? tagId : null,
          note: values.note ?? null,
          installment_current: values.installment_current ?? null,
          installment_total: values.installment_total ?? null,
          category_override: values.category_override ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      await replaceSplits(data.id, values);
      return { ok: true as const };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['tags', familyId] });
    },
  });
}

export function useTransaction(transactionId: string | null) {
  return useQuery({
    queryKey: ['transaction', transactionId],
    enabled: Boolean(transactionId),
    queryFn: async (): Promise<Transaction> => {
      if (!isSupabaseConfigured) {
        const found = DEMO_TRANSACTIONS.find((t) => t.id === transactionId);
        if (!found) throw new Error('Movimiento no encontrado');
        return found;
      }
      const { data, error } = await supabase.from('transactions').select(TX_SELECT).eq('id', transactionId!).single();
      if (error) throw error;
      return data as Transaction;
    },
  });
}

export function useUpdateTransaction(familyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TransactionFormValues }) => {
      if (!isSupabaseConfigured || !familyId) {
        return { ok: true as const };
      }

      const tagId = await resolveTagId(familyId, values);
      const paidBy = primaryPayerId(values);
      const { error } = await supabase
        .from('transactions')
        .update({
          type: values.type,
          amount: values.amount,
          occurred_at: values.occurred_at,
          paid_by: paidBy,
          tag_id: tagId,
          note: values.note ?? null,
          installment_current: values.installment_current ?? null,
          installment_total: values.installment_total ?? null,
          category_override: values.category_override ?? null,
        })
        .eq('id', id)
        .eq('family_id', familyId);
      if (error) throw error;
      await replaceSplits(id, values);
      return { ok: true as const };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['transaction', vars.id] });
      qc.invalidateQueries({ queryKey: ['tags', familyId] });
    },
  });
}

export function useDeleteTransaction(familyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured || !familyId) {
        return { ok: true as const };
      }
      const { error } = await supabase.from('transactions').delete().eq('id', id).eq('family_id', familyId);
      if (error) throw error;
      return { ok: true as const };
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.removeQueries({ queryKey: ['transaction', id] });
      qc.invalidateQueries({ queryKey: ['tags', familyId] });
    },
  });
}

export function useInviteMember(familyId: string | null) {
  return useMutation({
    mutationFn: async (email: string) => {
      if (!isSupabaseConfigured || !familyId) return { email };
      const { data: userData } = await supabase.auth.getUser();
      const invitedBy = userData.user?.id;
      if (!invitedBy) throw new Error('No autenticado');
      const { error } = await supabase.from('family_invites').insert({
        family_id: familyId,
        email,
        invited_by: invitedBy,
      });
      if (error) throw error;

      const { data, error: fnError } = await supabase.functions.invoke('invite-member', {
        body: { family_id: familyId, email },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(String(data.error));
      return { email };
    },
  });
}

export { demoUser };
