import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { TagGlyph } from '@/src/components/TagGlyph';
import type { Tag } from '@/src/types/domain';

type Props = {
  visible: boolean;
  tags: Tag[];
  selectedId: string | null;
  onSelect: (tag: Tag) => void;
  onClose: () => void;
  onCreateNew?: () => void;
};

export function TagPickerModal({ visible, tags, selectedId, onSelect, onClose, onCreateNew }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [query, tags]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/30">
        <View className="h-[75%] rounded-t-3xl bg-white px-5 pb-8 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-ink-900">Etiquetas</Text>
            <Pressable onPress={onClose} className="rounded-full bg-ink-100 px-3 py-1.5">
              <Text className="text-sm text-ink-700">Cerrar</Text>
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar etiqueta..."
            placeholderTextColor="#94A3B8"
            className="mb-3 rounded-2xl border border-ink-200 px-4 py-3 text-ink-900"
            autoFocus
          />
          {onCreateNew ? (
            <Pressable
              onPress={onCreateNew}
              className="mb-3 items-center rounded-2xl border border-dashed border-brand-600 bg-brand-50 py-3"
            >
              <Text className="font-medium text-brand-700">+ Crear nueva etiqueta</Text>
            </Pressable>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = selectedId === item.id;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className={`mb-2 flex-row items-center gap-3 rounded-2xl border p-3 ${
                    active ? 'border-brand-600 bg-brand-50' : 'border-ink-100 bg-ink-50'
                  }`}
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
                    </Text>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text className="mt-8 text-center text-ink-500">Sin resultados</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}
