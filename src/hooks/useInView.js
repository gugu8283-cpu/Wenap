import { useEffect, useRef, useState } from 'react'

/**
 * @param {{ threshold?: number, rootMargin?: string, once?: boolean }} [opts]
 */
export function useInView(opts = {}) {
  const { threshold = 0.15, rootMargin = '0px', once = true } = opts
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return undefined
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) io.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, rootMargin, once])

  return { ref, inView }
}
