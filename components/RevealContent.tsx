'use client'

import { GameState, Answer } from '@/lib/supabase'
import { questions, Question, scoreAnswer, revealedQuestionIds } from '@/lib/questions'

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export interface LeaderboardEntry {
  name: string
  points: number
  rank: number
}

interface Props {
  gameState: GameState
  myAnswers: Record<number, Answer>
  leaderboard: LeaderboardEntry[]
  playerName: string
}

export default function RevealContent({ gameState, myAnswers, leaderboard, playerName }: Props) {
  const currentQuestion: Question | undefined = questions[gameState.reveal_index]
  const myAnswer = currentQuestion ? myAnswers[currentQuestion.id] : null

  // Bara poäng för frågor som faktiskt avslöjats hittills
  const revealed = revealedQuestionIds(gameState.reveal_index, gameState.reveal_step)
  const myPoints = Object.entries(myAnswers).reduce((sum, [qId, a]) => {
    if (!revealed.has(Number(qId))) return sum
    const { points } = scoreAnswer(Number(qId), a.answer)
    return sum + points
  }, 0)

  const myEntry = leaderboard.find(e => e.name === playerName)
  const scored = myAnswer ? scoreAnswer(currentQuestion!.id, myAnswer.answer) : null

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-5">

      {/* Rubrik */}
      <div className="text-center">
        <p className="text-[var(--silver)] text-sm uppercase tracking-widest">Avslöjning</p>
        <h2 className="gold-text text-2xl font-bold">
          Fråga {gameState.reveal_index + 1} av {questions.length}
        </h2>
        {myEntry && (
          <p className="text-[var(--gold-light)] text-sm mt-1">
            Dina poäng hittills: {myPoints}
          </p>
        )}
      </div>

      {/* Framstegspunkter */}
      <div className="flex flex-wrap justify-center gap-2">
        {questions.map((q, i) => {
          const isRevealed = revealed.has(q.id) && i < gameState.reveal_index
          const prev = myAnswers[q.id]
          const prevScored = isRevealed && prev ? scoreAnswer(q.id, prev.answer) : null
          return (
            <div
              key={q.id}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                isRevealed
                  ? prevScored?.isCorrect
                    ? 'bg-green-500/80 text-white'
                    : 'bg-red-500/50 text-white'
                  : i === gameState.reveal_index
                  ? 'gold-gradient text-[var(--dark)]'
                  : 'bg-white/10 text-[var(--silver)]'
              }`}
            >
              {isRevealed
                ? prevScored?.isCorrect ? '✓' : '✗'
                : i + 1}
            </div>
          )
        })}
      </div>

      {/* Frågekort */}
      {currentQuestion && (
        <div className={`card overflow-hidden ${currentQuestion.image ? 'relative' : 'p-6'}`}>
          {currentQuestion.image && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentQuestion.image}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/65" />
            </>
          )}
          <div className={`relative z-10 ${currentQuestion.image ? 'p-6' : ''}`}>
          <p className="text-[var(--cream)] text-lg font-semibold leading-snug mb-5">
            {currentQuestion.question}
          </p>

          {/* STEG 1: Fråga — visa eget svar, rätt svar dolt */}
          {gameState.reveal_step === 'question' && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map((opt, i) => {
                const isMine = myAnswer?.answer === String(i)
                return (
                  <div
                    key={i}
                    className={`option-btn pointer-events-none flex items-center gap-3 ${isMine ? 'selected' : ''}`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isMine ? 'gold-gradient text-[var(--dark)]' : 'bg-white/10 text-[var(--silver)]'
                    }`}>
                      {OPTION_LABELS[i]}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {isMine && <span className="text-xs text-[var(--gold)] opacity-80">← ditt svar</span>}
                  </div>
                )
              })}
              <p className="text-center text-[var(--silver)] text-sm mt-2 animate-pulse">
                Rätt svar avslöjas snart...
              </p>
            </div>
          )}

          {/* STEG 2: Svar — rätt svar lyser upp + resultat */}
          {gameState.reveal_step === 'answer' && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map((opt, i) => {
                const isCorrect = i === Number(currentQuestion.correct)
                const isMine = myAnswer?.answer === String(i)
                let cls = 'option-btn pointer-events-none flex items-center gap-3'
                if (isCorrect) cls += ' correct'
                else if (isMine) cls += ' wrong'
                return (
                  <div key={i} className={cls}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCorrect ? 'bg-green-500 text-white' : 'bg-white/10 text-[var(--silver)]'
                    }`}>
                      {OPTION_LABELS[i]}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {/* Visa alltid "ditt svar" — även när svaret är rätt */}
                    {isMine && <span className="text-xs opacity-70">← ditt svar</span>}
                    {isCorrect && !isMine && <span className="text-green-400 text-xs">✓ rätt</span>}
                  </div>
                )
              })}

              {scored && (
                <div className={`mt-3 text-center p-3 rounded-lg font-semibold ${
                  scored.isCorrect
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {scored.isCorrect ? `+${scored.points} poäng! 🎉` : 'Inte denna gång 😅'}
                </div>
              )}
            </div>
          )}

          {/* STEG 3: Leaderboard */}
          {gameState.reveal_step === 'leaderboard' && (
            <div>
              <h3 className="gold-text text-lg font-bold mb-4 text-center">
                Ställning efter fråga {gameState.reveal_index + 1}
              </h3>
              <div className="space-y-2">
                {leaderboard.map(entry => (
                  <div
                    key={entry.name}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
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
                    {entry.name === playerName && (
                      <span className="text-xs text-[var(--gold)] opacity-70">← du</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  )
}
