import { useState, useEffect } from 'react';

/**
 * Hook to detect when the browser tab is hidden/visible.
 * Uses the Page Visibility API.
 */
export function useTabVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handler = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  return isVisible;
}
