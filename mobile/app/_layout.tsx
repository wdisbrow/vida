import { useEffect, useRef } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const initialized = useRef(false)

  useEffect(() => {
    // On cold start: read persisted session from SecureStore and route immediately.
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialized.current = true
      const inAuthGroup = segments[0] === '(auth)'
      if (!session && !inAuthGroup) {
        router.replace('/(auth)/login')
      } else if (session && inAuthGroup) {
        router.replace('/(tabs)')
      }
    })

    // Handle login / logout events during the session.
    // Skip INITIAL_SESSION — already handled by getSession() above.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (!initialized.current) return

      const inAuthGroup = segments[0] === '(auth)'
      if (!session && !inAuthGroup) {
        router.replace('/(auth)/login')
      } else if (session && inAuthGroup) {
        router.replace('/(tabs)')
      }
    })

    return () => subscription.unsubscribe()
  }, [segments])

  return <Slot />
}
