import { X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Section = {
  title: string;
  points: string[];
};

const SECTIONS: Section[] = [
  {
    title: 'Cómo funciona un grupo',
    points: [
      'Cada persona está en un solo grupo a la vez.',
      'Todo lo que se carga (movimientos, listas, etiquetas y objetivos) pertenece al grupo, no a la persona. Todos los miembros lo ven y lo pueden editar.',
      'Quien crea el grupo figura como «Creador». Es el único que puede quitar miembros.',
    ],
  },
  {
    title: 'Invitar a alguien',
    points: [
      'Escribí su email en «Invitar por email». Le llega un link para unirse.',
      'Tiene que entrar con la misma cuenta de Google de ese email.',
      'La invitación vence a los 14 días. Si vence, mandale una nueva.',
    ],
  },
  {
    title: 'Aceptar una invitación',
    points: [
      'Al aceptar, entrás al grupo nuevo como miembro y salís del que tenías.',
      'Lo que habías cargado en tu grupo anterior no se borra: queda guardado en ese grupo.',
      'Si sos el creador de tu grupo actual y hay otras personas, antes de unirte tenés que elegir quién queda a cargo.',
      'Si estabas solo en tu grupo, queda guardado y lo recuperás si algún día volvés a quedarte sin grupo.',
    ],
  },
  {
    title: 'Pasar el grupo',
    points: [
      'Solo el creador puede hacerlo, con «Pasar el grupo», abajo de todo.',
      'Elegís a otro miembro y esa persona queda como creadora. Vos seguís en el grupo como miembro.',
      'No hace falta salir ni aceptar otra invitación para pasar el rol.',
    ],
  },
  {
    title: 'Salir del grupo',
    points: [
      'Cualquier miembro puede salir cuando quiera, sin pedirle permiso al creador. Se hace desde «Salir del grupo», abajo de todo.',
      'Dejás de ver el grupo en el momento. Lo que cargaste queda guardado en el grupo.',
      'Si sos el creador, primero elegís a quién pasarle el grupo y después salís.',
      'Si estás solo en el grupo, no hace falta salir y el botón no aparece.',
      'Al salir, la app te devuelve tu grupo personal anterior si tenías uno, o te crea uno nuevo.',
    ],
  },
  {
    title: 'Quitar a un miembro',
    points: [
      'Solo el creador puede hacerlo, con el botón rojo al lado de cada persona.',
      'La persona deja de ver el grupo, pero sus movimientos quedan guardados y se siguen viendo.',
      'Las invitaciones pendientes que tenía para este grupo se cancelan.',
    ],
  },
  {
    title: 'Volver a un grupo',
    points: [
      'Si alguien salió o lo quitaron, se lo puede volver a invitar.',
      'Al volver recupera todo lo del grupo, porque nunca se borró nada.',
      'Vuelve como miembro: si antes era el creador, ese rol ya lo tiene otra persona.',
    ],
  },
];

export function FamilyInfoModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />
        <View className="max-h-[85%] rounded-t-3xl bg-white">
          <View className="flex-row items-center justify-between border-b border-ink-100 px-5 pb-3 pt-5">
            <Text className="text-xl font-bold text-ink-900">Cómo funcionan los grupos</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full bg-ink-100"
            >
              <X color="#334155" size={18} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="px-5 pb-10 pt-4" showsVerticalScrollIndicator={false}>
            {SECTIONS.map((section, index) => (
              <View key={section.title} className={index > 0 ? 'mt-5' : ''}>
                <Text className="font-semibold text-brand-800">{section.title}</Text>
                {section.points.map((point) => (
                  <View key={point} className="mt-2 flex-row gap-2">
                    <Text className="text-sm text-brand-600">•</Text>
                    <Text className="flex-1 text-sm leading-5 text-ink-700">{point}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
