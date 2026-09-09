# Briefly Frontend

Briefly is a cross-platform Expo/React Native news client for the Briefly event and canonical-article backend.

## Stack

- Expo SDK 57
- Expo Router
- React Native / React Native Web
- Supabase authentication
- RevenueCat native subscriptions
- Stripe-backed web subscription flow via the Briefly backend

## Setup

```bash
npm install
cp .env.example .env
```

Configure the public environment values in `.env`, especially `EXPO_PUBLIC_BRIEFLY_API_URL` and the Supabase settings.

## Development

```bash
npm start
npm run ios
npm run android
npm run web
```

## Quality checks

```bash
npm run lint
```

## App structure

- `src/app/` — Expo Router screens and routes
- `src/components/` — Briefly presentation components
- `src/api/` — backend API clients
- `src/context/` — auth, language, saved articles, and theme state
- `src/models/` — shared frontend models
- `src/subscriptions/` — native and web subscription integration
- `src/storage/` — local persistence

Canonical event/article identity remains English-first; localization is a presentation concern. Feed cards load canonical text immediately and request shared server-side card translations only when the user asks for them.
