import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lfyujnnwpfotoelcxdzd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sAaiC9PUSzW-BSf_x3VsPw_M2YRBOLa";

function createStorageAdapter() {
  const extensionStorage = globalThis.chrome?.storage?.local;

  if (extensionStorage) {
    return {
      async getItem(key) {
        const result = await extensionStorage.get([key]);
        return result[key] ?? null;
      },
      async setItem(key, value) {
        await extensionStorage.set({ [key]: value });
      },
      async removeItem(key) {
        await extensionStorage.remove([key]);
      },
    };
  }

  return {
    async getItem(key) {
      return globalThis.localStorage?.getItem(key) ?? null;
    },
    async setItem(key, value) {
      globalThis.localStorage?.setItem(key, value);
    },
    async removeItem(key) {
      globalThis.localStorage?.removeItem(key);
    },
  };
}

export function createSupabaseBrowserClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: createStorageAdapter(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
