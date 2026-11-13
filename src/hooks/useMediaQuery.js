import { useState, useEffect } from 'react';

// true while the CSS media query matches (e.g. '(max-width: 639px)')
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    // addListener: Safari < 14
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);
  return matches;
}

// Phones in portrait: below Tailwind's `sm` breakpoint. Tablets keep the wide layout.
export function useIsPhone() {
  return useMediaQuery('(max-width: 639px)');
}
