import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { registerConfirmOpener, type ConfirmRequest } from '@/src/lib/confirm';

type Pending = ConfirmRequest & {
  resolve: (value: boolean) => void;
};

type Props = {
  children: ReactNode;
};

export function ConfirmProvider({ children }: Props) {
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  useEffect(() => {
    registerConfirmOpener((request) => {
      return new Promise<boolean>((resolve) => {
        // Si ya había una confirmación abierta, la cancelamos
        pendingRef.current?.resolve(false);
        const next: Pending = { ...request, resolve };
        pendingRef.current = next;
        setPending(next);
      });
    });
    return () => {
      registerConfirmOpener(null);
      pendingRef.current?.resolve(false);
      pendingRef.current = null;
    };
  }, []);

  function finish(value: boolean) {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(value);
  }

  const destructive = pending?.destructive !== false;

  return (
    <>
      {children}
      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={() => finish(false)}
      >
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-black/40" onPress={() => finish(false)} />
          <View
            className="rounded-t-3xl bg-white px-5 pt-6"
            style={{ paddingBottom: Math.max(insets.bottom, 24) }}
          >
            <Text className="text-center text-xl font-bold text-ink-900">{pending?.title}</Text>
            {pending?.message ? (
              <Text className="mt-2 text-center text-sm leading-5 text-ink-500">{pending.message}</Text>
            ) : null}

            <Pressable
              onPress={() => finish(true)}
              className={`mt-6 items-center rounded-2xl py-4 active:opacity-90 ${
                destructive ? 'bg-danger' : 'bg-brand-700'
              }`}
            >
              <Text className="text-base font-bold text-white">
                {pending?.confirmLabel ?? 'Confirmar'}
              </Text>
            </Pressable>
            <Pressable onPress={() => finish(false)} className="mt-2 items-center py-3">
              <Text className="font-medium text-ink-500">{pending?.cancelLabel ?? 'Cancelar'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
