import {
  Apple,
  Bike,
  Building2,
  Bus,
  Car,
  CircleEllipsis,
  Coffee,
  Croissant,
  Droplets,
  Dumbbell,
  Flame,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Hotel,
  Landmark,
  Laptop,
  MoreHorizontal,
  ParkingCircle,
  PartyPopper,
  PawPrint,
  Pill,
  Plane,
  Repeat,
  Scissors,
  Shield,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sofa,
  Sparkles,
  Tag as TagIcon,
  Tv,
  Utensils,
  UtensilsCrossed,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { Text, View } from 'react-native';

import { tagInitials } from '@/src/lib/tags';

const ICON_MAP: Record<string, LucideIcon> = {
  utensils: Utensils,
  'utensils-crossed': UtensilsCrossed,
  'gamepad-2': Gamepad2,
  car: Car,
  zap: Zap,
  flame: Flame,
  wifi: Wifi,
  smartphone: Smartphone,
  'more-horizontal': MoreHorizontal,
  tag: TagIcon,
  home: Home,
  'building-2': Building2,
  droplets: Droplets,
  'heart-pulse': HeartPulse,
  pill: Pill,
  'graduation-cap': GraduationCap,
  bus: Bus,
  fuel: Fuel,
  shield: Shield,
  landmark: Landmark,
  'shopping-cart': ShoppingCart,
  apple: Apple,
  croissant: Croissant,
  shirt: Shirt,
  tv: Tv,
  'party-popper': PartyPopper,
  coffee: Coffee,
  bike: Bike,
  plane: Plane,
  hotel: Hotel,
  dumbbell: Dumbbell,
  'paw-print': PawPrint,
  gift: Gift,
  repeat: Repeat,
  laptop: Laptop,
  sofa: Sofa,
  sparkles: Sparkles,
  scissors: Scissors,
  'parking-circle': ParkingCircle,
  'circle-ellipsis': CircleEllipsis,
};

type Props = {
  name?: string | null;
  label?: string;
  size?: number;
  color?: string | null;
  background?: boolean;
};

export function TagGlyph({ name, label = '', size = 20, color = '#0F766E', background = false }: Props) {
  const resolved = color || '#0F766E';
  const box = Math.max(size + 16, 36);

  if (!name) {
    const initials = tagInitials(label || '?');
    const fontSize = Math.max(size * 0.85, 14);
    const content = (
      <View
        className="items-center justify-center rounded-full"
        style={{ width: box, height: box, backgroundColor: `${resolved}22` }}
      >
        <Text style={{ color: resolved, fontSize, fontWeight: '700', letterSpacing: -0.5 }}>{initials}</Text>
      </View>
    );
    return background ? content : (
      <Text style={{ color: resolved, fontSize, fontWeight: '700' }}>{initials}</Text>
    );
  }

  const Icon = ICON_MAP[name] ?? TagIcon;
  if (background) {
    return (
      <View
        className="items-center justify-center rounded-full"
        style={{ width: box, height: box, backgroundColor: `${resolved}22` }}
      >
        <Icon size={size} color={resolved} />
      </View>
    );
  }
  return <Icon size={size} color={resolved} />;
}

export const TAG_ICON_OPTIONS = Object.keys(ICON_MAP);
