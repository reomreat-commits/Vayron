import { useLayoutEffect, useState } from 'react';
import markup from './legacy/markup.html?raw';
import Storefront from './Storefront';
import Admin from './Admin';
import { initVisualInteractions } from './legacy/visual-interactions';

function StorefrontShell() {
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    const host = document.getElementById('legacy-site');
    if (!host) return;
    host.innerHTML = markup;
    const cleanup = initVisualInteractions();
    setMounted(true);
    return () => { cleanup(); host.replaceChildren(); };
  }, []);
  return <><div id="legacy-site" />{mounted ? <Storefront /> : null}</>;
}

export default function App() {
  return window.location.pathname.startsWith('/admin') ? <Admin /> : <StorefrontShell />;
}
