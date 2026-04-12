import { useEffect, useState } from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import { Redirect } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export default function Index() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
      })
      .catch((err) => {
        console.error('getSession error:', err)
        setError(String(err))
        setSession(null) // treat errors as logged-out
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
      </View>
    )
  }

  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#6366f1' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    )
  }

  if (session) return <Redirect href="/(tabs)/" />
  return <Redirect href="/(auth)/login" />
}
