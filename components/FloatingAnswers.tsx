'use client'

import { useEffect, useRef } from 'react'

interface SlotState {
  text: string
  x: number
  y: number
  vx: number
  vy: number
  hasBounced: boolean
  entryEdge: number
  size: number
  color: string
  alpha: number
  spawnedNext: boolean
  active: boolean
}

const COLORS = ['#F0D080', '#C9A84C', '#D8D9DD', '#A8A9AD', '#FDFAF3', '#E8C85A']
const TEXT_W = 280
const TEXT_H = 80
const ACTIVE_SLOTS = 3

function createSlot(text: string, W: number, H: number): SlotState {
  const size = 14 + Math.random() * 16
  const speed = 0.25 + Math.random() * 0.15
  const drift = (Math.random() - 0.5) * 0.7
  const edge = Math.floor(Math.random() * 4)

  let x = 0, y = 0, vx = 0, vy = 0
  switch (edge) {
    case 0: x = -TEXT_W; y = Math.random() * (H - TEXT_H); vx = speed; vy = drift * speed; break
    case 1: x = W + 10;  y = Math.random() * (H - TEXT_H); vx = -speed; vy = drift * speed; break
    case 2: x = Math.random() * (W - TEXT_W); y = -TEXT_H; vx = drift * speed; vy = speed; break
    default: x = Math.random() * (W - TEXT_W); y = H + 10; vx = drift * speed; vy = -speed; break
  }

  return {
    text, x, y, vx, vy, size,
    hasBounced: false, entryEdge: edge,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: 0.7 + Math.random() * 0.3,
    spawnedNext: false,
    active: true,
  }
}

export default function FloatingAnswers({ answers }: { answers: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || answers.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const W = () => canvas.width
    const H = () => canvas.height

    const slots: (SlotState | null)[] = Array(ACTIVE_SLOTS).fill(null)
    let queueIdx = 0
    const timeouts: ReturnType<typeof setTimeout>[] = []

    const spawnSlot = (i: number) => {
      if (answers.length === 0) return
      const text = answers[queueIdx % answers.length]
      queueIdx++
      slots[i] = createSlot(text, W(), H())
    }

    for (let i = 0; i < ACTIVE_SLOTS; i++) {
      const t = setTimeout(() => spawnSlot(i), i * 1400)
      timeouts.push(t)
    }

    let animId: number

    const drawWrappedText = (slot: SlotState) => {
      ctx.save()
      ctx.font = `${Math.round(slot.size)}px Georgia, serif`
      ctx.globalAlpha = slot.alpha
      ctx.shadowColor = slot.color
      ctx.shadowBlur = 6
      ctx.fillStyle = slot.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const maxW = Math.min(TEXT_W, W() * 0.4)
      const words = slot.text.split(' ')
      const lines: string[] = []
      let cur = ''
      for (const word of words) {
        const test = cur ? `${cur} ${word}` : word
        if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word }
        else cur = test
      }
      if (cur) lines.push(cur)

      const lineH = slot.size * 1.35
      const total = lines.length * lineH
      lines.forEach((line, j) => {
        ctx.fillText(line, slot.x + TEXT_W / 2, slot.y - total / 2 + j * lineH + lineH / 2)
      })
      ctx.restore()
    }

    const draw = () => {
      ctx.clearRect(0, 0, W(), H())

      slots.forEach((s, i) => {
        if (!s) return

        s.x += s.vx
        s.y += s.vy

        if (!s.hasBounced) {
          if      (s.x <= 0 && s.entryEdge !== 0)          { s.vx =  Math.abs(s.vx); s.hasBounced = true }
          else if (s.x >= W() - TEXT_W && s.entryEdge !== 1) { s.vx = -Math.abs(s.vx); s.hasBounced = true }
          else if (s.y <= 0 && s.entryEdge !== 2)          { s.vy =  Math.abs(s.vy); s.hasBounced = true }
          else if (s.y >= H() - TEXT_H && s.entryEdge !== 3) { s.vy = -Math.abs(s.vy); s.hasBounced = true }
        }

        drawWrappedText(s)

        const almostGone =
          (s.vx < 0 && s.x < -TEXT_W * 0.8) ||
          (s.vx > 0 && s.x > W() - TEXT_W * 0.2) ||
          (s.vy < 0 && s.y < -TEXT_H * 0.8) ||
          (s.vy > 0 && s.y > H() - TEXT_H * 0.2)

        if (almostGone && !s.spawnedNext) {
          s.spawnedNext = true
          const t = setTimeout(() => spawnSlot(i), 200 + Math.random() * 600)
          timeouts.push(t)
        }
      })

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      timeouts.forEach(clearTimeout)
      window.removeEventListener('resize', resize)
    }
  }, [answers])

  return <canvas ref={canvasRef} className="fixed inset-0 z-20 pointer-events-none" />
}
