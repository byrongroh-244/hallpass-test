import { useState, useEffect } from 'react'

export type ScreenSize = 'mobile' | 'tablet' | 'desktop' | 'wide'

export function useWindowSize() {
  const [width, setWidth]   = useState(window.innerWidth)
  const [height, setHeight] = useState(window.innerHeight)

  useEffect(() => {
    const onResize = () => { setWidth(window.innerWidth); setHeight(window.innerHeight) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // iPad landscape: 1024×768 (mini) or 1133×744 (Air/Pro 11")
  // Key signal: width 1024–1200 AND height ≤ 820 = iPad landscape
  // Laptop: width > 1024 but height > 820
  const isIPadLandscape = width >= 1024 && width <= 1200 && height <= 820
  const isLargerThanIPad = width > 1200 || (width > 1024 && height > 820)

  const size: ScreenSize =
    width < 640  ? 'mobile'  :
    width < 1024 ? 'tablet'  :
    width < 1440 ? 'desktop' : 'wide'

  const isMobile  = size === 'mobile'
  const isTablet  = size === 'tablet'
  const isDesktop = size === 'desktop' || size === 'wide'
  const isWide    = size === 'wide'

  return { width, height, size, isMobile, isTablet, isDesktop, isWide, isIPadLandscape, isLargerThanIPad }
}
