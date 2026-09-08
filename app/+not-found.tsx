import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'No encontrado' }} />
      <View className="flex-1 items-center justify-center bg-ink-50 px-6">
        <Text className="text-xl font-bold text-ink-900">Pantalla no encontrada</Text>
        <Link href="/" className="mt-4">
          <Text className="text-brand-700">Volver al inicio</Text>
        </Link>
      </View>
    </>
  );
}
