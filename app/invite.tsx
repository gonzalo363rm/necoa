import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/src/hooks/useAuth';
import { handleInviteToken } from '@/src/lib/invites';
import { useSessionStore } from '@/src/stores';

export default function InviteScreen() {
  const params = useLocalSearchParams<{ token?: string; invite?: string }>();
  const { session, loading: authLoading } = useAuth();
  const setActiveFamilyId = useSessionStore((s) => s.setActiveFamilyId);
  const [message, setMessage] = useState('Procesando invitación…');
  const ranForToken = useRef<string | null>(null);

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

        if (result.family?.id) {
          setActiveFamilyId(result.family.id);
        }
        setMessage('¡Ya estás en el grupo familiar!');
        setTimeout(() => {
          if (!cancelled) router.replace('/(app)/family');
        }, 800);
      } catch (e) {
        if (cancelled) return;
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

  return (
    <View className="flex-1 items-center justify-center bg-ink-50 px-6">
      <ActivityIndicator color="#0D9488" />
      <Text className="mt-4 text-center text-sm text-ink-700">{message}</Text>
    </View>
  );
}
