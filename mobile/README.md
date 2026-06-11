# DocChat Mobile (Expo / React Native)

A native mobile client for DocChat that reuses the existing backend API. It does
**not** modify the web app — it only consumes the same `/api/v1` endpoints.

## Scope

- Sign in with email/username + password, with a **show/hide password** toggle and submit-on-enter (`POST /user/login`)
- Browse your chats / dashboard (`GET /chat/list`)
- **Create a chat** by ingesting a documentation URL, with a Vector / Vectorless mode toggle (`POST /chat/create`)
- **Delete a chat** via long-press (`DELETE /chat/:id`)
- Open a chat, read messages, and send a message (`GET /message/all/:chatId`, `POST /message/send`)
- **Pick the model** when more than one is available, and **view the source chunks** behind each answer (`GET /message/sources/:messageId`)
- View lifetime usage summary (`GET /usage/lifetime-tokens`)
- Access token stored securely with `expo-secure-store`

## Stack

- Expo + React Native + TypeScript
- React Navigation (native stack)
- `expo-secure-store` for token storage

## Project structure

```
mobile/
  App.tsx                 # AuthProvider + NavigationContainer
  src/
    config.ts             # API base URL (EXPO_PUBLIC_API_BASE_URL)
    types.ts              # shared types (mapped from web src/lib/api.ts)
    theme.ts              # shared dark-theme colors
    navigation.tsx        # auth-gated root stack
    api/
      client.ts           # fetch wrapper: Bearer token + envelope unwrap
      endpoints.ts        # typed endpoint functions
    auth/
      storage.ts          # SecureStore session persistence
      AuthContext.tsx     # auth state + session restore
    screens/
      SignInScreen.tsx
      ChatsScreen.tsx     # dashboard / chat list
      ChatScreen.tsx      # messages + composer
      UsageScreen.tsx     # usage summary
```

## Running locally

1. Start the DocChat backend (defaults to `http://localhost:3000/api/v1`).
2. Point the app at your backend. On a physical device use your machine's LAN IP:

   ```bash
   # mobile/.env (or export in your shell)
   EXPO_PUBLIC_API_BASE_URL=http://<your-lan-ip>:3000/api/v1
   ```

3. Install and start:

   ```bash
   cd mobile
   npm install
   npm run android   # or: npm run ios   (iOS needs macOS)
   ```

> Sending messages requires at least one API key configured on your DocChat
> account (added via the web app); the app uses your first key's provider/model.

## Notes

- React Native's `fetch` does not expose a streaming body, so the chat screen
  awaits the full assistant reply instead of rendering it token-by-token like
  the web client. Incremental streaming can be added later via a library such
  as `react-native-sse` / `expo/fetch`.
