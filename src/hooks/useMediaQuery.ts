'use client';

import { useState, useEffect } from '@/lib/performance/client';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      // Fallback for older browsers
      media.addListener(listener);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [query]);

  // Prevent hydration mismatch by returning false on first render
  if (!mounted) {
    return false;
  }

  return matches;
}

// Responsive breakpoint hooks based on design tokens
export function useBreakpoint() {
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isLargeDesktop = useMediaQuery('(min-width: 1280px)');
  const isExtraLargeDesktop = useMediaQuery('(min-width: 1536px)');

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isExtraLargeDesktop,
    // Utility functions
    isMobileOrTablet: isMobile || isTablet,
    isTabletOrAbove: !isMobile,
    isDesktopOrAbove: isDesktop || isLargeDesktop || isExtraLargeDesktop,
  };
}

// Hook for specific breakpoint values
export function useResponsive() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  
  return {
    // Sidebar width
    sidebarWidth: isMobile ? '100%' : isTablet ? '240px' : '256px',
    // Touch target sizes
    touchTargetSize: isMobile ? '44px' : '40px',
    // Grid columns
    gridCols: isMobile ? 2 : isTablet ? 3 : isDesktop ? 4 : 5,
    // Spacing
    spacing: isMobile ? '1rem' : isTablet ? '1.5rem' : '2rem',
  };
}