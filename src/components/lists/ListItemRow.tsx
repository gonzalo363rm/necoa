import type { ReactNode } from 'react';
import { CheckSquare, GripVertical, Pencil, Square } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatRepeatLabel } from '@/src/components/RepeatPicker';
import type { ListItemWithEntry } from '@/src/types/domain';

type Props = {
  item: ListItemWithEntry;
  selected: boolean;
  isActive?: boolean;
  onToggleDone: () => void;
  onToggleSelect: () => void;
  onEdit?: () => void;
  /** Native: long-press para iniciar drag. */
  onDragHandleLongPress?: () => void;
  /** Web u otros: reemplaza el asa por defecto. */
  dragHandle?: ReactNode;
};

export function ListItemRow({
  item,
  selected,
  isActive,
  onToggleDone,
  onToggleSelect,
  onEdit,
  onDragHandleLongPress,
  dragHandle,
}: Props) {
  const done = item.entry?.status === 'done';
  return (
    <View
      className={`mx-2 mb-1 flex-row items-center gap-2 rounded-xl border px-2 py-2 ${
        isActive ? 'border-transparent bg-brand-50' : selected ? 'border-brand-600 bg-ink-50' : 'border-transparent bg-white'
      }`}
    >
      <Pressable onPress={onToggleDone} hitSlop={6} className="p-0.5">
        {done ? <CheckSquare color="#0F766E" size={22} /> : <Square color="#94A3B8" size={22} />}
      </Pressable>
      <Pressable
        onPress={onToggleDone}
        onLongPress={onToggleSelect}
        delayLongPress={280}
        className="min-w-0 flex-1"
      >
        <Text
          className={`font-medium ${done ? 'text-ink-400 line-through' : 'text-ink-900'}`}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text className="text-[11px] text-ink-400">
          {item.repeat_mode === 'inherit'
            ? `Como cat. (${formatRepeatLabel(item.effective_repeat_months)})`
            : formatRepeatLabel(item.effective_repeat_months)}
        </Text>
      </Pressable>
      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={8} className="rounded-full bg-ink-50 p-1.5">
          <Pencil color="#64748B" size={14} />
        </Pressable>
      ) : null}
      {dragHandle ?? (
        <Pressable onLongPress={onDragHandleLongPress} delayLongPress={120} hitSlop={8} className="p-1">
          <GripVertical color={isActive ? '#0F766E' : '#94A3B8'} size={18} />
        </Pressable>
      )}
    </View>
  );
}
