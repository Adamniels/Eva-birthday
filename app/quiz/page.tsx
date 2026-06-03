'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { questions, Question, memoryQuestions, MemoryQuestion } from '@/lib/questions'
import StarField from '@/components/StarField'
import BackButton from '@/components/BackButton'

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

// Alla frågor: quiz-frågor + minnesfrågor
const totalCount = questions.length + memoryQuestions.length

export default function QuizPage() {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string>('')
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [currentQ, setCurrentQ] = useState(0)

  // Avgör om vi är på en quiz-fråga eller minnesfråga
  const isMemoryPhase = currentQ >= questions.length
  const memoryIndex = currentQ - questions.length
  const currentQuizQ: Question | undefined = !isMemoryPhase ? questions[currentQ] : undefined
  const currentMemoryQ: MemoryQuestion | undefined = isMemoryPhase ? memoryQuestions[memoryIndex] : undefined

  useEffect(() => {
    const init = async () => {
      const id = localStorage.getItem('playerId')
      const name = localStorage.getItem('playerName')
      if (!id) { router.push('/'); return }
      setPlayerId(id)
      setPlayerName(name || '')
      const { data } = await supabase
        .from('answers')
        .select('question_id, answer')
        .eq('player_id', id)
      if (data) {
        const map: Record<number, string> = {}
        data.forEach(a => { map[a.question_id] = a.answer })
        setAnswers(map)
      }
    }
    init()
  }, [router])

  const handleAnswer = (questionId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const allQuizAnswered = questions.every(q => answers[q.id] !== undefined && answers[q.id] !== '')
  const allMemoryAnswered = memoryQuestions.every(q => answers[q.id] !== undefined && answers[q.id] !== '')
  const allAnswered = allQuizAnswered && allMemoryAnswered
  const answeredCount = Object.keys(answers).length

  const handleSubmit = async () => {
    if (!playerId) return
    setSaving(true)
    setError('')

    try {
      const { data: state } = await supabase
        .from('game_state')
        .select('phase')
        .eq('id', 1)
        .single()

      if (state && state.phase !== 'open') {
        setError('Svarfristen är stängd — du kan inte längre ändra svar.')
        setSaving(false)
        return
      }

      const upserts = Object.entries(answers).map(([qId, answer]) => ({
        player_id: playerId,
        question_id: parseInt(qId),
        answer,
        is_correct: null,
        points: 0,
        updated_at: new Date().toISOString(),
      }))

      const { error: upsertError } = await supabase
        .from('answers')
        .upsert(upserts, { onConflict: 'player_id,question_id' })

      if (upsertError) throw upsertError

      router.push('/submitted')
    } catch {
      setError('Något gick fel. Försök igen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="relative min-h-screen flex flex-col px-4 py-8">
      <StarField />
      <BackButton />
      <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="text-center mb-2">
          <p className="text-[var(--gold-light)] text-sm">Hej, {playerName}!</p>
          <h2 className="gold-text text-2xl font-bold mt-1">Eva Quiz</h2>
          <p className="text-[var(--silver)] text-sm mt-1">
            {answeredCount} / {totalCount} besvarade
          </p>
          <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full gold-gradient rounded-full transition-all duration-500"
              style={{ width: `${(answeredCount / totalCount) * 100}%` }}
            />
          </div>
        </div>

        {/* Navigationspunkter: quiz-frågor */}
        <div className="flex flex-wrap justify-center gap-2">
          {questions.map((q2, i) => (
            <button
              key={q2.id}
              onClick={() => setCurrentQ(i)}
              className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                i === currentQ
                  ? 'gold-gradient text-[var(--dark)]'
                  : answers[q2.id]
                  ? 'bg-[var(--gold-dark)] text-[var(--gold-light)]'
                  : 'bg-white/10 text-[var(--silver)]'
              }`}
            >
              {i + 1}
            </button>
          ))}

          {/* Separator */}
          <div className="w-full flex items-center gap-2 my-1">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[var(--silver)] text-xs opacity-60">Dela med dig</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Minnesfråge-punkter */}
          {memoryQuestions.map((mq, i) => (
            <button
              key={mq.id}
              onClick={() => setCurrentQ(questions.length + i)}
              className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                questions.length + i === currentQ
                  ? 'bg-[var(--silver-light)] text-[var(--dark)]'
                  : answers[mq.id]
                  ? 'bg-[var(--silver)] text-[var(--dark)]'
                  : 'bg-white/10 text-[var(--silver)]'
              }`}
            >
              ♡
            </button>
          ))}
        </div>

        {/* Quiz-fråga */}
        {currentQuizQ && (
          <div className="card p-6">
            <p className="text-[var(--silver)] text-xs uppercase tracking-widest mb-2">
              Fråga {currentQ + 1} av {questions.length}
            </p>

            {currentQuizQ.image && (
              <div className="relative w-full h-48 rounded-lg overflow-hidden mb-4">
                <Image src={currentQuizQ.image} alt="Frågans bild" fill className="object-cover" />
              </div>
            )}

            <p className="text-[var(--cream)] text-lg font-semibold leading-snug mb-5">
              {currentQuizQ.question}
            </p>

            {currentQuizQ.type === 'multiple_choice' && currentQuizQ.options && (
              <div className="space-y-3">
                {currentQuizQ.options.map((opt, i) => (
                  <button
                    key={i}
                    className={`option-btn flex items-center gap-3 ${
                      answers[currentQuizQ.id] === String(i) ? 'selected' : ''
                    }`}
                    onClick={() => handleAnswer(currentQuizQ.id, String(i))}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      answers[currentQuizQ.id] === String(i)
                        ? 'gold-gradient text-[var(--dark)]'
                        : 'bg-white/10 text-[var(--silver)]'
                    }`}>
                      {OPTION_LABELS[i]}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Minnesfråga */}
        {currentMemoryQ && (
          <div className="card p-6 border-[var(--silver)]/30">
            <p className="text-[var(--silver)] text-xs uppercase tracking-widest mb-2">
              Dela med dig ♡
            </p>
            <p className="text-[var(--cream)] text-lg font-semibold leading-snug mb-5">
              {currentMemoryQ.question}
            </p>
            <textarea
              className="input-field resize-none"
              rows={4}
              placeholder="Skriv ditt svar här..."
              value={answers[currentMemoryQ.id] || ''}
              onChange={e => handleAnswer(currentMemoryQ.id, e.target.value)}
            />
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            className="btn-outline flex-1"
            onClick={() => setCurrentQ(i => Math.max(0, i - 1))}
            disabled={currentQ === 0}
          >
            ← Föregående
          </button>
          {currentQ < questions.length + memoryQuestions.length - 1 ? (
            <button
              className="btn-gold flex-1"
              onClick={() => setCurrentQ(i => i + 1)}
            >
              Nästa →
            </button>
          ) : (
            <button
              className="btn-gold flex-1"
              onClick={handleSubmit}
              disabled={!allAnswered || saving}
            >
              {saving ? 'Sparar...' : 'Skicka in svar ✓'}
            </button>
          )}
        </div>

        {!allAnswered && currentQ === questions.length + memoryQuestions.length - 1 && (
          <p className="text-center text-[var(--silver)] text-sm">
            Du har fortfarande {totalCount - answeredCount} frågor kvar
          </p>
        )}

        {error && <p className="text-center text-red-400 text-sm">{error}</p>}
      </div>
    </main>
  )
}
