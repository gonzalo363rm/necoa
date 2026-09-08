import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const APPLE_SPLASHES = [
  {
    href: '/splash-iphone-14-pro-max.png',
    media:
      '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)',
  },
  {
    href: '/splash-iphone-14-pro.png',
    media:
      '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)',
  },
  {
    href: '/splash-iphone-12-13.png',
    media:
      '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
  },
  {
    href: '/splash-iphone-x.png',
    media:
      '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
  },
  {
    href: '/splash-iphone-xs-max.png',
    media:
      '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)',
  },
  {
    href: '/splash-iphone-xr.png',
    media:
      '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)',
  },
  {
    href: '/splash-iphone-8.png',
    media:
      '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
  },
  {
    href: '/splash-ipad-pro-12.png',
    media:
      '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)',
  },
] as const;

/** HTML raíz solo web (static export). */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#0D9488" />
        <meta name="description" content="Finanzas familiares: necesidades, comodidades y ahorro" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Necoa" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {APPLE_SPLASHES.map((splash) => (
          <link
            key={splash.href}
            rel="apple-touch-startup-image"
            href={splash.href}
            media={splash.media}
          />
        ))}

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
