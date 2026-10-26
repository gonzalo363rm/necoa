import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/hooks/useAuth';
import {
  acceptFamilyInvite,
  clearPendingInviteToken,
  fetchHandoffCandidates,
  handleInviteToken,
  OwnerHandoffRequiredError,
  type HandoffCandidate,
} from '@/src/lib/invites';
import type { Family } from '@/src/types/domain';
import { useSessionStore } from '@/src/stores';

export default function InviteScreen() {
  const params = useLocalSearchParams<{ token?: string; invite?: string }>();
  const { session, loading: authLoading } = useAuth();
  const setActiveFamilyId = useSessionStore((s) => s.setActiveFamilyId);
  const [message, setMessage] = useState('Procesando invitación…');
  const [handoff, setHandoff] = useState<{ token: string; candidates: HandoffCandidate[] } | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const ranForToken = useRef<string | null>(null);

  function finishAccepted(family: Family | undefined) {
    if (family?.id) setActiveFamilyId(family.id);
    setHandoff(null);
    setMessage('¡Ya estás en el grupo familiar!');
    setTimeout(() => router.replace('/(app)/family'), 800);
  }

  useEffect(() => {
    if (authLoading) return;

    const token =
      (typeof params.token === 'string' && params.token) ||
      (typeof params.invite === 'string' && params.invite) ||
      null;

    if (!token) {
      setMessage('Invitación inválida');
      const t = setTimeout(() => router.replace('/'), 1500);
      return () => clearTimeout(t);
    }

    if (ranForToken.current === token) return;
    ranForToken.current = token;

    let cancelled = false;

    async function run() {
      try {
        const result = await handleInviteToken(token!);
        if (cancelled) return;

        if (result.status === 'pending_login') {
          setMessage('Iniciá sesión para unirte al grupo');
          router.replace('/(auth)/login');
          return;
        }

        finishAccepted(result.family);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof OwnerHandoffRequiredError) {
          try {
            const candidates = await fetchHandoffCandidates(e.token);
            if (!cancelled) setHandoff({ token: e.token, candidates });
          } catch (fetchError) {
            if (!cancelled) {
              setMessage(fetchError instanceof Error ? fetchError.message : 'No se pudo cargar tu grupo');
            }
          }
          return;
        }
        setMessage(e instanceof Error ? e.message : 'No se pudo aceptar la invitación');
        setTimeout(() => {
          if (!cancelled) router.replace(session ? '/(app)/family' : '/(auth)/login');
        }, 2800);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [authLoading, params.token, params.invite, session, setActiveFamilyId]);

  async function onConfirmHandoff() {
    if (!handoff || !selectedOwnerId) return;
    setSubmitting(true);
    setHandoffError(null);
    try {
      const family = await acceptFamilyInvite(handoff.token, selectedOwnerId);
      finishAccepted(family);
    } catch (e) {
      setHandoffError(e instanceof Error ? e.message : 'No se pudo aceptar la invitación');
    } finally {
      setSubmitting(false);
    }
  }

  if (handoff) {
    const familyName = handoff.candidates[0]?.family_name ?? 'tu grupo actual';
    const ready = Boolean(selectedOwnerId) && !submitting;
    return (
      <SafeAreaView className="flex-1 bg-ink-50">
        <ScrollView contentContainerClassName="px-6 pb-10 pt-10">
          <Text className="text-2xl font-bold text-ink-900">Antes de unirte</Text>
          <Text className="mt-2 text-sm leading-5 text-ink-500">
            Sos el creador de «{familyName}». Para unirte al nuevo grupo, elegí quién queda a cargo. Los datos
            de «{familyName}» quedan guardados para quienes siguen ahí.
          </Text>

          <View className="mt-5 gap-2">
            {handoff.candidates.map((c) => {
              const active = selectedOwnerId === c.user_id;
              return (
                <Pressable
                  key={c.user_id}
                  onPress={() => setSelectedOwnerId(c.user_id)}
                  className={`rounded-2xl border px-4 py-3 ${
                    active ? 'border-brand-600 bg-brand-50' : 'border-ink-100 bg-white'
                  }`}
                >
                  <Text className={`font-medium ${active ? 'text-brand-800' : 'text-ink-900'}`}>
                    {c.display_name ?? c.email ?? 'Miembro'}
                  </Text>
                  {c.email ? <Text className="mt-0.5 text-xs text-ink-500">{c.email}</Text> : null}
                </Pressable>
              );
            })}
          </View>

          {handoffError ? <Text className="mt-3 text-sm text-danger">{handoffError}</Text> : null}

          <Pressable
            onPress={onConfirmHandoff}
            disabled={!ready}
            className={`mt-6 items-center rounded-2xl py-3.5 ${ready ? 'bg-brand-700' : 'bg-ink-100'}`}
          >
            <Text className={`font-medium ${ready ? 'text-white' : 'text-ink-400'}`}>
              {submitting ? 'Uniéndote…' : 'Pasar el grupo y unirme'}
            </Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              await clearPendingInviteToken();
              router.replace('/(app)/family');
            }}
            className="mt-2 items-center py-3"
          >
            <Text className="font-medium text-ink-500">Ahora no</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-ink-50 px-6">
      <ActivityIndicator color="#0D9488" />
      <Text className="mt-4 text-center text-sm text-ink-700">{message}</Text>
    </View>
  );
}
