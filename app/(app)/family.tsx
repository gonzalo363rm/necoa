import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { SurfaceCard } from '@/src/components/SurfaceCard';
import { WebShell } from '@/src/components/WebShell';
import { useAppRefresh } from '@/src/hooks/useAppRefresh';
import {
  useBudgetGoals,
  useFamilyContext,
  useInviteMember,
  useMembers,
  useSaveBudgetGoals,
} from '@/src/hooks/useFamilyData';
import { signOut } from '@/src/lib/auth';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { budgetGoalsSchema, inviteSchema } from '@/src/schemas';

export default function FamilyScreen() {
  const { familyId, families, isLoading } = useFamilyContext();
  const membersQuery = useMembers(familyId);
  const goalsQuery = useBudgetGoals(familyId);
  const saveGoals = useSaveBudgetGoals(familyId);
  const invite = useInviteMember(familyId);
  const { refreshing, onRefresh } = useAppRefresh();

  const [living, setLiving] = useState('40');
  const [comfort, setComfort] = useState('30');
  const [savings, setSavings] = useState('30');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!goalsQuery.data) return;
    setLiving(String(goalsQuery.data.living_pct));
    setComfort(String(goalsQuery.data.comfort_pct));
    setSavings(String(goalsQuery.data.savings_pct));
  }, [goalsQuery.data]);

  async function onSaveGoals() {
    const parsed = budgetGoalsSchema.safeParse({
      living_pct: living,
      comfort_pct: comfort,
      savings_pct: savings,
    });
    if (!parsed.success) {
      Alert.alert('Objetivos', parsed.error.issues[0]?.message ?? 'Inválidos');
      return;
    }
    try {
      await saveGoals.mutateAsync(parsed.data);
      Alert.alert('Listo', 'Objetivos actualizados');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar');
    }
  }

  async function onInvite() {
    const parsed = inviteSchema.safeParse({ email });
    if (!parsed.success) {
      Alert.alert('Invite', parsed.error.issues[0]?.message ?? 'Email inválido');
      return;
    }
    try {
      await invite.mutateAsync(parsed.data.email);
      setEmail('');
      Alert.alert('Invitación', 'Mail de invitación enviado.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo invitar');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ink-50" edges={['top']}>
      <WebShell>
      <ScrollView
        contentContainerClassName="gap-4 px-5 pb-28 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0D9488"
            colors={['#0D9488']}
          />
        }
      >
        <Text className="text-2xl font-bold text-ink-900">Familia</Text>

        {isLoading || !familyId ? (
          <View className="items-center py-10">
            <ActivityIndicator color="#0D9488" />
            <Text className="mt-3 text-sm text-ink-500">Preparando tu grupo familiar…</Text>
          </View>
        ) : (
          <>
            <SurfaceCard
              title={families.find((f) => f.id === familyId)?.name ?? families[0]?.name ?? 'Grupo Familiar'}
              subtitle={`${membersQuery.data?.length ?? 0} miembros`}
            >
              {(membersQuery.data ?? []).map((m) => (
                <Text key={m.id} className="mt-1 text-sm text-ink-700">
                  {m.profile?.display_name ?? m.profile?.email ?? m.user_id.slice(0, 8)}
                </Text>
              ))}
            </SurfaceCard>

            <SurfaceCard title="Objetivos %" subtitle="Deben sumar 100 (default 40/30/30)">
              <View className="mt-2 flex-row gap-2">
                {[
                  { label: 'Necesidades', value: living, set: setLiving },
                  { label: 'Comodidades', value: comfort, set: setComfort },
                  { label: 'Ahorro', value: savings, set: setSavings },
                ].map((field) => (
                  <View key={field.label} className="flex-1">
                    <Text className="mb-1 text-xs text-ink-500">{field.label}</Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={field.value}
                      onChangeText={field.set}
                      className="rounded-xl border border-ink-200 px-3 py-2 text-center text-ink-900"
                    />
                  </View>
                ))}
              </View>
              <Pressable onPress={onSaveGoals} className="mt-3 items-center rounded-2xl bg-brand-700 py-3">
                <Text className="font-medium text-white">Guardar objetivos</Text>
              </Pressable>
            </SurfaceCard>

            <SurfaceCard title="Invitar por email" subtitle="Sumá un miembro al grupo">
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#94A3B8"
                className="mt-2 rounded-2xl border border-ink-200 px-4 py-3 text-ink-900"
              />
              <Pressable onPress={onInvite} className="mt-3 items-center rounded-2xl bg-ink-900 py-3">
                <Text className="font-medium text-white">Enviar invite</Text>
              </Pressable>
            </SurfaceCard>
          </>
        )}

        {isSupabaseConfigured ? (
          <Pressable
            onPress={async () => {
              try {
                await signOut();
                router.replace('/(auth)/login');
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo cerrar sesión');
              }
            }}
            className="items-center rounded-2xl border border-ink-200 bg-white py-3"
          >
            <Text className="text-ink-700">Cerrar sesión</Text>
          </Pressable>
        ) : (
          <Text className="text-center text-xs text-ink-500">Modo demo (sin Supabase configurado)</Text>
        )}
      </ScrollView>
      </WebShell>
    </SafeAreaView>
  );
}
