export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmOpener = (request: ConfirmRequest) => Promise<boolean>;

let opener: ConfirmOpener | null = null;

/** Lo registra ConfirmProvider; no llamar desde pantallas. */
export function registerConfirmOpener(next: ConfirmOpener | null) {
  opener = next;
}

/**
 * Confirmación con modal de la app (web y nativo).
 * Requiere ConfirmProvider montado.
 */
export function confirmAsync(
  title: string,
  message: string,
  confirmLabel = 'Confirmar',
  options?: { cancelLabel?: string; destructive?: boolean },
): Promise<boolean> {
  if (!opener) {
    console.warn('confirmAsync: ConfirmProvider no está montado');
    return Promise.resolve(false);
  }
  return opener({
    title,
    message,
    confirmLabel,
    cancelLabel: options?.cancelLabel ?? 'Cancelar',
    destructive: options?.destructive ?? true,
  });
}
