import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';
import type { Family } from '@/src/types/domain';

const PENDING_INVITE_KEY = 'necoa-pending-invite-token';

export function extractInviteToken(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const fromQuery = parsed.queryParams?.token ?? parsed.queryParams?.invite;
    if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
    if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string') return fromQuery[0].trim();
  } catch {
    // fallback below
  }

  const match = url.match(/[?&#](?:token|invite)=([^&#]+)/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]).trim();
    } catch {
      return match[1].trim();
    }
  }
  return null;
}

export async function savePendingInviteToken(token: string) {
  await AsyncStorage.setItem(PENDING_INVITE_KEY, token);
}

export async function peekPendingInviteToken() {
  return AsyncStorage.getItem(PENDING_INVITE_KEY);
}

export async function clearPendingInviteToken() {
  await AsyncStorage.removeItem(PENDING_INVITE_KEY);
}

export async function acceptFamilyInvite(token: string): Promise<Family> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no configurado');
  }
  const { data, error } = await supabase.rpc('accept_family_invite', { invite_token: token });
  if (error) throw error;
  await clearPendingInviteToken();
  return data as Family;
}

/** Accept token now if logged in; otherwise park it for after login. */
export async function handleInviteToken(token: string): Promise<{ status: 'accepted' | 'pending_login'; family?: Family }> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no configurado');
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    await savePendingInviteToken(token);
    return { status: 'pending_login' };
  }
  const family = await acceptFamilyInvite(token);
  return { status: 'accepted', family };
}

export async function consumePendingInvite(): Promise<Family | null> {
  const token = await peekPendingInviteToken();
  if (!token) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  return acceptFamilyInvite(token);
}
