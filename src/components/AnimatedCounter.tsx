import React, { useEffect, useState } from 'react'

interface AnimatedCounterProps {
  value: number
  duration?: number
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, duration = 600 }) => {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const end = value
    if (start === end) {
      setCount(end)
      return
    }

    const startTime = performance.now()

    const updateCount = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Easing out quad
      const easeProgress = progress * (2 - progress)
      const current = Math.floor(easeProgress * (end - start) + start)

      setCount(current)

      if (progress < 1) {
        requestAnimationFrame(updateCount)
      } else {
        setCount(end)
      }
    }

    requestAnimationFrame(updateCount)
  }, [value, duration])

  return <span>{count.toLocaleString('pt-BR')}</span>
}
