'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, GameState, Answer } from '@/lib/supabase'
import { questions, scoreAnswer, revealedQuestionIds, memoryQuestions } from '@/lib/questions'
import StarField from '@/components/StarField'
import Confetti from '@/components/Confetti'
import RevealContent, { LeaderboardEntry } from '@/components/RevealContent'
import FloatingAnswers from '@/components/FloatingAnswers'
import FloatingPhotos from '@/components/FloatingPhotos'

interface PlayerSummary {
  id: string
  name: string
  answeredCount: number
  points: number
}

export default function HostDashboard() {
  const router = useRouter()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [players, setPlayers] = useState<PlayerSummary[]>([])
  const [myAnswers] = useState<Record<number, Answer>>({})
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [view, setView] = useState<'lobby' | 'reveal'>('lobby')
  const [memoryAnswerTexts, setMemoryAnswerTexts] = useState<string[]>([])
  const [memoryPhotos, setMemoryPhotos] = useState<{ url: string; playerName: string }[]>([])

  const checkAuth = useCallback(() => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('hostAuth')) {
      router.push('/host')
    }
  }, [router])

  const loadLeaderboard = useCallback(async (revealIndex: number, revealStep: string) => {
    const { data: ps } = await supabase.from('players').select('id, name')
    const { data: ans } = await supabase.from('answers').select('player_id, question_id, answer')
    if (!ps || !ans) return
    const revealed = revealedQuestionIds(revealIndex, revealStep)
    const totals: Record<string, { name: string; points: number }> = {}
    ps.forEach(p => { totals[p.id] = { name: p.name, points: 0 } })
    ans.forEach(a => {
      if (totals[a.player_id] && revealed.has(a.question_id)) {
        const { points } = scoreAnswer(a.question_id, a.answer)
        totals[a.player_id].points += points
      }
    })
    const sorted = Object.values(totals)
      .sort((a, b) => b.points - a.points)
      .map((entry, i) => ({ ...entry, rank: i + 1 }))
    setLeaderboard(sorted)
  }, [])

  const loadMemoryAnswers = useCallback(async () => {
    const memoryIds = memoryQuestions.map(q => q.id)
    const { data } = await supabase.from('answers').select('answer').in('question_id', memoryIds)
    if (data) setMemoryAnswerTexts(data.map(a => a.answer).filter(a => a.trim().length > 0))

    const staticPhotos = Array.from({ length: 16 }, (_, i) =>
      ({ url: `/images-for-floating/eva-${i + 1}.jpg`, playerName: '' })
    )

    const { data: photos } = await supabase.from('photos').select('public_url, player_name')
    const guestPhotos = photos
      ? photos.map(p => ({ url: p.public_url, playerName: p.player_name }))
      : []

    setMemoryPhotos([...staticPhotos, ...guestPhotos])
  }, [])

  const loadData = useCallback(async () => {
    const { data: gs } = await supabase.from('game_state').select('*').eq('id', 1).single()
    if (gs) {
      setGameState(gs as GameState)
      if (gs.phase === 'reveal' || gs.phase === 'finished' || gs.phase === 'memory') setView('reveal')
      if (gs.phase === 'memory') loadMemoryAnswers()
    }

    const { data: ps } = await supabase.from('players').select('id, name')
    const { data: ans } = await supabase.from('answers').select('player_id, question_id, answer')

    if (ps && ans) {
      const summaries: PlayerSummary[] = ps.map(p => ({
        id: p.id,
        name: p.name,
        answeredCount: ans.filter(a => a.player_id === p.id).length,
        points: ans
          .filter(a => a.player_id === p.id)
          .reduce((s, a) => s + scoreAnswer(a.question_id, a.answer).points, 0),
      }))
      summaries.sort((a, b) => b.answeredCount - a.answeredCount)
      setPlayers(summaries)
    }

    if (gs) await loadLeaderboard(gs.reveal_index, gs.reveal_step)
  }, [loadLeaderboard, loadMemoryAnswers])

  useEffect(() => {
    checkAuth()
    const init = async () => { await loadData() }
    init()

    const channel = supabase
      .channel('host_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers' }, loadData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state' }, payload => {
        const gs = payload.new as GameState
        setGameState(gs)
        if (gs.phase === 'reveal' || gs.phase === 'finished') setView('reveal')
        if (gs.phase === 'finished') setShowConfetti(true)
        loadData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [checkAuth, loadData])

  const updateGameState = async (updates: Partial<GameState>) => {
    setLoading(true)
    await supabase.from('game_state').update(updates).eq('id', 1)
    await loadData()
    setLoading(false)
  }

  // Navigationssteg: fråga → svar → leaderboard → nästa fråga → finished → memory
  const handleNext = async () => {
    if (!gameState) return
    if (gameState.phase === 'finished') {
      await loadMemoryAnswers()
      await updateGameState({ phase: 'memory' })
      return
    }
    if (gameState.reveal_step === 'question') {
      await updateGameState({ reveal_step: 'answer' })
    } else if (gameState.reveal_step === 'answer') {
      await updateGameState({ reveal_step: 'leaderboard' })
    } else {
      const nextIndex = gameState.reveal_index + 1
      if (nextIndex >= questions.length) {
        await updateGameState({ phase: 'finished', reveal_index: nextIndex, reveal_step: 'question' })
        setShowConfetti(true)
      } else {
        await updateGameState({ reveal_index: nextIndex, reveal_step: 'question' })
      }
    }
  }

  const handleBack = async () => {
    if (!gameState) return
    if (gameState.phase === 'memory') {
      await updateGameState({ phase: 'finished' })
      return
    }
    if (gameState.reveal_step === 'answer') {
      await updateGameState({ reveal_step: 'question' })
    } else if (gameState.reveal_step === 'leaderboard') {
      await updateGameState({ reveal_step: 'answer' })
    }
  }

  const nextLabel = () => {
    if (!gameState) return ''
    if (gameState.phase === 'finished') return 'Visa minnen →'
    if (gameState.phase === 'memory') return ''
    if (gameState.reveal_step === 'question') return 'Visa svaret →'
    if (gameState.reveal_step === 'answer') return 'Visa ställningen →'
    const isLast = gameState.reveal_index >= questions.length - 1
    return isLast ? 'Avsluta quiz ✓' : 'Nästa fråga →'
  }

  const canGoBack = (gameState?.phase === 'reveal' &&
    (gameState.reveal_step === 'answer' || gameState.reveal_step === 'leaderboard')) ||
    gameState?.phase === 'memory'

  const canGoNext = gameState?.phase !== 'memory'

  if (!gameState) {
    return (
      <main className="relative min-h-screen flex items-center justify-center">
        <StarField />
        <p className="text-[var(--silver)] z-10">Laddar...</p>
      </main>
    )
  }

  // Lobby-vy (fas: open / locked)
  if (view === 'lobby') {
    const fullyAnswered = players.filter(p => p.answeredCount === questions.length).length

    return (
      <main className="relative min-h-screen flex flex-col px-4 py-8">
        <StarField />
        <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col gap-6">

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--silver)] text-xs uppercase tracking-widest">Värdpanel</p>
              <h1 className="gold-text text-2xl font-bold">Eva Quiz</h1>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              gameState.phase === 'open'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            }`}>
              {gameState.phase === 'open' ? 'Öppen' : 'Stängd'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Deltagare', value: players.length },
              { label: 'Färdiga', value: fullyAnswered },
              { label: 'Frågor', value: questions.length },
            ].map(stat => (
              <div key={stat.label} className="card p-4 text-center">
                <p className="gold-text text-2xl font-bold">{stat.value}</p>
                <p className="text-[var(--silver)] text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {gameState.phase === 'open' && (
            <div className="card p-5">
              <h3 className="text-[var(--gold-light)] font-semibold mb-2">Redo att stänga quizzen?</h3>
              <p className="text-[var(--silver)] text-sm mb-4">
                Stäng svarfristen så att ingen kan ändra svar mer.
              </p>
              <button className="btn-gold w-full" onClick={() => updateGameState({ phase: 'locked' })} disabled={loading}>
                Stäng för nya svar
              </button>
            </div>
          )}

          {gameState.phase === 'locked' && (
            <div className="card p-5">
              <h3 className="text-[var(--gold-light)] font-semibold mb-2">Svarfristen är stängd</h3>
              <p className="text-[var(--silver)] text-sm mb-4">
                Starta avslöjningen när ni är redo.
              </p>
              <button
                className="btn-gold w-full"
                onClick={() => updateGameState({ phase: 'reveal', reveal_index: 0, reveal_step: 'question' })}
                disabled={loading}
              >
                Starta avslöjningen →
              </button>
            </div>
          )}

          <div className="card p-5">
            <h3 className="text-[var(--gold-light)] font-semibold mb-3">Deltagare ({players.length})</h3>
            <div className="space-y-2">
              {players.map(p => (
                <div key={p.id} className="flex items-center gap-3 py-1">
                  <span className="flex-1 text-[var(--cream)] text-sm">{p.name}</span>
                  <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full gold-gradient rounded-full"
                      style={{ width: `${(p.answeredCount / questions.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-[var(--silver)] text-xs w-10 text-right">
                    {p.answeredCount}/{questions.length}
                  </span>
                </div>
              ))}
              {players.length === 0 && (
                <p className="text-[var(--silver)] text-sm text-center py-4">Inga deltagare ännu.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Slutresultat med nav-knappar
  if (gameState.phase === 'finished') {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center px-4 pb-28">
        <StarField />
        {showConfetti && <Confetti />}
        <div className="relative z-20 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="gold-text text-3xl font-bold">Slutresultat</h2>
          </div>
          <div className="card p-6 space-y-3">
            {leaderboard.map(entry => (
              <div key={entry.name} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <span className="w-8 h-8 flex items-center justify-center text-sm font-bold">
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                </span>
                <span className="flex-1 text-[var(--cream)]">{entry.name}</span>
                <span className="gold-text font-bold">{entry.points} p</span>
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-3"
          style={{ background: 'linear-gradient(to top, rgba(26,20,8,0.98) 70%, transparent)' }}>
          <div className="max-w-lg mx-auto flex gap-3">
            <button className="btn-gold w-full" onClick={handleNext} disabled={loading}>
              {loading ? 'Väntar...' : 'Visa minnen →'}
            </button>
          </div>
        </div>
      </main>
    )
  }

  // Minnesfas
  if (gameState.phase === 'memory') {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center px-4 pb-28">
        <StarField />
        <FloatingAnswers answers={memoryAnswerTexts} />
        <FloatingPhotos photos={memoryPhotos} />
        <div className="relative z-20 text-center pointer-events-none">
          <p className="text-[var(--silver)] text-sm uppercase tracking-widest mb-2">Minnen</p>
          <h2 className="gold-text text-3xl font-bold">Eva ♡</h2>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-3"
          style={{ background: 'linear-gradient(to top, rgba(26,20,8,0.95) 70%, transparent)' }}>
          <div className="max-w-lg mx-auto flex gap-3">
            <button className="btn-outline flex-1" onClick={handleBack} disabled={loading}>
              ← Tillbaka
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen flex flex-col px-4 py-8 pb-28">
      <StarField />
      {showConfetti && <Confetti />}

      <div className="relative z-10">
        <RevealContent
          gameState={gameState}
          myAnswers={myAnswers}
          leaderboard={leaderboard}
          playerName=""
        />
      </div>

      {/* Nav-knappar fästa längst ner */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-6 pt-3"
        style={{ background: 'linear-gradient(to top, rgba(26,20,8,0.98) 70%, transparent)' }}>
        <div className="max-w-lg mx-auto flex gap-3">
          <button
            className="btn-outline flex-1"
            onClick={handleBack}
            disabled={!canGoBack || loading}
          >
            ← Tillbaka
          </button>
          {canGoNext && (
            <button
              className="btn-gold flex-1"
              onClick={handleNext}
              disabled={loading}
            >
              {loading ? 'Väntar...' : nextLabel()}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
