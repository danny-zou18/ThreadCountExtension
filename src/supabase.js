import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lfyujnnwpfotoelcxdzd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sAaiC9PUSzW-BSf_x3VsPw_M2YRBOLa";

function log(step, details) {
  if (details === undefined) {
    console.log(`[ThreadCount supabase] ${step}`);
    return;
  }

  console.log(`[ThreadCount supabase] ${step}`, details);
}

function createStorageAdapter() {
  const extensionStorage = globalThis.chrome?.storage?.local;

  if (extensionStorage) {
    log("storageAdapter:chrome-storage");
    return {
      async getItem(key) {
        log("storage:getItem:start", { key });
        const result = await extensionStorage.get([key]);
        log("storage:getItem:done", { key, hasValue: result[key] != null });
        return result[key] ?? null;
      },
      async setItem(key, value) {
        log("storage:setItem:start", { key, length: value?.length ?? 0 });
        await extensionStorage.set({ [key]: value });
        log("storage:setItem:done", { key });
      },
      async removeItem(key) {
        log("storage:removeItem:start", { key });
        await extensionStorage.remove([key]);
        log("storage:removeItem:done", { key });
      },
    };
  }

  log("storageAdapter:localStorage-fallback");
  return {
    async getItem(key) {
      log("fallback:getItem", { key });
      return globalThis.localStorage?.getItem(key) ?? null;
    },
    async setItem(key, value) {
      log("fallback:setItem", { key, length: value?.length ?? 0 });
      globalThis.localStorage?.setItem(key, value);
    },
    async removeItem(key) {
      log("fallback:removeItem", { key });
      globalThis.localStorage?.removeItem(key);
    },
  };
}

export function createSupabaseBrowserClient() {
  log("createClient", { url: SUPABASE_URL });
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: createStorageAdapter(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
