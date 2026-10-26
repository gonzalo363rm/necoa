import { GripVertical } from 'lucide-react-native';
import { createElement, useEffect, useRef, useState } from 'react';

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

type PointerEventLike = {
  pointerId: number;
  clientY: number;
  preventDefault: () => void;
  stopPropagation: () => void;
  currentTarget: {
    setPointerCapture: (id: number) => void;
  };
};

function reorder(list: ListItemWithEntry[], fromId: string, toId: string) {
  if (fromId === toId) return null;
  const from = list.findIndex((i) => i.id === fromId);
  const to = list.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0) return null;
  const next = [...list];
  const [removed] = next.splice(from, 1);
  if (!removed) return null;
  next.splice(to, 0, removed);
  return next;
}

/**
 * Reordenamiento por pointer (mouse/touch).
 * HTML5 DnD en iOS Safari exige long-press y falla al arrastrar hacia abajo.
 */
export function CategoryItemsList({
  items,
  selectedEntryIds,
  onToggleDone,
  onToggleSelect,
  onEdit,
  onDelete,
  onReorder,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const overIdRef = useRef<string | null>(null);
  const itemsRef = useRef(items);
  const onReorderRef = useRef(onReorder);
  itemsRef.current = items;
  onReorderRef.current = onReorder;

  useEffect(() => {
    if (!draggingId) return;

    function hitTest(clientY: number): string | null {
      const drag = dragRef.current;
      if (!drag) return null;
      for (const item of itemsRef.current) {
        if (item.id === drag.id) continue;
        const el = rowRefs.current.get(item.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) return item.id;
      }
      return null;
    }

    function onMove(e: PointerEvent) {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      e.preventDefault();
      const nextOver = hitTest(e.clientY);
      overIdRef.current = nextOver;
      setOverId((curr) => (curr === nextOver ? curr : nextOver));
    }

    function finish(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const fromId = drag.id;
      const toId = overIdRef.current ?? hitTest(e.clientY);
      dragRef.current = null;
      overIdRef.current = null;
      setDraggingId(null);
      setOverId(null);

      const next = toId ? reorder(itemsRef.current, fromId, toId) : null;
      if (next) onReorderRef.current(next);
    }

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [draggingId]);

  function startDrag(itemId: string, e: PointerEventLike) {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragRef.current = { id: itemId, pointerId: e.pointerId };
    overIdRef.current = null;
    setDraggingId(itemId);
    setOverId(null);
  }

  return createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column' } },
    items.map((item) => {
      const isOver = overId === item.id && draggingId != null && draggingId !== item.id;
      const fromIndex = draggingId ? items.findIndex((i) => i.id === draggingId) : -1;
      const overIndex = isOver ? items.findIndex((i) => i.id === item.id) : -1;
      // Línea arriba si venimos de abajo; abajo si venimos de arriba (mover hacia abajo).
      const lineBelow = isOver && fromIndex >= 0 && overIndex > fromIndex;

      return createElement(
        'div',
        {
          key: item.id,
          ref: (el: HTMLElement | null) => {
            if (el) rowRefs.current.set(item.id, el);
            else rowRefs.current.delete(item.id);
          },
          style: {
            position: 'relative',
            opacity: draggingId === item.id ? 0.45 : 1,
          },
        },
        createElement('div', {
          style: {
            height: 2,
            marginLeft: 16,
            marginRight: 16,
            borderRadius: 1,
            backgroundColor: isOver && !lineBelow ? '#0F766E' : 'transparent',
            pointerEvents: 'none',
          },
        }),
        createElement(ListItemRow, {
          item,
          isActive: draggingId === item.id,
          selected: Boolean(item.entry && selectedEntryIds.has(item.entry.id)) && !draggingId,
          onToggleDone: () => onToggleDone(item),
          onToggleSelect: () => item.entry && onToggleSelect(item.entry.id),
          onEdit: () => onEdit(item),
          onDelete: () => onDelete(item),
          dragHandle: createElement(
            'div',
            {
              title: 'Arrastrar para reordenar',
              role: 'button',
              'aria-label': 'Arrastrar para reordenar',
              onPointerDown: (e: PointerEventLike) => startDrag(item.id, e),
              style: {
                cursor: draggingId === item.id ? 'grabbing' : 'grab',
                padding: 12,
                margin: -8,
                display: 'flex',
                alignItems: 'center',
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
              },
            },
            createElement(GripVertical, {
              color: draggingId === item.id ? '#0F766E' : '#94A3B8',
              size: 20,
            }),
          ),
        }),
        createElement('div', {
          style: {
            height: 2,
            marginLeft: 16,
            marginRight: 16,
            borderRadius: 1,
            backgroundColor: lineBelow ? '#0F766E' : 'transparent',
            pointerEvents: 'none',
          },
        }),
      );
    }),
  );
}
