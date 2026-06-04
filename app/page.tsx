'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase, Phase } from '@/lib/supabase'
import StarField from '@/components/StarField'

export default function Home() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<Phase | null>(null)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from('game_state')
        .select('phase')
        .eq('id', 1)
        .single()
      if (data) setPhase(data.phase as Phase)
    }
    init()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')

    try {
      if (phase === 'open') {
        const { data: existing } = await supabase
          .from('players')
          .select('id')
          .ilike('name', trimmed)
          .maybeSingle()

        let playerId: string

        if (existing) {
          playerId = existing.id
        } else {
          const { data: newPlayer, error: insertError } = await supabase
            .from('players')
            .insert({ name: trimmed })
            .select('id')
            .single()
          if (insertError || !newPlayer) throw new Error()
          playerId = newPlayer.id
        }

        localStorage.setItem('playerId', playerId)
        localStorage.setItem('playerName', trimmed)
        router.push('/quiz')
      } else {
        const { data: existing } = await supabase
          .from('players')
          .select('id')
          .ilike('name', trimmed)
          .maybeSingle()

        if (!existing) {
          setError('Hittade inget svar med det namnet. Kontrollera stavningen.')
          setLoading(false)
          return
        }

        localStorage.setItem('playerId', existing.id)
        localStorage.setItem('playerName', trimmed)
        router.push('/reveal')
      }
    } catch {
      setError('Något gick fel. Försök igen.')
      setLoading(false)
    }
  }

  const isRevealPhase = phase === 'locked' || phase === 'reveal' || phase === 'finished' || phase === 'memory'

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <StarField />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-8">

        {/* Rubrik */}
        <div className="text-center">
          <p className="text-[var(--silver)] text-sm tracking-widest uppercase mb-3">
            Firande av
          </p>
          <h1 className="gold-text text-6xl font-bold mb-2">Eva</h1>
          <p className="text-[var(--gold-light)] text-2xl font-light">fyller 60 år</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--gold)]" />
            <span className="text-[var(--gold)] text-xl">✦</span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--gold)]" />
          </div>
        </div>

        {/* Polaroid-foto */}
        {!isRevealPhase && (
          <div
            className="relative"
            style={{ transform: 'rotate(-2deg)' }}
          >
            <div className="bg-white p-3 pb-10 shadow-2xl"
              style={{ boxShadow: '0 8px 32px rgba(201,168,76,0.25), 0 2px 8px rgba(0,0,0,0.5)' }}>
              <div className="relative w-64 h-72 overflow-hidden">
                <Image
                  src="/images/eva.jpg"
                  alt="Eva"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <p className="text-center text-gray-700 text-xs font-medium mt-3 italic leading-snug px-1">
                60 ÅR! Det kan man väl ändå inte tro?<br />
                Det här var ju inte så länge sen.....ELLER? 😉
              </p>
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full gold-gradient opacity-60" />
          </div>
        )}

        {/* Intro-text */}
        {!isRevealPhase && (
          <div className="card p-6 text-center w-full">
            <p className="text-[var(--silver-light)] leading-relaxed text-sm">
              Vad vet vi egentligen om{' '}
              <span className="gold-text font-bold">THE ONE AND ONLY EVA SÖRLIN</span>?
              Att hon är en helt fantastisk och unik människa, ja det vet vi ju redan.
              Men nu ska era kunskaper om henne få testas.
            </p>
            <p className="text-[var(--gold-light)] mt-3 text-sm font-medium leading-relaxed">
              Vinnaren får inte bara äran, utan också en väldigt graciös,
              gigantisk POKAL!!! 🏆 <span className="opacity-60 text-xs">(host host)</span>
            </p>
          </div>
        )}

        {/* Formulär */}
        <div className="card p-8 w-full">
          {isRevealPhase ? (
            <>
              <p className="text-[var(--gold-light)] font-semibold mb-2 text-center">
                {phase === 'finished' || phase === 'memory' ? 'Quizzen är avslutad!' : 'Dags för avslöjning!'}
              </p>
              <p className="text-[var(--silver-light)] mb-6 leading-relaxed text-center">
                Ange ditt namn för att se hur det gick.
              </p>
            </>
          ) : (
            <p className="text-[var(--silver)] text-sm text-center mb-5">
              Skriv ditt namn för att börja
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              className="input-field"
              placeholder="Ditt namn..."
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40}
              autoFocus
            />

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit"
              className="btn-gold w-full"
              disabled={!name.trim() || loading || phase === null}
            >
              {loading
                ? 'Väntar...'
                : isRevealPhase
                ? 'Gå till avslöjningen →'
                : 'Starta quizzen →'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
