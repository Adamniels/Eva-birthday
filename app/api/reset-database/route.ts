import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!process.env.RESET_PASSWORD || password !== process.env.RESET_PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Radera alla svar och spelare (cascade tar hand om answers via FK)
  const { error: answersError } = await supabase.from('answers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (answersError) return NextResponse.json({ ok: false, error: answersError.message }, { status: 500 })

  const { error: playersError } = await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (playersError) return NextResponse.json({ ok: false, error: playersError.message }, { status: 500 })

  // Återställ game_state
  const { error: stateError } = await supabase
    .from('game_state')
    .update({ phase: 'open', reveal_index: 0, reveal_step: 'question' })
    .eq('id', 1)
  if (stateError) return NextResponse.json({ ok: false, error: stateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
