# Necoa

Finanzas familiares: **NE**cesidades · **CO**modidades · **A**horro.

App móvil (Expo / React Native) + Supabase con login Google, grupo familiar, gastos/ingresos con tags, objetivos % personalizables y resumen mensual por email.

## Stack

- Expo Router + TypeScript
- NativeWind (tema claro)
- Zod + Zustand + TanStack Query
- Supabase (Auth, Postgres, RLS, Edge Functions)

## Setup

```powershell
cd C:\Users\gonza\Desktop\J\Proyectos\necoa
Copy-Item .env.example .env
# Completar EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npm start
```

Sin `.env` válido (o con los placeholders de `.env.example`) la app abre en **modo demo** con datos de ejemplo.

### Supabase

1. Crear proyecto en Supabase
2. Aplicar migración: `supabase/migrations/20260328000000_init.sql`
3. Auth → Providers → Google
4. Deploy functions:
   - `supabase/functions/invite-member`
   - `supabase/functions/monthly-summary`
5. Configurar secrets de Brevo (cuenta gratis ~300 mails/día):
   - `BREVO_API_KEY` — SMTP & API → API keys
   - `BREVO_SENDER_EMAIL` — remitente verificado en Brevo
   - `BREVO_SENDER_NAME` — opcional (default `Necoa`)
6. Programar `monthly-summary` (cron) el día 1 de cada mes

## Build (EAS) — test / preview

Proyecto EAS: [@expo257/necoa](https://expo.dev/accounts/expo257/projects/necoa)

Perfiles en `eas.json`:

| Perfil | Uso | Android | iOS |
| --- | --- | --- | --- |
| `preview` | Build de test / internal | APK instalable | Device (adhoc/internal) |
| `preview-simulator` | Test en Simulator | — | `.app` para Simulator |
| `development` | Dev client | APK | Simulator |
| `production` | Stores | AAB | IPA |

Primera vez (si hace falta login / credenciales):

```powershell
npx eas-cli login
npx eas-cli build:configure
```

Build de test (recomendado):

```powershell
# Solo Android (APK para instalar en el teléfono)
npm run build:preview:android

# Solo iOS (dispositivo físico, requiere Apple Developer)
npm run build:preview:ios

# iOS Simulator
npm run build:preview:simulator

# Ambas plataformas
npm run build:preview
```

Cuando termine, EAS te da un link para descargar el APK / instalar en iOS. También podés ver builds en el dashboard del proyecto.

Variables públicas (`EXPO_PUBLIC_*`) deben estar en EAS Secrets o en el entorno del build si no querés commitear `.env`.

## Iconos y splash

Assets en `assets/images/` (icono 1024, adaptive Android, variantes iOS light/dark/tinted, splash).

## Scripts

- `npm start` — Expo
- `npm run android` / `npm run ios` / `npm run web`
- `npm run build:preview:android` — APK de test
- `npm run build:preview:ios` — IPA de test (Apple Developer)
