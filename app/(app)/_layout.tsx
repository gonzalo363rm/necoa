import { ChartPie, Home, Plus, Receipt, Users } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function FabButton() {
  return (
    <Pressable
      onPress={() => router.push('/add-transaction')}
      className="-top-5 h-16 w-16 items-center justify-center rounded-full bg-brand-700 shadow-lg shadow-brand-900/30 active:opacity-90"
    >
      <Plus color="#fff" size={28} />
    </Pressable>
  );
}

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const tabBarHeight = 58 + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0F766E',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          height: tabBarHeight,
          paddingBottom: bottomPad,
          paddingTop: 8,
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Resumen',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Movimientos',
          tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="add-placeholder"
        options={{
          title: '',
          tabBarButton: () => (
            <View className="flex-1 items-center">
              <FabButton />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          title: 'Gráficos',
          tabBarIcon: ({ color, size }) => <ChartPie color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Familia',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tags"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
