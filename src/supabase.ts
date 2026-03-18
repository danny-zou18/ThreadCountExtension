import { createClient, type SupportedStorage } from "@supabase/supabase-js"

const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
const SUPABASE_ANON_KEY = "YOUR_PUBLISHABLE_OR_ANON_KEY"

const chromeStorageAdapter: SupportedStorage = {
  getItem: async (key: string) => {
    const result = await chrome.storage.local.get([key])
    return result[key] ?? null
  },
  setItem: async (key: string, value: string) => {
    await chrome.storage.local.set({ [key]: value })
  },
  removeItem: async (key: string) => {
    await chrome.storage.local.remove([key])
  },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: chromeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})