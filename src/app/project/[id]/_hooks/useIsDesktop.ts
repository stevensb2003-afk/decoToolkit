'use client';

import { useState, useEffect } from 'react';

const DESKTOP_BREAKPOINT = 1024;
const DEBOUNCE_MS = 150;

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(true); // SSR-safe default

  useEffect(() => {
    const evaluate = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    };

    // Run immediately on mount
    evaluate();

    let timer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(evaluate, DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isDesktop;
}
