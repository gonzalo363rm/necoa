import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

/** En Expo Go: exp://…/auth/callback; nativo: necoa://auth/callback; web: https://…/auth/callback */
export function getAuthRedirectUri() {
  return Linking.createURL('auth/callback');
}

export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token, code, error, error_description } = params;

  if (error) {
    throw new Error(
      typeof error_description === 'string' ? error_description : String(error),
    );
  }

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return;
  }

  if (access_token && refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (sessionError) throw sessionError;
  }
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) {
    throw new Error('Configurá EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env');
  }

  const redirectTo = getAuthRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No se pudo iniciar Google Auth');

  // En web el OAuth vuelve a /auth/callback como navegación completa
  if (Platform.OS === 'web') {
    window.location.assign(data.url);
    return;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    throw new Error(
      `Inicio de sesión cancelado. Asegurate de permitir este redirect en Supabase:\n${redirectTo}`,
    );
  }

  await createSessionFromUrl(result.url);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
