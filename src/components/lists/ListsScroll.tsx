import type { ReactNode } from 'react';
import type { RefreshControlProps } from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';

type Props = {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

export function ListsScroll({ children, refreshControl }: Props) {
  return (
    <NestableScrollContainer
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 144, paddingTop: 16 }}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </NestableScrollContainer>
  );
}
