import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/src/hooks/useAuth';
import { consumePendingInvite } from '@/src/lib/invites';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { useSessionStore } from '@/src/stores';

export default function Index() {
  const { session, loading } = useAuth();
  const params = useLocalSearchParams<{ invite?: string }>();
  const setActiveFamilyId = useSessionStore((s) => s.setActiveFamilyId);
  const [ready, setReady] = useState(false);

  const inviteToken = typeof params.invite === 'string' ? params.invite : null;

  useEffect(() => {
    if (loading || inviteToken) return;

    let cancelled = false;

    async function boot() {
      if (session && isSupabaseConfigured) {
        try {
          const family = await consumePendingInvite();
          if (family?.id && !cancelled) {
            setActiveFamilyId(family.id);
          }
        } catch {
          // leave pending token; user can open invite again
        }
      }
      if (!cancelled) setReady(true);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [loading, session, inviteToken, setActiveFamilyId]);

  if (inviteToken) {
    return <Redirect href={{ pathname: '/invite', params: { token: inviteToken } }} />;
  }

  if (loading || !ready) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-50">
        <ActivityIndicator color="#0D9488" />
      </View>
    );
  }

  if (!isSupabaseConfigured) {
    return <Redirect href="/(app)" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(app)" />;
}
