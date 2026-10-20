(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const stage = $('stage'), video = $('video'), knob = $('knob'), status = $('status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const bodies = [
    { el: $('video-body'), grip: $('video-grip'), x:0, y:0, vy:0, pointer:null },
    { el:knob, grip:knob, x:0, y:0, vy:0, pointer:null }
  ];
  const control = bodies[1];
  let dropped = false, keyboardHold = false, previous = 0, objectURL;
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  const floor = body => Math.max(0,stage.clientHeight - 32 - body.el.offsetHeight);
  const held = () => control.pointer !== null || keyboardHold;
  const ready = () => dropped && held() && control.y + knob.offsetHeight / 2 < stage.clientHeight * .43;
  function draw(body) { body.el.style.transform = `translate(${body.x}px, ${body.y}px)`; }
  function bound(body) {
    body.x = clamp(body.x,0,stage.clientWidth-body.el.offsetWidth);
    body.y = clamp(body.y,0,floor(body));
  }
  function release(body) {
    const id = body.pointer;
    body.pointer = null;
    if (id !== null && body.grip.hasPointerCapture(id)) body.grip.releasePointerCapture(id);
    body.el.classList.remove('held');
  }
  function setVolume(value) {
    video.volume = clamp(value,0,1);
    const label = `${Math.round(video.volume*100)}%`;
    $('level').textContent = `Volume: ${label}`;
    $('knob-level').textContent = label;
  }
  function reset() {
    keyboardHold = false;
    dropped = false;
    bodies.forEach(release);
    bodies[0].x = 18; bodies[0].y = 32;
    control.x = stage.clientWidth-knob.offsetWidth-22; control.y = 56;
    bodies.forEach(body => { body.vy = 0; bound(body); draw(body); });
    knob.classList.remove('ready');
    status.textContent = 'Press Play video, then try the volume knob.';
  }
  function drop() {
    dropped = true;
    status.textContent = 'Oops. Grab the knob again. Hold it above the line and press ↑ / ↓ (or use + / −).';
    if (reduced.matches) bodies.forEach(body => { body.y = floor(body); draw(body); });
  }
  bodies.forEach(body => {
    body.grip.addEventListener('pointerdown', event => {
      if (event.button !== 0 || body.pointer !== null || keyboardHold) return;
      if (!dropped) { if (body === control) drop(); return; }
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      body.pointer = event.pointerId;
      body.dx = event.clientX-rect.left-stage.clientLeft-body.x;
      body.dy = event.clientY-rect.top-stage.clientTop-body.y;
      body.vy = 0;
      body.grip.setPointerCapture(event.pointerId);
      body.el.classList.add('held');
      if (body === control) knob.focus({preventScroll:true});
    });
    body.grip.addEventListener('pointermove', event => {
      if (body.pointer !== event.pointerId) return;
      const rect = stage.getBoundingClientRect();
      body.x = event.clientX-rect.left-stage.clientLeft-body.dx;
      body.y = event.clientY-rect.top-stage.clientTop-body.dy;
      bound(body); draw(body);
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(type => body.grip.addEventListener(type,event => {
      if (body.pointer === event.pointerId) release(body);
    }));
  });
  function adjust(delta) {
    if (!ready()) {
      status.textContent = 'Volume locked. Lift the knob above the dotted line and KEEP holding it.';
      return;
    }
    setVolume(video.volume+delta);
    status.textContent = `Volume: ${Math.round(video.volume*100)}%. Don’t let go.`;
  }
  $('quieter').addEventListener('click',() => adjust(-.05));
  $('louder').addEventListener('click',() => adjust(.05));
  // Space provides a keyboard equivalent of continuously holding the pointer.
  knob.addEventListener('keydown',event => {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      if (event.repeat) return;
      if (!dropped) { drop(); return; }
      if (event.code === 'Space' && control.pointer === null) { keyboardHold = true; control.y = 40; control.vy = 0; draw(control); }
    }
  });
  document.addEventListener('keydown',event => {
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && (held() || document.activeElement === knob)) {
      event.preventDefault(); adjust(event.key === 'ArrowUp' ? .05 : -.05);
    }
  });
  document.addEventListener('keyup',event => { if (event.code === 'Space') keyboardHold = false; });
  function releaseAll() { keyboardHold = false; bodies.forEach(release); }
  addEventListener('blur',releaseAll);
  document.addEventListener('visibilitychange',() => { if (document.hidden) releaseAll(); });
  knob.addEventListener('blur',() => { keyboardHold = false; });
  $('play').addEventListener('click',async () => {
    if (!video.paused) { video.pause(); return; }
    try { await video.play(); } catch { status.textContent = 'Could not play this video. Choose a supported video file and try again.'; }
  });
  video.addEventListener('play',() => { $('play').textContent = 'Pause video'; });
  video.addEventListener('pause',() => { $('play').textContent = 'Play video'; });
  video.addEventListener('error',() => { status.textContent = 'Video could not load. Use Choose a video to select a local file.'; });
  $('file').addEventListener('change',event => {
    const file = event.target.files[0];
    if (!file) return;
    video.pause();
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = URL.createObjectURL(file);
    video.src = objectURL;
    video.load();
    status.textContent = 'Your video is ready. Press Play video to start with sound.';
  });
  $('reset').addEventListener('click',reset);
  new ResizeObserver(() => {
    if (!dropped) reset();
    else bodies.forEach(body => { bound(body); draw(body); });
  }).observe(stage);
  function tick(now) {
    const dt = Math.min((now-previous)/1000 || 0,.033);
    previous = now;
    if (dropped) bodies.forEach(body => {
      if (body.pointer !== null || (body === control && keyboardHold)) return;
      const bottom = floor(body);
      if (reduced.matches) { body.y = bottom; body.vy = 0; }
      else {
        body.vy += 1600*dt;
        body.y += body.vy*dt;
        if (body.y >= bottom) { body.y = bottom; body.vy = Math.abs(body.vy)>80 ? -body.vy*.26 : 0; }
      }
      draw(body);
    });
    knob.classList.toggle('ready',ready());
    requestAnimationFrame(tick);
  }
  setVolume(.35); reset(); requestAnimationFrame(tick);
})();
