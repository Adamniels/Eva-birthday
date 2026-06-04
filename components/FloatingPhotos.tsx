'use client'

import { useEffect, useRef } from 'react'

interface Photo {
  url: string
  playerName: string
}

interface PhotoState {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotSpeed: number
}

export default function FloatingPhotos({ photos }: { photos: Photo[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<HTMLDivElement[]>([])
  const stateRef = useRef<PhotoState[]>([])
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (photos.length === 0) return
    const container = containerRef.current
    if (!container) return

    const W = window.innerWidth
    const H = window.innerHeight
    const CARD_W = 160
    const CARD_H = 200

    stateRef.current = photos.map(() => {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.25 + Math.random() * 0.35
      return {
        x: CARD_W / 2 + Math.random() * (W - CARD_W * 2),
        y: CARD_H / 2 + Math.random() * (H - CARD_H * 2),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: (Math.random() - 0.5) * 16,
        rotSpeed: (Math.random() - 0.5) * 0.04,
      }
    })

    const animate = () => {
      const W2 = window.innerWidth
      const H2 = window.innerHeight

      stateRef.current.forEach((s, i) => {
        s.x += s.vx
        s.y += s.vy
        s.rotation += s.rotSpeed

        if (s.x < 0) { s.x = 0; s.vx = Math.abs(s.vx) }
        if (s.x > W2 - CARD_W) { s.x = W2 - CARD_W; s.vx = -Math.abs(s.vx) }
        if (s.y < 0) { s.y = 0; s.vy = Math.abs(s.vy) }
        if (s.y > H2 - CARD_H) { s.y = H2 - CARD_H; s.vy = -Math.abs(s.vy) }

        const el = itemRefs.current[i]
        if (el) {
          el.style.transform = `translate(${s.x}px, ${s.y}px) rotate(${s.rotation}deg)`
        }
      })

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [photos])

  if (photos.length === 0) return null

  return (
    <div ref={containerRef} className="fixed inset-0 z-10 pointer-events-none overflow-hidden">
      {photos.map((photo, i) => (
        <div
          key={photo.url}
          ref={el => { if (el) itemRefs.current[i] = el }}
          className="absolute top-0 left-0 will-change-transform"
          style={{ width: 160 }}
        >
          {/* Polaroid-ram */}
          <div className="bg-white p-2 pb-6 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={`Foto av ${photo.playerName}`}
              className="w-full object-cover"
              style={{ height: 140 }}
              crossOrigin="anonymous"
            />
            {photo.playerName && (
              <p className="text-center text-gray-600 text-xs mt-2 font-medium truncate px-1">
                {photo.playerName}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
