import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Phase = 'open' | 'locked' | 'reveal' | 'finished' | 'memory'
export type RevealStep = 'question' | 'answer' | 'leaderboard'

export interface GameState {
  id: number
  phase: Phase
  reveal_index: number
  reveal_step: RevealStep
}

export interface Player {
  id: string
  name: string
  created_at: string
}

export interface Answer {
  id: string
  player_id: string
  question_id: number
  answer: string
  is_correct: boolean | null
  points: number
  updated_at: string
}
