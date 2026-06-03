'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, GameState } from '@/lib/supabase'
import StarField from '@/components/StarField'
import Confetti from '@/components/Confetti'
import BackButton from '@/components/BackButton'

export default function SubmittedPage() {
  const router = useRouter()
  const [playerName, setPlayerName] = useState('')
  const [phase, setPhase] = useState<GameState['phase']>('open')

  useEffect(() => {
    const id = localStorage.getItem('playerId')
    if (!id) { router.push('/'); return }

    const init = async () => {
      const name = localStorage.getItem('playerName')
      setPlayerName(name || '')
      const { data } = await supabase
        .from('game_state')
        .select('phase, reveal_index')
        .eq('id', 1)
        .single()
      if (data) setPhase(data.phase)
    }
    init()

    const channel = supabase
      .channel('game_state_submitted')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_state' },
        payload => {
          const newPhase = payload.new.phase as GameState['phase']
          setPhase(newPhase)
          if (newPhase === 'reveal' || newPhase === 'finished') {
            router.push('/reveal')
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4">
      <StarField />
      <BackButton />
      <Confetti />
      <div className="relative z-20 w-full max-w-md text-center">
        <div className="card p-10">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="gold-text text-3xl font-bold mb-3">Perfekt!</h2>
          <p className="text-[var(--silver-light)] text-lg mb-2">
            Tack {playerName}!
          </p>
          <p className="text-[var(--silver)] leading-relaxed">
            Dina svar är sparade. Du kan fortfarande gå tillbaka och ändra dem fram till festen.
          </p>

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-40" />

          {phase === 'open' && (
            <div className="flex items-center justify-center gap-2 text-[var(--silver)]">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
              <span className="text-sm">Väntar på att festen börjar...</span>
            </div>
          )}

          {phase === 'locked' && (
            <div className="flex items-center justify-center gap-2 text-[var(--gold-light)]">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--gold-light)] animate-pulse" />
              <span className="text-sm">Svarfristen är stängd — avslöjningen börjar snart!</span>
            </div>
          )}

          <div className="mt-6 flex gap-3 justify-center">
            <button
              className="btn-outline text-sm"
              onClick={() => router.push('/quiz')}
            >
              Ändra svar
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
