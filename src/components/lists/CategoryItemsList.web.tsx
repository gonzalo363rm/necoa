import { GripVertical } from 'lucide-react-native';
import { createElement, useRef, useState } from 'react';

import { ListItemRow } from '@/src/components/lists/ListItemRow';
import type { ListItemWithEntry } from '@/src/types/domain';

type Props = {
  items: ListItemWithEntry[];
  selectedEntryIds: Set<string>;
  onToggleDone: (item: ListItemWithEntry) => void;
  onToggleSelect: (entryId: string) => void;
  onEdit: (item: ListItemWithEntry) => void;
  onReorder: (ordered: ListItemWithEntry[]) => void;
};

type DragEventLike = {
  preventDefault: () => void;
  stopPropagation: () => void;
  dataTransfer: {
    setData: (type: string, value: string) => void;
    getData: (type: string) => string;
    effectAllowed: string;
    dropEffect: string;
  };
};

/**
 * HTML5 DnD con divs reales (createElement).
 * Pressable/View de RN Web no reenvían `draggable` de forma fiable.
 */
export function CategoryItemsList({
  items,
  selectedEntryIds,
  onToggleDone,
  onToggleSelect,
  onEdit,
  onReorder,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);

  function moveItem(fromId: string, toId: string) {
    if (fromId === toId) return;
    const from = items.findIndex((i) => i.id === fromId);
    const to = items.findIndex((i) => i.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [removed] = next.splice(from, 1);
    if (!removed) return;
    next.splice(to, 0, removed);
    onReorder(next);
  }

  return createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column' } },
    items.map((item) => {
      const isOver = overId === item.id && draggingId != null && draggingId !== item.id;
      return createElement(
        'div',
        {
          key: item.id,
          onDragOver: (e: DragEventLike) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            // Sin onDragLeave: evita titileo al cruzar hijos del row.
            setOverId((curr) => (curr === item.id ? curr : item.id));
          },
          onDrop: (e: DragEventLike) => {
            e.preventDefault();
            e.stopPropagation();
            const fromId = e.dataTransfer.getData('text/plain') || draggingRef.current;
            if (fromId) moveItem(fromId, item.id);
            draggingRef.current = null;
            setDraggingId(null);
            setOverId(null);
          },
          style: {
            position: 'relative',
            opacity: draggingId === item.id ? 0.45 : 1,
          },
        },
        // Línea fija de altura para no mover el layout; solo cambia el color.
        createElement('div', {
          style: {
            height: 2,
            marginLeft: 16,
            marginRight: 16,
            borderRadius: 1,
            backgroundColor: isOver ? '#0F766E' : 'transparent',
            pointerEvents: 'none',
          },
        }),
        createElement(ListItemRow, {
          item,
          isActive: draggingId === item.id,
          // Durante el drag no tocamos bordes de selección (evita titileo).
          selected: Boolean(item.entry && selectedEntryIds.has(item.entry.id)) && !draggingId,
          onToggleDone: () => onToggleDone(item),
          onToggleSelect: () => item.entry && onToggleSelect(item.entry.id),
          onEdit: () => onEdit(item),
          dragHandle: createElement(
            'div',
            {
              draggable: true,
              title: 'Arrastrar para reordenar',
              onDragStart: (e: DragEventLike) => {
                e.stopPropagation();
                draggingRef.current = item.id;
                setDraggingId(item.id);
                e.dataTransfer.setData('text/plain', item.id);
                e.dataTransfer.effectAllowed = 'move';
              },
              onDragEnd: () => {
                draggingRef.current = null;
                setDraggingId(null);
                setOverId(null);
              },
              style: {
                cursor: draggingId === item.id ? 'grabbing' : 'grab',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                touchAction: 'none',
                userSelect: 'none',
              },
            },
            createElement(GripVertical, {
              color: draggingId === item.id ? '#0F766E' : '#94A3B8',
              size: 18,
            }),
          ),
        }),
      );
    }),
  );
}
