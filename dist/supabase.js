import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sAaiC9PUSzW-BSf_x3VsPw_M2YRBOLa";
const chromeStorageAdapter = {
    getItem: async (key) => {
        const result = await chrome.storage.local.get([key]);
        return result[key] ?? null;
    },
    setItem: async (key, value) => {
        await chrome.storage.local.set({ [key]: value });
    },
    removeItem: async (key) => {
        await chrome.storage.local.remove([key]);
    },
};
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: chromeStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
