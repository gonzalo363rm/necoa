import * as AuthSession from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

/** Debe coincidir EXACTO con una Redirect URL de Supabase (sin ?query). */
export const MOBILE_OAUTH_REDIRECT =
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim() || 'https://necoa.vercel.app/auth/callback';

export function getAppDeepLink() {
  return AuthSession.makeRedirectUri({
    scheme: 'necoa',
    path: 'auth/callback',
  });
}

export function getOAuthRedirectUri() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  // En mobile: HTTPS fijo (mismo que en browser). Así Supabase no cae al Site URL.
  return MOBILE_OAUTH_REDIRECT;
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

function waitForAuthUrl(timeoutMs = 120_000): { promise: Promise<string>; cancel: () => void } {
  let sub: { remove: () => void } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    sub?.remove();
    if (timer) clearTimeout(timer);
  };

  const promise = new Promise<string>((resolve, reject) => {
    sub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('code=') || url.includes('access_token=')) {
        cancel();
        resolve(url);
      }
    });
    timer = setTimeout(() => {
      cancel();
      reject(new Error('timeout'));
    }, timeoutMs);
  });

  return { promise, cancel };
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) {
    throw new Error('Configurá EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env');
  }

  const redirectTo = getOAuthRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('No se pudo iniciar Google Auth');

  if (Platform.OS === 'web') {
    window.location.assign(data.url);
    return;
  }

  // Confirmá que Supabase metió nuestro redirect (si no, caeríamos en Site URL)
  const encoded = encodeURIComponent(redirectTo);
  if (!data.url.includes(encoded) && !data.url.includes(redirectTo)) {
    throw new Error(
      `Supabase rechazó el redirect.\nAgregá exactamente esto en Redirect URLs:\n${redirectTo}`,
    );
  }

  const deepLink = getAppDeepLink();
  const linking = waitForAuthUrl();

  try {
    // returnUrl = HTTPS: en iOS ASWebAuthenticationSession cierra al llegar al callback
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'success' && result.url) {
      linking.cancel();
      await createSessionFromUrl(result.url);
      return;
    }

    // Por si el OS abrió el deep link en paralelo
    try {
      const linkedUrl = await Promise.race([
        linking.promise,
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('no-link')), 1500)),
      ]);
      await createSessionFromUrl(linkedUrl);
      return;
    } catch {
      // ignore
    }

    throw new Error(
      `No volvió el callback a la app.\n` +
        `Redirect: ${redirectTo}\n` +
        `Deep link (también agregalo en Supabase): ${deepLink}\n` +
        `Si el browser quedó en Vercel, cerralo y reintentá; en iOS debería cerrarse solo al llegar a /auth/callback.`,
    );
  } finally {
    linking.cancel();
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
