import { useState, useEffect } from 'react';

// Views that have their own URL. All other views (editor, options, players)
// are sub-views of the control screen at "/".
const PATH_BY_VIEW = {
  projection: '/live',
  stage: '/stage',
  player: '/player',
  control: '/',
};

function viewFromPath(pathname) {
  const entry = Object.entries(PATH_BY_VIEW).find(([, path]) => path === pathname);
  return entry ? entry[0] : 'control';
}

// Current view, kept in sync with the browser URL (pushState / back button)
export function useViewRoute() {
  const [view, setView] = useState(() => viewFromPath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setView(viewFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Switch view and update the URL (for views with their own path)
  const navigate = (nextView) => {
    setView(nextView);
    if (PATH_BY_VIEW[nextView]) window.history.pushState(null, '', PATH_BY_VIEW[nextView]);
  };

  // Switch between control sub-views without touching the URL
  return { view, navigate, setSubView: setView };
}
