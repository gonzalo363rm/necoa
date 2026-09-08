import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  children?: ReactNode;
};

export function SurfaceCard({ title, subtitle, onPress, right, children }: Props) {
  const content = (
    <View className="rounded-3xl border border-ink-100 bg-white p-4 shadow-sm shadow-ink-900/5">
      <View className="mb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-base font-bold text-ink-900">{title}</Text>
          {subtitle ? <Text className="mt-1 text-sm text-ink-500">{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} className="active:opacity-90">
      {content}
    </Pressable>
  );
}
