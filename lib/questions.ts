import questionsData from '../questions.json'
import memoryQuestionsData from '../memory-questions.json'

export type QuestionType = 'multiple_choice' | 'open_text'

export interface MemoryQuestion {
  id: number
  question: string
}

export const memoryQuestions: MemoryQuestion[] = memoryQuestionsData as MemoryQuestion[]

export interface Question {
  id: number
  type: QuestionType
  question: string
  image: string | null
  options?: string[]
  correct: number | string
  points: number
}

export const questions: Question[] = questionsData as Question[]

export function getQuestion(id: number): Question | undefined {
  return questions.find(q => q.id === id)
}

export function checkAnswer(question: Question, answer: string): boolean {
  if (question.type === 'multiple_choice') {
    // Konvertera båda till tal — undviker bugg om correct råkar vara sträng "2" vs tal 2
    return Number(answer) === Number(question.correct)
  }
  return answer.trim().toLowerCase() === String(question.correct).trim().toLowerCase()
}

/**
 * Beräknar om ett svar är rätt och hur många poäng det ger.
 * Kallas alltid mot questions.json — ingenting läses från databasen.
 */
export function scoreAnswer(questionId: number, answerValue: string): { isCorrect: boolean; points: number } {
  const q = getQuestion(questionId)
  if (!q) return { isCorrect: false, points: 0 }
  const isCorrect = checkAnswer(q, answerValue)
  return { isCorrect, points: isCorrect ? q.points : 0 }
}

/**
 * Returnerar de fråge-ID:n som faktiskt har avslöjats hittills.
 * Under 'question'-steget har svaret för aktuell fråga INTE visats ännu.
 * Under 'answer'/'leaderboard' har det visats.
 */
export function revealedQuestionIds(revealIndex: number, revealStep: string): Set<number> {
  const maxIndex = revealStep === 'question' ? revealIndex - 1 : revealIndex
  return new Set(questions.slice(0, maxIndex + 1).map(q => q.id))
}
