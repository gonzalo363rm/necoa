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

/** Thrown when the user owns another group with members and must pick a successor first. */
export class OwnerHandoffRequiredError extends Error {
  constructor(public token: string) {
    super('Elegí quién queda a cargo de tu grupo actual');
    this.name = 'OwnerHandoffRequiredError';
  }
}

export type HandoffCandidate = {
  family_id: string;
  family_name: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
};

export async function acceptFamilyInvite(token: string, newOwnerId?: string | null): Promise<Family> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no configurado');
  }
  const { data, error } = await supabase.rpc('accept_family_invite', {
    invite_token: token,
    new_owner_id: newOwnerId ?? null,
  });
  if (error) {
    if (error.message?.includes('OWNER_HANDOFF_REQUIRED')) throw new OwnerHandoffRequiredError(token);
    throw error;
  }
  await clearPendingInviteToken();
  return data as Family;
}

export async function fetchHandoffCandidates(token: string): Promise<HandoffCandidate[]> {
  const { data, error } = await supabase.rpc('invite_owner_handoff_candidates', { invite_token: token });
  if (error) throw error;
  return (data ?? []) as HandoffCandidate[];
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
