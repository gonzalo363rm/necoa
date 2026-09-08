import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { getOAuthRedirectUri, signInWithGoogle } from '@/src/lib/auth';
import { isSupabaseConfigured } from '@/src/lib/supabase';

export default function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectUri = getOAuthRedirectUri();

  async function onGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-50">
      <View className="flex-1 justify-between px-6 pb-10 pt-16">
        <View>
          <Text className="text-5xl font-bold text-brand-800">Necoa</Text>
          <Text className="mt-4 text-lg leading-7 text-ink-700">
            Necesidades, comodidades y ahorro — en familia, con claridad.
          </Text>
          <Text className="mt-6 text-sm text-ink-500">
            Regla base 40 / 30 / 30. Podés cambiar tus objetivos cuando quieras.
          </Text>
        </View>

        <View className="gap-3">
          {!isSupabaseConfigured ? (
            <Text className="rounded-2xl bg-warn/15 px-4 py-3 text-sm text-ink-700">
              Falta configurar Supabase en `.env`. Mientras tanto podés explorar el modo demo desde el
              index.
            </Text>
          ) : null}
          {error ? <Text className="text-sm text-danger">{error}</Text> : null}
          <Pressable
            onPress={onGoogle}
            disabled={busy}
            className="items-center rounded-2xl bg-brand-700 px-5 py-4 active:opacity-90"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-bold text-white">Continuar con Google</Text>
            )}
          </Pressable>

          <View className="rounded-2xl border border-ink-100 bg-white px-4 py-3">
            <Text className="text-xs font-medium text-ink-700">Redirect (debe estar en Supabase)</Text>
            <Text selectable className="mt-1 text-xs leading-5 text-ink-500">
              {redirectUri}
            </Text>
            <Text className="mt-2 text-[11px] leading-4 text-ink-400">
              En la app usamos el mismo HTTPS que en el browser. Si el sheet se queda abierto en
              Vercel, cerralo: a veces iOS ya devolvió el code a Expo.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
