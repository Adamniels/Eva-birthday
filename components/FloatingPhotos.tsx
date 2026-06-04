'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface Photo {
  url: string
  playerName: string
}

interface SlotState {
  x: number
  y: number
  vx: number
  vy: number
  hasBounced: boolean
  entryEdge: number
  rotation: number
  spawnedNext: boolean
}

const CARD_W = 160
const CARD_H = 200
const ACTIVE_SLOTS = 4

function createSlotState(edge: number, W: number, H: number): SlotState {
  const speed = 0.25 + Math.random() * 0.15
  const drift = (Math.random() - 0.5) * 0.7

  let x = 0, y = 0, vx = 0, vy = 0
  switch (edge) {
    case 0: x = -CARD_W; y = Math.random() * (H - CARD_H); vx = speed; vy = drift * speed; break
    case 1: x = W + 10;  y = Math.random() * (H - CARD_H); vx = -speed; vy = drift * speed; break
    case 2: x = Math.random() * (W - CARD_W); y = -CARD_H; vx = drift * speed; vy = speed; break
    default: x = Math.random() * (W - CARD_W); y = H + 10; vx = drift * speed; vy = -speed; break
  }

  return { x, y, vx, vy, hasBounced: false, entryEdge: edge, rotation: (Math.random() - 0.5) * 16, spawnedNext: false }
}

export default function FloatingPhotos({ photos }: { photos: Photo[] }) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>(Array(ACTIVE_SLOTS).fill(null))
  const slotStates = useRef<(SlotState | null)[]>(Array(ACTIVE_SLOTS).fill(null))
  const photosRef = useRef(photos)
  const queueIdx = useRef(0)
  const animRef = useRef<number>(0)
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([])
  const [slotContent, setSlotContent] = useState<(Photo | null)[]>(Array(ACTIVE_SLOTS).fill(null))
  const initialized = useRef(false)

  useEffect(() => { photosRef.current = photos }, [photos])

  const spawnSlot = useCallback((slotIndex: number) => {
    const all = photosRef.current
    if (all.length === 0) return
    const W = window.innerWidth
    const H = window.innerHeight
    const edge = Math.floor(Math.random() * 4)
    slotStates.current[slotIndex] = createSlotState(edge, W, H)
    const photo = all[queueIdx.current % all.length]
    queueIdx.current++
    setSlotContent(prev => { const next = [...prev]; next[slotIndex] = photo; return next })
  }, [])

  useEffect(() => {
    if (photos.length === 0 || initialized.current) return
    initialized.current = true
    for (let i = 0; i < ACTIVE_SLOTS; i++) {
      const t = setTimeout(() => spawnSlot(i), i * 1200)
      timeouts.current.push(t)
    }
  }, [photos.length, spawnSlot])

  useEffect(() => {
    if (photos.length === 0) return

    const animate = () => {
      const W = window.innerWidth
      const H = window.innerHeight

      slotStates.current.forEach((s, i) => {
        if (!s) return
        const el = itemRefs.current[i]
        if (!el) return

        s.x += s.vx
        s.y += s.vy

        if (!s.hasBounced) {
          if      (s.x <= 0 && s.entryEdge !== 0)          { s.vx =  Math.abs(s.vx); s.hasBounced = true }
          else if (s.x >= W - CARD_W && s.entryEdge !== 1) { s.vx = -Math.abs(s.vx); s.hasBounced = true }
          else if (s.y <= 0 && s.entryEdge !== 2)          { s.vy =  Math.abs(s.vy); s.hasBounced = true }
          else if (s.y >= H - CARD_H && s.entryEdge !== 3) { s.vy = -Math.abs(s.vy); s.hasBounced = true }
        }

        el.style.transform = `translate(${s.x}px, ${s.y}px) rotate(${s.rotation}deg)`

        const almostGone =
          (s.vx < 0 && s.x < -CARD_W * 0.8) ||
          (s.vx > 0 && s.x > W - CARD_W * 0.2) ||
          (s.vy < 0 && s.y < -CARD_H * 0.8) ||
          (s.vy > 0 && s.y > H - CARD_H * 0.2)

        if (almostGone && !s.spawnedNext) {
          s.spawnedNext = true
          const t = setTimeout(() => spawnSlot(i), 200 + Math.random() * 600)
          timeouts.current.push(t)
        }
      })

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(animRef.current)
      timeouts.current.forEach(clearTimeout)
      timeouts.current = []
    }
  }, [photos.length, spawnSlot])

  if (photos.length === 0) return null

  return (
    <div className="fixed inset-0 z-10 pointer-events-none overflow-hidden">
      {Array.from({ length: ACTIVE_SLOTS }, (_, i) => (
        <div
          key={i}
          ref={el => { itemRefs.current[i] = el }}
          className="absolute top-0 left-0 will-change-transform"
          style={{ width: CARD_W, opacity: slotContent[i] ? 1 : 0 }}
        >
          {slotContent[i] && (
            <div className="bg-white p-2 pb-6 shadow-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slotContent[i]!.url}
                alt=""
                className="w-full object-cover"
                style={{ height: 140 }}
                crossOrigin="anonymous"
              />
              {slotContent[i]!.playerName && (
                <p className="text-center text-gray-600 text-xs mt-2 font-medium truncate px-1">
                  {slotContent[i]!.playerName}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
