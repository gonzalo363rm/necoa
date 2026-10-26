import { NestableDraggableFlatList, ScaleDecorator } from 'react-native-draggable-flatlist';

import { ListItemRow } from '@/src/components/lists/ListItemRow';
import type { ListItemWithEntry } from '@/src/types/domain';

type Props = {
  items: ListItemWithEntry[];
  selectedEntryIds: Set<string>;
  onToggleDone: (item: ListItemWithEntry) => void;
  onToggleSelect: (entryId: string) => void;
  onEdit: (item: ListItemWithEntry) => void;
  onDelete: (item: ListItemWithEntry) => void;
  onReorder: (ordered: ListItemWithEntry[]) => void;
};

export function CategoryItemsList({
  items,
  selectedEntryIds,
  onToggleDone,
  onToggleSelect,
  onEdit,
  onDelete,
  onReorder,
}: Props) {
  return (
    <NestableDraggableFlatList
      data={items}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      activationDistance={6}
      onDragEnd={({ data }) => onReorder(data)}
      renderItem={({ item, drag, isActive }) => (
        <ScaleDecorator>
          <ListItemRow
            item={item}
            isActive={isActive}
            selected={Boolean(item.entry && selectedEntryIds.has(item.entry.id))}
            onToggleDone={() => onToggleDone(item)}
            onToggleSelect={() => item.entry && onToggleSelect(item.entry.id)}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item)}
            onDragHandleLongPress={drag}
          />
        </ScaleDecorator>
      )}
    />
  );
}
