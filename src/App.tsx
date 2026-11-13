import { useEffect, useState } from 'react';
import Storefront from './Storefront';
import Admin from './Admin';
import { initVisualInteractions } from './legacy/visual-interactions';

function StorefrontShell() {
  const [mounted, setMounted] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const host = document.getElementById('legacy-site');
    if (!host) return;
    const mountNode = host;

    let active = true;
    let cleanup: (() => void) | null = null;
    const controller = new AbortController();

    async function mountStorefront() {
      try {
        const response = await fetch('/vayron-markup.html', { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to load storefront markup');
        const markup = await response.text();
        if (!active) return;
        mountNode.innerHTML = markup;
        cleanup = initVisualInteractions();
        setMounted(true);
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === 'AbortError')) {
          setLoadError(true);
        }
      }
    }

    void mountStorefront();
    return () => {
      active = false;
      controller.abort();
      cleanup?.();
      mountNode.replaceChildren();
    };
  }, []);

  return (
    <>
      <div id="legacy-site" />
      {loadError ? <div className="empty">Не удалось загрузить магазин. Обнови страницу.</div> : null}
      {mounted ? <Storefront /> : null}
    </>
  );
}

export default function App() {
  return window.location.pathname.startsWith('/admin') ? <Admin /> : <StorefrontShell />;
}
