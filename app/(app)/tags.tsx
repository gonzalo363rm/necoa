import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { TagGlyph, TAG_ICON_OPTIONS } from '@/src/components/TagGlyph';
import { WebShell } from '@/src/components/WebShell';
import { useFamilyContext, useTags, useUpsertTag } from '@/src/hooks/useFamilyData';
import { randomTagColor, TAG_COLORS } from '@/src/lib/tags';
import { tagSchema } from '@/src/schemas';
import type { Tag, TagCategory } from '@/src/types/domain';

const CATEGORIES: { id: TagCategory; label: string }[] = [
  { id: 'living', label: 'Necesidades' },
  { id: 'comfort', label: 'Comodidades' },
  { id: 'other', label: 'Otros' },
];

export default function TagsScreen() {
  const insets = useSafeAreaInsets();
  const { familyId } = useFamilyContext();
  const tagsQuery = useTags(familyId);
  const upsert = useUpsertTag(familyId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>('tag');
  const [color, setColor] = useState(randomTagColor());
  const [category, setCategory] = useState<TagCategory>('living');

  function openCreate() {
    setEditing(null);
    setName('');
    setIcon('tag');
    setColor(randomTagColor());
    setCategory('living');
    setOpen(true);
  }

  function openEdit(tag: Tag) {
    setEditing(tag);
    setName(tag.name);
    setIcon(tag.icon);
    setColor((tag.color as typeof color) ?? randomTagColor());
    setCategory(tag.category);
    setOpen(true);
  }

  async function save() {
    const parsed = tagSchema.safeParse({ name, icon, color, category });
    if (!parsed.success) {
      Alert.alert('Revisá el tag', parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    try {
      await upsert.mutateAsync({
        ...parsed.data,
        id: editing?.id,
        is_system: editing?.is_system,
      });
      setOpen(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ink-50" edges={['top']}>
      <WebShell>
        <View className="flex-row items-center justify-between px-5 pt-4">
          <Text className="text-2xl font-bold text-ink-900">Etiquetas</Text>
          <Pressable onPress={openCreate} className="rounded-full bg-brand-700 px-4 py-2">
            <Text className="font-medium text-white">Nueva</Text>
          </Pressable>
        </View>
        <Text className="px-5 pt-2 text-sm text-ink-500">Tocá una etiqueta para editarla</Text>

        <FlatList
          className="mt-4"
          contentContainerClassName="px-5 pb-28"
          data={tagsQuery.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openEdit(item)}
              className="mb-3 flex-row items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3"
            >
              <TagGlyph name={item.icon} label={item.name} color={item.color} background size={18} />
              <View className="flex-1">
                <Text className="font-medium text-ink-900">{item.name}</Text>
                <Text className="text-xs text-ink-500">
                  {item.category === 'living'
                    ? 'Necesidades'
                    : item.category === 'comfort'
                      ? 'Comodidades'
                      : 'Otros'}
                  {item.is_system ? ' · sistema' : ' · custom'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </WebShell>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="flex-1 justify-end bg-black/40">
            <Pressable className="flex-1" onPress={() => setOpen(false)} />
            <View
              className="max-h-[92%] rounded-t-3xl bg-white"
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            >
              <View className="flex-row items-center justify-between border-b border-ink-100 px-5 py-4">
                <Text className="text-xl font-bold text-ink-900">
                  {editing ? 'Editar tag' : 'Nuevo tag'}
                </Text>
                <Pressable
                  onPress={() => setOpen(false)}
                  className="h-9 w-9 items-center justify-center rounded-full bg-ink-100"
                  hitSlop={8}
                >
                  <X color="#334155" size={18} />
                </Pressable>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}
                showsVerticalScrollIndicator
              >
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Nombre"
                  className="rounded-2xl border border-ink-200 px-4 py-3 text-ink-900"
                  placeholderTextColor="#94A3B8"
                />
                <Text className="mb-2 mt-4 text-sm font-medium text-ink-700">Categoría</Text>
                <View className="flex-row flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setCategory(c.id)}
                      className={`rounded-full px-3 py-1.5 ${category === c.id ? 'bg-brand-700' : 'bg-ink-100'}`}
                    >
                      <Text className={category === c.id ? 'text-xs text-white' : 'text-xs text-ink-700'}>
                        {c.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text className="mb-2 mt-4 text-sm font-medium text-ink-700">Color</Text>
                <View className="flex-row flex-wrap gap-2">
                  {TAG_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      className={`h-8 w-8 rounded-full ${color === c ? 'border-2 border-ink-900' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </View>

                <Text className="mb-2 mt-4 text-sm font-medium text-ink-700">Icono</Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => setIcon(null)}
                    className={`h-11 w-11 items-center justify-center rounded-xl ${
                      icon === null ? 'border border-brand-600 bg-brand-100' : 'bg-ink-50'
                    }`}
                  >
                    <TagGlyph name={null} label={name || 'AA'} color={color} size={14} />
                  </Pressable>
                  {TAG_ICON_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt}
                      onPress={() => setIcon(opt)}
                      className={`h-11 w-11 items-center justify-center rounded-xl ${
                        icon === opt ? 'border border-brand-600 bg-brand-100' : 'bg-ink-50'
                      }`}
                    >
                      <TagGlyph name={opt} color={color} />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <View className="flex-row gap-3 border-t border-ink-100 px-5 pt-3">
                <Pressable
                  onPress={() => setOpen(false)}
                  className="flex-1 items-center rounded-2xl bg-ink-100 py-3.5"
                >
                  <Text className="font-medium text-ink-700">Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={save}
                  className="flex-1 items-center rounded-2xl bg-brand-700 py-3.5"
                >
                  <Text className="font-medium text-white">Guardar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
