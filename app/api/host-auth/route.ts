import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const correct = process.env.HOST_PASSWORD

  if (!correct) {
    return NextResponse.json({ ok: false, error: 'HOST_PASSWORD not configured' }, { status: 500 })
  }

  if (password === correct) {
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false }, { status: 401 })
}
