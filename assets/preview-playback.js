// A preview only animates while visible. The parent also controls global pause.
window.PreviewPlayback = {
  run(draw) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = parent === window, animation = 0, previous = performance.now();
    function tick(now) {
      animation = 0;
      draw(now, Math.min((now - previous) / 1000, 0.05));
      previous = now;
      if (visible && !document.hidden && !reduced.matches) animation = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(animation); animation = 0;
      previous = performance.now();
      const playing = visible && !document.hidden && !reduced.matches;
      document.documentElement.dataset.playing = String(playing);
      if (playing) animation = requestAnimationFrame(tick);
      else draw(previous, 0);
    }
    addEventListener('message', event => {
      if (event.source !== parent || event.data?.type !== 'preview-visibility') return;
      visible = Boolean(event.data.visible); sync();
    });
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    addEventListener('resize', () => draw(performance.now(), 0));
    addEventListener('pagehide', () => { visible = false; sync(); });
    draw(previous, 0); sync();
    if (parent !== window) parent.postMessage({ type: 'preview-ready' }, '*');
  }
};
