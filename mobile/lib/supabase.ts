import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// iOS SecureStore has a ~2KB per-key limit. Supabase session tokens exceed this,
// so we chunk large values across multiple keys and reassemble on read.
const CHUNK_SIZE = 1800

async function setLargeItem(key: string, value: string): Promise<void> {
  const chunks: string[] = []
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE))
  }
  await SecureStore.setItemAsync(`${key}_n`, String(chunks.length))
  await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_${i}`, chunk)))
}

async function getLargeItem(key: string): Promise<string | null> {
  const countStr = await SecureStore.getItemAsync(`${key}_n`)
  if (!countStr) return null
  const count = parseInt(countStr, 10)
  const chunks = await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}_${i}`))
  )
  if (chunks.some(c => c === null)) return null
  return chunks.join('')
}

async function removeLargeItem(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${key}_n`)
  if (!countStr) return
  const count = parseInt(countStr, 10)
  await SecureStore.deleteItemAsync(`${key}_n`)
  await Promise.all(
    Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}_${i}`))
  )
}

const SecureStoreAdapter = {
  getItem: (key: string) => getLargeItem(key),
  setItem: (key: string, value: string) => setLargeItem(key, value),
  removeItem: (key: string) => removeLargeItem(key),
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
