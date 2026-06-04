'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { questions, Question, memoryQuestions, MemoryQuestion } from '@/lib/questions'
import StarField from '@/components/StarField'
import BackButton from '@/components/BackButton'

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const MAX_PHOTOS = 5
const totalCount = questions.length + memoryQuestions.length

interface UploadedPhoto {
  url: string
  path: string
  preview: string
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise(resolve => {
    const img = new window.Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1000
      let { width, height } = img
      if (width > MAX) { height = Math.round(height * MAX / width); width = MAX }
      if (height > MAX) { width = Math.round(width * MAX / height); height = MAX }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.75)
      URL.revokeObjectURL(objectUrl)
    }
    img.src = objectUrl
  })
}

export default function QuizPage() {
  const router = useRouter()
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string>('')
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [currentQ, setCurrentQ] = useState(0)

  // Bilduppladdning
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isMemoryPhase = currentQ >= questions.length
  const memoryIndex = currentQ - questions.length
  const currentQuizQ: Question | undefined = !isMemoryPhase ? questions[currentQ] : undefined
  const currentMemoryQ: MemoryQuestion | undefined = isMemoryPhase ? memoryQuestions[memoryIndex] : undefined
  const isLastStep = currentQ === totalCount - 1

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

      // Ladda redan uppladdade foton
      const { data: existingPhotos } = await supabase
        .from('photos')
        .select('public_url, storage_path')
        .eq('player_id', id)
      if (existingPhotos) {
        setUploadedPhotos(existingPhotos.map(p => ({
          url: p.public_url,
          path: p.storage_path,
          preview: p.public_url,
        })))
      }
    }
    init()
  }, [router])

  const handleAnswer = (questionId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playerId || !e.target.files) return
    const files = Array.from(e.target.files)
    const remaining = MAX_PHOTOS - uploadedPhotos.length
    const toUpload = files.slice(0, remaining)
    if (toUpload.length === 0) return

    setUploading(true)
    setUploadError('')

    for (const file of toUpload) {
      try {
        const compressed = await compressImage(file)
        const path = `${playerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

        const { error: uploadErr } = await supabase.storage
          .from('quiz-photos')
          .upload(path, compressed, { contentType: 'image/jpeg' })

        if (uploadErr) throw uploadErr

        const { data: { publicUrl } } = supabase.storage
          .from('quiz-photos')
          .getPublicUrl(path)

        await supabase.from('photos').insert({
          player_id: playerId,
          player_name: playerName,
          public_url: publicUrl,
          storage_path: path,
        })

        const preview = URL.createObjectURL(compressed)
        setUploadedPhotos(prev => [...prev, { url: publicUrl, path, preview }])
      } catch {
        setUploadError('Kunde inte ladda upp bilden. Försök igen.')
      }
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDeletePhoto = async (photo: UploadedPhoto) => {
    await supabase.storage.from('quiz-photos').remove([photo.path])
    await supabase.from('photos').delete().eq('storage_path', photo.path)
    setUploadedPhotos(prev => prev.filter(p => p.path !== photo.path))
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
        .from('game_state').select('phase').eq('id', 1).single()

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

        {/* Navigationspunkter */}
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

          <div className="w-full flex items-center gap-2 my-1">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[var(--silver)] text-xs opacity-60">Dela med dig</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

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
          <div className={`card overflow-hidden ${currentQuizQ.image ? 'relative' : 'p-6'}`}>
            {/* Bakgrundsbild */}
            {currentQuizQ.image && (
              <>
                <Image
                  src={currentQuizQ.image}
                  alt="Frågans bild"
                  fill
                  className="object-cover"
                  priority
                />
                {/* Mörkt lager så texten syns */}
                <div className="absolute inset-0 bg-black/65" />
              </>
            )}

            {/* Innehåll */}
            <div className={`relative z-10 ${currentQuizQ.image ? 'p-6' : ''}`}>
              <p className="text-[var(--silver)] text-xs uppercase tracking-widest mb-2">
                Fråga {currentQ + 1} av {questions.length}
              </p>

              <p className="text-[var(--cream)] text-lg font-semibold leading-snug mb-5">
                {currentQuizQ.question}
              </p>

              {currentQuizQ.type === 'multiple_choice' && currentQuizQ.options && (
                <div className="space-y-3">
                  {currentQuizQ.options.map((opt, i) => (
                    <button
                      key={i}
                      className={`option-btn flex items-center gap-3 ${
                        currentQuizQ.image ? 'bg-black/40 border-white/20 hover:bg-white/20' : ''
                      } ${answers[currentQuizQ.id] === String(i) ? 'selected' : ''}`}
                      onClick={() => handleAnswer(currentQuizQ.id, String(i))}
                    >
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        answers[currentQuizQ.id] === String(i)
                          ? 'gold-gradient text-[var(--dark)]'
                          : 'bg-white/20 text-[var(--silver)]'
                      }`}>
                        {OPTION_LABELS[i]}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Minnesfråga */}
        {currentMemoryQ && (
          <div className="card p-6">
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

        {/* Bilduppladdning — visas på sista steget */}
        {isLastStep && (
          <div className="card p-6">
            <p className="text-[var(--silver)] text-xs uppercase tracking-widest mb-2">
              Bilder ♡
            </p>
            <p className="text-[var(--cream)] font-semibold mb-1">
              Har du ett fint foto på Eva?
            </p>
            <p className="text-[var(--silver)] text-sm mb-5">
              Ladda upp upp till {MAX_PHOTOS} bilder — de svävar runt på festen!
            </p>

            {/* Förhandsvisning av uppladdade foton */}
            {uploadedPhotos.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4">
                {uploadedPhotos.map(photo => (
                  <div key={photo.path} className="relative">
                    <div className="bg-white p-1.5 shadow-md" style={{ width: 72 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.preview}
                        alt="Uppladdad bild"
                        className="w-full object-cover"
                        style={{ height: 72 }}
                      />
                    </div>
                    <button
                      onClick={() => handleDeletePhoto(photo)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadedPhotos.length < MAX_PHOTOS && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                <button
                  className="btn-outline w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading
                    ? 'Laddar upp...'
                    : uploadedPhotos.length === 0
                    ? '+ Välj bilder'
                    : `+ Lägg till fler (${uploadedPhotos.length}/${MAX_PHOTOS})`}
                </button>
              </>
            )}

            {uploadError && <p className="text-red-400 text-sm mt-2">{uploadError}</p>}

            {uploadedPhotos.length === MAX_PHOTOS && (
              <p className="text-[var(--gold-light)] text-sm mt-2 text-center">
                Maximalt antal bilder uppladdade ✓
              </p>
            )}
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
          {currentQ < totalCount - 1 ? (
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

        {!allAnswered && currentQ === totalCount - 1 && (
          <p className="text-center text-[var(--silver)] text-sm">
            Du har fortfarande {totalCount - answeredCount} frågor kvar
          </p>
        )}

        {error && <p className="text-center text-red-400 text-sm">{error}</p>}
      </div>
    </main>
  )
}
