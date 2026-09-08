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
   Nota: usamos la API HTTP de Brevo (`/v3/smtp/email`); SMTP raw no encaja bien en Edge Functions.
6. Programar `monthly-summary` (cron) el día 1 de cada mes

## Scripts

- `npm start` — Expo
- `npm run android` / `npm run ios` / `npm run web`
