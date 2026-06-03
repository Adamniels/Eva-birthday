'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StarField from '@/components/StarField'

export default function ResetDatabasePage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const router = useRouter()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/reset-database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      setDone(true)
      setTimeout(() => router.push('/host'), 2000)
    } else {
      setError('Fel lösenord')
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4">
      <StarField />
      <div className="relative z-10 w-full max-w-sm">
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-[var(--silver)] text-sm uppercase tracking-widest mb-2">Farlig zon</p>
          <h1 className="text-red-400 text-2xl font-bold mb-1">Återställ databas</h1>
          <p className="text-[var(--silver)] text-sm mb-6">
            Detta raderar alla spelare och svar permanent. Kan inte ångras.
          </p>

          {done ? (
            <p className="text-green-400 font-semibold">Databasen är återställd. Omdirigerar...</p>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <input
                type="password"
                className="input-field text-center"
                placeholder="Reset-lösenord"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                className="w-full py-3 px-6 rounded-xl font-bold text-white bg-red-700 hover:bg-red-600 transition-colors disabled:opacity-50"
                disabled={!password || loading}
              >
                {loading ? 'Återställer...' : 'Radera allt och återställ'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
