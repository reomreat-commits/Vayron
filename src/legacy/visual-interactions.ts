/** Preserve the selected vayron.html visual effects without running its demo shop script. */
export function initVisualInteractions(): () => void {
  const cleanups: Array<() => void> = [];

  let revealObserver: IntersectionObserver | null = null;
  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver?.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
  }
  document.querySelectorAll('.rv:not(.in)').forEach(node => {
    if (revealObserver) revealObserver.observe(node);
    else node.classList.add('in');
  });
  cleanups.push(() => revealObserver?.disconnect());

  const marquee = document.getElementById('mq');
  if (marquee) {
    const words = ['BUILT FOR THE STREETS', 'STREETWEAR DIVISION', 'VAYRON', 'НОВАЯ КОЛЛЕКЦИЯ'];
    const sequence = words.map(word => word + '<span>✦</span>').join('');
    marquee.innerHTML = sequence.repeat(8);
  }

  const themeButton = document.getElementById('themeBtn');
  try {
    if (localStorage.getItem('vayron-theme') === 'dark') document.body.classList.add('dark');
  } catch { /* Storage may be disabled. */ }
  const onThemeClick = () => {
    if (!themeButton) return;
    themeButton.style.transform = 'scale(0.85) rotate(-20deg)';
    window.setTimeout(() => { themeButton.style.transform = ''; }, 280);
    document.body.classList.toggle('dark');
    try {
      localStorage.setItem('vayron-theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    } catch { /* Theme remains active for this page view. */ }
  };
  themeButton?.addEventListener('click', onThemeClick);
  cleanups.push(() => themeButton?.removeEventListener('click', onThemeClick));


  // Original VAYRON street scene: scale the 1280x853 composition to cover
  // the splash while anchoring it to the bottom, matching the source HTML.
  const splash = document.getElementById('splash');
  const stage = document.getElementById('vsStage');
  const button = splash?.querySelector<HTMLElement>('.vs-btn') ?? null;
  const backgroundLayer = document.getElementById('siteBgI') as HTMLElement | null;
  const sceneImage = document.getElementById('vsBg') as HTMLImageElement | null;
  if (splash && stage) {
    let resizeObserver: ResizeObserver | null = null;
    const fitScene = () => {
      const width = splash.clientWidth;
      const height = splash.clientHeight;
      if (!width || !height) return;
      const scale = Math.max(width / 1280, height / 853);
      const left = (width - 1280 * scale) / 2;
      const top = height - 853 * scale;
      stage.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
      if (button) button.style.top = Math.min(height - 78, top + 540 * scale) + 'px';
    };
    fitScene();
    window.addEventListener('resize', fitScene);
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(fitScene);
      resizeObserver.observe(splash);
    }
    if (backgroundLayer && sceneImage) {
      const syncBackdrop = () => {
        backgroundLayer.style.backgroundImage = 'url("' + sceneImage.currentSrc + '")';
      };
      if (sceneImage.complete) syncBackdrop();
      else sceneImage.addEventListener('load', syncBackdrop, { once: true });
      cleanups.push(() => sceneImage.removeEventListener('load', syncBackdrop));
    }
    cleanups.push(() => {
      window.removeEventListener('resize', fitScene);
      resizeObserver?.disconnect();
    });
  }

  // Original page-background parallax.
  if (backgroundLayer) {
    let scheduled = false;
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        backgroundLayer.style.transform = 'translate3d(0,' + (-Math.min(window.scrollY * 0.05, 50)) + 'px,0)';
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener('scroll', onScroll));
  }


  return () => cleanups.reverse().forEach(cleanup => cleanup());
}
