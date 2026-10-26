import type { ReactNode } from 'react';
import { ScrollView, type RefreshControlProps } from 'react-native';

type Props = {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

export function ListsScroll({ children, refreshControl }: Props) {
  return (
    <ScrollView
      contentContainerClassName="px-5 pb-36 pt-4"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}
