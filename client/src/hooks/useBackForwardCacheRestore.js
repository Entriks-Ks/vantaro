import { useEffect } from 'react';

export default function useBackForwardCacheRestore(onRestore) {
  useEffect(() => {
    const restore = (event) => {
      if (event.persisted) onRestore();
    };

    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, [onRestore]);
}
