'use client'

import { useRouter } from 'next/navigation'

export default function BackButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.push('/')}
      className="fixed top-4 left-4 z-30 flex items-center gap-1.5 text-[var(--silver)] text-sm opacity-60 hover:opacity-100 transition-opacity"
    >
      ← Hem
    </button>
  )
}
