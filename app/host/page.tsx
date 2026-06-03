'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StarField from '@/components/StarField'

export default function HostLoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/host-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      sessionStorage.setItem('hostAuth', 'true')
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
          <p className="text-[var(--silver)] text-sm uppercase tracking-widest mb-2">Åtkomst för</p>
          <h1 className="gold-text text-3xl font-bold mb-6">Värd</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              className="input-field text-center"
              placeholder="Lösenord"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="btn-gold w-full" disabled={!password || loading}>
              {loading ? 'Kontrollerar...' : 'Logga in →'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
