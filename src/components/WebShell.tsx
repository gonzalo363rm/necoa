import type { ReactNode } from 'react';
import { Platform, View, type ViewProps } from 'react-native';

type Props = ViewProps & {
  children: ReactNode;
  className?: string;
};

/** Centra y limita el ancho en web; en móvil ocupa todo. */
export function WebShell({ children, className = '', style, ...rest }: Props) {
  return (
    <View
      className={`w-full flex-1 ${className}`}
      style={[
        Platform.OS === 'web'
          ? {
              maxWidth: 720,
              width: '100%',
              alignSelf: 'center',
            }
          : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
