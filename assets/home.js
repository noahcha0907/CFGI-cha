(() => {
  const previews = [...document.querySelectorAll('[data-preview]')];
  const toggle = document.getElementById('motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  const visible = new Map(previews.map(frame => [frame, false]));
  function send(frame) {
    frame.contentWindow?.postMessage({
      type: 'preview-visibility', visible: visible.get(frame) && !paused && !document.hidden && !reduced.matches
    }, '*');
  }
  function updateButton() {
    toggle.disabled = reduced.matches;
    toggle.setAttribute('aria-pressed', String(paused || reduced.matches));
    toggle.innerHTML = reduced.matches ? 'Reduced motion <span aria-hidden="true">—</span>' :
      paused ? 'Resume motion <span aria-hidden="true">▷</span>' : 'Pause motion <span aria-hidden="true">Ⅱ</span>';
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) { visible.set(entry.target, entry.isIntersecting); send(entry.target); }
  }, { threshold: 0.05 });
  for (const frame of previews) {
    observer.observe(frame);
    frame.addEventListener('load', () => send(frame));
  }
  addEventListener('message', event => {
    if (event.data?.type !== 'preview-ready') return;
    const frame = previews.find(item => item.contentWindow === event.source);
    if (frame) send(frame);
  });
  toggle.addEventListener('click', () => { paused = !paused; updateButton(); previews.forEach(send); });
  document.addEventListener('visibilitychange', () => previews.forEach(send));
  reduced.addEventListener('change', () => { updateButton(); previews.forEach(send); });
  updateButton();
  // Moving over a study also moves its shader's virtual mouse; the whole card
  // remains one accessible link to the original assignment.
  document.querySelectorAll('.study').forEach(card => {
    const frame = card.querySelector('iframe');
    card.addEventListener('pointermove', event => {
      const rect = frame.getBoundingClientRect();
      frame.contentWindow?.postMessage({type:'preview-pointer',
        x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),
        y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))}, '*');
    });
  });
})();
