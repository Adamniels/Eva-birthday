'use client'

import { useEffect, useRef } from 'react'

interface FloatingItem {
  text: string
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  alphaSpeed: number
}

interface Props {
  answers: string[]
}

const COLORS = [
  '#F0D080', // gold-light
  '#C9A84C', // gold
  '#D8D9DD', // silver-light
  '#A8A9AD', // silver
  '#FDFAF3', // cream
  '#E8C85A', // gold-mid
]

export default function FloatingAnswers({ answers }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || answers.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Skapa svävande objekt för varje svar
    const items: FloatingItem[] = answers.map(text => {
      const size = 14 + Math.random() * 22 // 14px – 36px
      const speed = 0.3 + Math.random() * 0.5
      const angle = Math.random() * Math.PI * 2
      return {
        text,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 0.5 + Math.random() * 0.5,
        alphaSpeed: (Math.random() - 0.5) * 0.004,
      }
    })

    let animId: number

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      items.forEach(item => {
        // Uppdatera position
        item.x += item.vx
        item.y += item.vy

        // Studs mot kanter
        if (item.x < 0 || item.x > canvas.width) item.vx *= -1
        if (item.y < 0 || item.y > canvas.height) item.vy *= -1
        item.x = Math.max(0, Math.min(canvas.width, item.x))
        item.y = Math.max(0, Math.min(canvas.height, item.y))

        // Pulserande alpha
        item.alpha += item.alphaSpeed
        if (item.alpha > 1) { item.alpha = 1; item.alphaSpeed *= -1 }
        if (item.alpha < 0.3) { item.alpha = 0.3; item.alphaSpeed *= -1 }

        // Rita text med mjuk skugga
        ctx.save()
        ctx.font = `${Math.round(item.size)}px Georgia, serif`
        ctx.globalAlpha = item.alpha
        ctx.shadowColor = item.color
        ctx.shadowBlur = 8
        ctx.fillStyle = item.color
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Begränsa textbredd
        const maxWidth = Math.min(300, canvas.width * 0.4)
        const words = item.text.split(' ')
        const lines: string[] = []
        let currentLine = ''

        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine)
            currentLine = word
          } else {
            currentLine = testLine
          }
        })
        if (currentLine) lines.push(currentLine)

        const lineHeight = item.size * 1.3
        const totalHeight = lines.length * lineHeight
        lines.forEach((line, i) => {
          ctx.fillText(line, item.x, item.y - totalHeight / 2 + i * lineHeight + lineHeight / 2)
        })

        ctx.restore()
      })

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [answers])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-10 pointer-events-none"
    />
  )
}
