import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';

import { createSessionFromUrl } from '@/src/lib/auth';

export default function AuthCallbackScreen() {
  const [message, setMessage] = useState('Completando inicio de sesión…');

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      try {
        const url =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.location.href
            : (await Linking.getInitialURL()) ?? Linking.createURL('auth/callback');

        await createSessionFromUrl(url);
        if (!cancelled) router.replace('/');
      } catch (e) {
        if (!cancelled) {
          setMessage(e instanceof Error ? e.message : 'No se pudo completar el login');
          setTimeout(() => {
            if (!cancelled) router.replace('/(auth)/login');
          }, 2500);
        }
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-ink-50 px-6">
      <ActivityIndicator color="#0D9488" />
      <Text className="mt-4 text-center text-sm text-ink-700">{message}</Text>
    </View>
  );
}
