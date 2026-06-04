'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, GameState, Answer } from '@/lib/supabase'
import { scoreAnswer, revealedQuestionIds, memoryQuestions } from '@/lib/questions'
import StarField from '@/components/StarField'
import Confetti from '@/components/Confetti'
import RevealContent, { LeaderboardEntry } from '@/components/RevealContent'
import BackButton from '@/components/BackButton'
import FloatingAnswers from '@/components/FloatingAnswers'
import FloatingPhotos from '@/components/FloatingPhotos'

export default function RevealPage() {
  const router = useRouter()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [myAnswers, setMyAnswers] = useState<Record<number, Answer>>({})
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [memoryAnswerTexts, setMemoryAnswerTexts] = useState<string[]>([])
  const [memoryPhotos, setMemoryPhotos] = useState<{ url: string; playerName: string }[]>([])

  const loadLeaderboard = useCallback(async (revealIndex: number, revealStep: string) => {
    const { data: players } = await supabase.from('players').select('id, name')
    const { data: answers } = await supabase.from('answers').select('player_id, question_id, answer')
    if (!players || !answers) return
    const revealed = revealedQuestionIds(revealIndex, revealStep)
    const totals: Record<string, { name: string; points: number }> = {}
    players.forEach(p => { totals[p.id] = { name: p.name, points: 0 } })
    answers.forEach(a => {
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

  const loadMyAnswers = useCallback(async (id: string) => {
    const { data } = await supabase.from('answers').select('*').eq('player_id', id)
    if (data) {
      const map: Record<number, Answer> = {}
      data.forEach(a => { map[a.question_id] = a })
      setMyAnswers(map)
    }
  }, [])

  const loadMemoryAnswers = useCallback(async () => {
    const memoryIds = memoryQuestions.map(q => q.id)
    const { data } = await supabase
      .from('answers')
      .select('answer')
      .in('question_id', memoryIds)
    if (data) {
      setMemoryAnswerTexts(data.map(a => a.answer).filter(a => a.trim().length > 0))
    }
    const staticPhotos = Array.from({ length: 16 }, (_, i) =>
      ({ url: `/images-for-floating/eva-${i + 1}.jpg`, playerName: '' })
    )

    const { data: photos } = await supabase
      .from('photos')
      .select('public_url, player_name')
    const guestPhotos = photos
      ? photos.map(p => ({ url: p.public_url, playerName: p.player_name }))
      : []

    setMemoryPhotos([...staticPhotos, ...guestPhotos])
  }, [])

  useEffect(() => {
    const id = localStorage.getItem('playerId')
    if (!id) { router.push('/'); return }

    const init = async () => {
      const name = localStorage.getItem('playerName')
      setPlayerName(name || '')
      const { data } = await supabase.from('game_state').select('*').eq('id', 1).single()
      if (data) {
        setGameState(data as GameState)
        if (data.phase === 'open') router.push('/submitted')
        if (data.phase === 'memory') await loadMemoryAnswers()
      }
      await loadMyAnswers(id)
      if (data) await loadLeaderboard(data.reveal_index, data.reveal_step)
    }
    init()

    const channel = supabase
      .channel('reveal_player')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state' }, payload => {
        const gs = payload.new as GameState
        setGameState(gs)
        loadMyAnswers(id)
        loadLeaderboard(gs.reveal_index, gs.reveal_step)
        if (gs.phase === 'finished') setShowConfetti(true)
        if (gs.phase === 'memory') loadMemoryAnswers()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'answers' }, async () => {
        const { data: gs } = await supabase.from('game_state').select('reveal_index, reveal_step').eq('id', 1).single()
        loadMyAnswers(id)
        if (gs) loadLeaderboard(gs.reveal_index, gs.reveal_step)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router, loadMyAnswers, loadLeaderboard, loadMemoryAnswers])

  if (!gameState) {
    return (
      <main className="relative min-h-screen flex items-center justify-center">
        <StarField />
        <p className="text-[var(--silver)] z-10">Laddar...</p>
      </main>
    )
  }

  if (gameState.phase === 'locked') {
    return (
      <main className="relative min-h-screen flex items-center justify-center px-4">
        <StarField />
        <BackButton />
        <div className="relative z-10 text-center card p-10 max-w-sm w-full">
          <div className="text-4xl mb-4">🎯</div>
          <h2 className="gold-text text-2xl font-bold mb-2">Avslöjningen börjar snart</h2>
          <p className="text-[var(--silver)] text-sm">Väntar på att värden startar...</p>
          <div className="flex justify-center gap-1 mt-4">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2 h-2 rounded-full gold-gradient animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (gameState.phase === 'memory') {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center px-4">
        <StarField />
        <BackButton />
        <FloatingAnswers answers={memoryAnswerTexts} />
        <FloatingPhotos photos={memoryPhotos} />
        <div className="relative z-20 text-center pointer-events-none">
          <p className="text-[var(--silver)] text-sm uppercase tracking-widest mb-2">Minnen</p>
          <h2 className="gold-text text-3xl font-bold">Eva ♡</h2>
        </div>
      </main>
    )
  }

  if (gameState.phase === 'finished') {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <StarField />
        <BackButton />
        {showConfetti && <Confetti />}
        <div className="relative z-20 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="gold-text text-3xl font-bold">Slutresultat</h2>
          </div>
          <div className="card p-6 space-y-3">
            {leaderboard.map(entry => (
              <div
                key={entry.name}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  entry.name === playerName
                    ? 'bg-[var(--gold-dark)]/30 border border-[var(--gold)]/50'
                    : 'bg-white/5'
                }`}
              >
                <span className="w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0">
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                </span>
                <span className="flex-1 text-[var(--cream)]">{entry.name}</span>
                <span className="gold-text font-bold">{entry.points} p</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen flex flex-col px-4 py-8">
      <StarField />
      <BackButton />
      <div className="relative z-10">
        <RevealContent
          gameState={gameState}
          myAnswers={myAnswers}
          leaderboard={leaderboard}
          playerName={playerName}
        />
      </div>
    </main>
  )
}
