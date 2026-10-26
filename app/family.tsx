import { Info, UserMinus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';

import { FamilyInfoModal } from '@/src/components/FamilyInfoModal';
import { PageTitle } from '@/src/components/PageTitle';
import { SurfaceCard } from '@/src/components/SurfaceCard';
import { WebShell } from '@/src/components/WebShell';
import { useAppRefresh } from '@/src/hooks/useAppRefresh';
import { useAuth } from '@/src/hooks/useAuth';
import {
  demoUser,
  useBudgetGoals,
  useFamilyContext,
  useInviteMember,
  useLeaveFamily,
  useMembers,
  useRemoveMember,
  useSaveBudgetGoals,
  useTransferOwnership,
} from '@/src/hooks/useFamilyData';
import { signOut } from '@/src/lib/auth';
import { confirmAsync } from '@/src/lib/confirm';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { budgetGoalsSchema, inviteSchema } from '@/src/schemas';

type TransferMode = 'keep' | 'leave';

export default function FamilyScreen() {
  const { user } = useAuth();
  const currentUserId = user?.id ?? (isSupabaseConfigured ? null : demoUser.id);
  const { familyId, families, isLoading } = useFamilyContext();
  const membersQuery = useMembers(familyId);
  const goalsQuery = useBudgetGoals(familyId);
  const saveGoals = useSaveBudgetGoals(familyId);
  const invite = useInviteMember(familyId);
  const leaveFamily = useLeaveFamily(familyId);
  const removeMember = useRemoveMember(familyId);
  const transferOwnership = useTransferOwnership(familyId);
  const { refreshing, onRefresh } = useAppRefresh();

  const [living, setLiving] = useState('40');
  const [comfort, setComfort] = useState('30');
  const [savings, setSavings] = useState('30');
  const [email, setEmail] = useState('');
  const [transferMode, setTransferMode] = useState<TransferMode | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const members = membersQuery.data ?? [];
  const me = useMemo(
    () => members.find((m) => m.user_id === currentUserId) ?? null,
    [members, currentUserId],
  );
  const isOwner = me?.role === 'owner';
  const others = useMemo(
    () => members.filter((m) => m.user_id !== currentUserId),
    [members, currentUserId],
  );
  const canLeave = members.length > 1 && Boolean(me);
  const canTransfer = isOwner && others.length > 0;
  const transferBusy = leaveFamily.isPending || transferOwnership.isPending;

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

  function memberLabel(m: (typeof members)[number]) {
    return m.profile?.display_name ?? m.profile?.email ?? m.user_id.slice(0, 8);
  }

  async function onRemoveMember(memberUserId: string, label: string) {
    const ok = await confirmAsync(
      'Quitar del grupo',
      `${label} va a dejar de ver el grupo. Sus movimientos quedan guardados y, si lo volvés a invitar, recupera todo.`,
      'Quitar',
    );
    if (!ok) return;
    try {
      await removeMember.mutateAsync(memberUserId);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo quitar');
    }
  }

  async function onLeaveAsMember() {
    const ok = await confirmAsync(
      'Salir del grupo',
      'Vas a dejar de ver este grupo. Tus movimientos quedan guardados y, si te vuelven a invitar, recuperás todo.',
      'Salir',
    );
    if (!ok) return;
    try {
      await leaveFamily.mutateAsync(null);
      router.replace('/(app)');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo salir');
    }
  }

  function openTransfer(mode: TransferMode) {
    setSelectedOwnerId(null);
    setTransferMode(mode);
  }

  async function onLeavePress() {
    if (!canLeave) return;
    if (isOwner) {
      openTransfer('leave');
      return;
    }
    await onLeaveAsMember();
  }

  async function onConfirmTransfer() {
    if (!selectedOwnerId || !transferMode) return;
    const chosen = others.find((m) => m.user_id === selectedOwnerId);
    if (!chosen) return;

    if (transferMode === 'keep') {
      const ok = await confirmAsync(
        'Pasar el grupo',
        `${memberLabel(chosen)} queda a cargo. Vos seguís en el grupo como miembro.`,
        'Pasar el grupo',
      );
      if (!ok) return;
      try {
        await transferOwnership.mutateAsync(selectedOwnerId);
        setTransferMode(null);
        Alert.alert('Listo', `${memberLabel(chosen)} ahora es el creador del grupo`);
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo pasar el grupo');
      }
      return;
    }

    const ok = await confirmAsync(
      'Pasar el grupo y salir',
      `${memberLabel(chosen)} queda a cargo del grupo. Vos salís y dejás de verlo.`,
      'Pasar y salir',
    );
    if (!ok) return;
    try {
      await leaveFamily.mutateAsync(selectedOwnerId);
      setTransferMode(null);
      router.replace('/(app)');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo salir');
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Familia', headerShown: true, headerShadowVisible: false }} />
      <PageTitle title="Familia" />
      <WebShell>
        <ScrollView
          className="flex-1 bg-ink-50"
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
          {isLoading || !familyId ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#0D9488" />
              <Text className="mt-3 text-sm text-ink-500">Preparando tu grupo familiar…</Text>
            </View>
          ) : (
            <>
              <SurfaceCard
                title={
                  families.find((f) => f.id === familyId)?.name ?? families[0]?.name ?? 'Grupo Familiar'
                }
                subtitle={`${members.length} miembro${members.length === 1 ? '' : 's'}`}
                right={
                  <Pressable
                    onPress={() => setInfoOpen(true)}
                    hitSlop={8}
                    accessibilityLabel="Cómo funcionan los grupos"
                    className="h-8 w-8 items-center justify-center rounded-full bg-brand-50 active:opacity-80"
                  >
                    <Info color="#0F766E" size={18} />
                  </Pressable>
                }
              >
                {members.map((m, index) => {
                  const isMe = m.user_id === currentUserId;
                  const label = memberLabel(m);
                  return (
                    <View
                      key={m.id}
                      className={`flex-row items-center gap-2 ${index > 0 ? 'mt-2 border-t border-ink-100 pt-2' : 'mt-1'}`}
                    >
                      <View className="min-w-0 flex-1">
                        <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>
                          {label}
                        </Text>
                        <View className="mt-1 flex-row flex-wrap gap-1.5">
                          {m.role === 'owner' ? (
                            <View className="rounded-full bg-brand-50 px-2 py-0.5">
                              <Text className="text-[11px] font-medium text-brand-800">Creador</Text>
                            </View>
                          ) : null}
                          {isMe ? (
                            <View className="rounded-full bg-ink-100 px-2 py-0.5">
                              <Text className="text-[11px] font-medium text-ink-700">Vos</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      {isOwner && !isMe ? (
                        <Pressable
                          onPress={() => onRemoveMember(m.user_id, label)}
                          disabled={removeMember.isPending}
                          hitSlop={8}
                          className="h-9 w-9 items-center justify-center rounded-full border border-ink-100 bg-white active:opacity-80"
                        >
                          <UserMinus color="#DC2626" size={16} />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
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
            </>
          )}

          {canTransfer ? (
            <Pressable
              onPress={() => openTransfer('keep')}
              disabled={transferBusy}
              className="items-center rounded-2xl border border-ink-200 bg-white py-3 active:opacity-80"
            >
              <Text className="font-medium text-ink-800">Pasar el grupo</Text>
            </Pressable>
          ) : null}

          {canLeave ? (
            <Pressable
              onPress={onLeavePress}
              disabled={transferBusy}
              className="items-center rounded-2xl border border-ink-200 bg-white py-3 active:opacity-80"
            >
              <Text className="font-medium text-danger">
                {leaveFamily.isPending ? 'Saliendo…' : 'Salir del grupo'}
              </Text>
            </Pressable>
          ) : null}

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

      <FamilyInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />

      <Modal
        visible={transferMode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTransferMode(null)}
      >
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-black/40" onPress={() => setTransferMode(null)} />
          <View className="max-h-[85%] rounded-t-3xl bg-white">
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="px-5 pb-10 pt-5"
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-xl font-bold text-ink-900">
                {transferMode === 'leave' ? 'Pasar el grupo y salir' : 'Pasar el grupo'}
              </Text>
              <Text className="mt-1 text-sm text-ink-500">
                {transferMode === 'leave'
                  ? 'Elegí quién queda a cargo. Después salís y dejás de verlo.'
                  : 'Elegí quién queda a cargo. Vos seguís en el grupo como miembro.'}
              </Text>

              <View className="mt-4 gap-2">
                {others.map((m) => {
                  const active = selectedOwnerId === m.user_id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setSelectedOwnerId(m.user_id)}
                      className={`rounded-2xl border px-4 py-3 ${
                        active ? 'border-brand-600 bg-brand-50' : 'border-ink-100 bg-white'
                      }`}
                    >
                      <Text className={`font-medium ${active ? 'text-brand-800' : 'text-ink-900'}`}>
                        {memberLabel(m)}
                      </Text>
                      {m.profile?.email ? (
                        <Text className="mt-0.5 text-xs text-ink-500">{m.profile.email}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={onConfirmTransfer}
                disabled={!selectedOwnerId || transferBusy}
                className={`mt-5 items-center rounded-2xl py-3.5 ${
                  selectedOwnerId && !transferBusy ? 'bg-brand-700' : 'bg-ink-100'
                }`}
              >
                <Text
                  className={`font-medium ${
                    selectedOwnerId && !transferBusy ? 'text-white' : 'text-ink-400'
                  }`}
                >
                  {transferBusy
                    ? 'Guardando…'
                    : transferMode === 'leave'
                      ? 'Pasar el grupo y salir'
                      : 'Pasar el grupo'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setTransferMode(null)} className="mt-2 items-center py-3">
                <Text className="font-medium text-ink-500">Cancelar</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
