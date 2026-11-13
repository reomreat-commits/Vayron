/** Preserve the non-catalogue interactions from the approved storefront. */
export function initVisualInteractions(): () => void {
  const cleanups: Array<() => void> = [];

  const marquee = document.getElementById('mq');
  if (marquee) {
    const words = ['BUILT FOR THE STREETS', 'STREETWEAR DIVISION', 'VAYRON', 'НОВАЯ КОЛЛЕКЦИЯ'];
    const sequence = words.map((word) => `${word}<span>✦</span>`).join('');
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

  const section = document.getElementById('splash');
  const stage = document.getElementById('vsStage');
  const button = section?.querySelector<HTMLElement>('.vs-btn');
  const fitSplash = () => {
    if (!section || !stage) return;
    const width = section.clientWidth;
    const height = section.clientHeight;
    const scale = Math.max(width / 1280, height / 853);
    const left = (width - 1280 * scale) / 2;
    const top = height - 853 * scale;
    stage.style.transform = `translate(${left}px,${top}px) scale(${scale})`;
    if (button) button.style.top = `${Math.min(height - 78, top + 540 * scale)}px`;
  };
  const background = document.getElementById('siteBgI');
  const splashImage = document.getElementById('vsBg') as HTMLImageElement | null;
  if (background && splashImage) background.style.backgroundImage = `url("${splashImage.src}")`;
  fitSplash();
  window.addEventListener('resize', fitSplash);
  cleanups.push(() => window.removeEventListener('resize', fitSplash));
  const resizeObserver = section && 'ResizeObserver' in window ? new ResizeObserver(fitSplash) : null;
  if (section && resizeObserver) resizeObserver.observe(section);
  cleanups.push(() => resizeObserver?.disconnect());

  const onScroll = () => {
    if (background) background.style.transform = `translate3d(0,${-Math.min(window.scrollY * 0.05, 50)}px,0)`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener('scroll', onScroll));

  return () => cleanups.reverse().forEach((cleanup) => cleanup());
}
