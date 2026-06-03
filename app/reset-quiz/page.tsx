'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StarField from '@/components/StarField'

export default function ResetQuizPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/reset-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/host/dashboard')
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
          <p className="text-[var(--silver)] text-sm uppercase tracking-widest mb-2">Värdverktyg</p>
          <h1 className="gold-text text-2xl font-bold mb-1">Återställ quiz</h1>
          <p className="text-[var(--silver)] text-sm mb-6">
            Öppnar quizzen igen. Spelarna och deras svar bevaras.
          </p>

          <form onSubmit={handleReset} className="space-y-4">
            <input
              type="password"
              className="input-field text-center"
              placeholder="Host-lösenord"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="btn-gold w-full" disabled={!password || loading}>
              {loading ? 'Återställer...' : 'Återställ →'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
