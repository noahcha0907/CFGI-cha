(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const stage = $('stage'), video = $('video'), knob = $('knob');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const bodies = [
    { el: $('video-body'), grip: $('video-body'), x:0, y:0, vy:0, pointer:null },
    { el:knob, grip:knob, x:0, y:0, vy:0, pointer:null }
  ];
  const control = bodies[1];
  let dropped = false, keyboardHold = false, previous = 0;
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
    knob.setAttribute('aria-label', `Volume ${Math.round(video.volume*100)}%. Hold in the upper screen and press up or down.`);
  }
  function reset() {
    keyboardHold = false;
    dropped = false;
    bodies.forEach(release);
    bodies[0].x = 18; bodies[0].y = 32;
    control.x = stage.clientWidth-knob.offsetWidth-22; control.y = 56;
    bodies.forEach(body => { body.vy = 0; bound(body); draw(body); });
    knob.classList.remove('ready');
  }
  function drop() {
    dropped = true;
    if (reduced.matches) bodies.forEach(body => { body.y = floor(body); draw(body); });
  }
  bodies.forEach(body => {
    body.grip.addEventListener('pointerdown', event => {
      if (event.button !== 0 || body.pointer !== null || keyboardHold) return;
      body.startX = event.clientX; body.startY = event.clientY; body.moved = false;
      if (!dropped) { if (body === control) { drop(); playVideo(); } return; }
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
      if (Math.hypot(event.clientX-body.startX,event.clientY-body.startY)>5) body.moved = true;
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
      return;
    }
    setVolume(video.volume+delta);
  }
  // Space provides a keyboard equivalent of continuously holding the pointer.
  knob.addEventListener('keydown',event => {
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      if (event.repeat) return;
      if (!dropped) { drop(); playVideo(); return; }
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
  async function playVideo() {
    try { await video.play(); } catch { /* A later video click can retry playback. */ }
  }
  function toggleVideo() { if (video.paused) playVideo(); else video.pause(); }
  bodies[0].el.addEventListener('click',() => { if (!bodies[0].moved) toggleVideo(); });
  bodies[0].el.addEventListener('keydown',event => {
    if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); if (!event.repeat) toggleVideo(); }
  });
  // A second finger can tap either half of the background while the first holds the knob.
  stage.addEventListener('pointerdown',event => {
    if (event.pointerType === 'touch' && event.target === stage && held()) {
      adjust(event.clientX-stage.getBoundingClientRect().left < stage.clientWidth/2 ? -.05 : .05);
    }
  });
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
