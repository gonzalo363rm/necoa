import { useIsFocused } from 'expo-router';
import Head from 'expo-router/head';

const APP_NAME = 'Necoa';

/** Browser tab title. Tabs keep screens mounted, so only the focused one renders it. */
export function PageTitle({ title }: { title?: string }) {
  const focused = useIsFocused();
  if (!focused) return null;
  return (
    <Head>
      <title>{title ? `${title} · ${APP_NAME}` : APP_NAME}</title>
    </Head>
  );
}
