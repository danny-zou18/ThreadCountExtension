# ThreadCountExtension

This folder now contains a plain JavaScript Chrome extension that signs users into ThreadCount with Supabase.

## What it does

- Email/password sign in
- Password reset email trigger
- Persistent auth session using extension storage
- Right-click any browser image and save it to the user wardrobe

## Setup

1. Run `npm install`
2. Run `npm run build`
3. Open Chrome or Edge extensions
4. Enable developer mode
5. Load the `dist` folder as an unpacked extension

## Supabase configuration

The extension reads its Supabase project values from [src/supabase.js](src/supabase.js).

If you change projects, update:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Notes

- This version does not use TypeScript.
- Sessions are persisted in `chrome.storage.local`.
- The extension only allows sign-in for existing accounts.
- The browser action adds a `Save to Wardrobe` image context-menu entry.
