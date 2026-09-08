import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/src/hooks/useAuth';
import { isSupabaseConfigured } from '@/src/lib/supabase';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-50">
        <ActivityIndicator color="#0D9488" />
      </View>
    );
  }

  // Demo mode without credentials goes straight into the app
  if (!isSupabaseConfigured) {
    return <Redirect href="/(app)" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(app)" />;
}
