(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const stage = $('stage'), video = $('video'), knob = $('knob');
  const hint = $('volume-instructions');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const bodies = [
    { el: $('video-body'), grip: $('video-body'), x:0, y:0, vy:0, pointer:null },
    { el:knob, grip:knob, x:0, y:0, vy:0, pointer:null }
  ];
  const control = bodies[1];
  let dropped = false, keyboardHold = false, previous = 0, charge = 0, exploded = false;
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  const floor = body => Math.max(0,stage.clientHeight - 32 - body.el.offsetHeight);
  const gravity = 1600;
  const maxImpactSpeed = 2600;
  function impact(body, speed) {
    if (body === control && body.pendingImpact) {
      setVolume(speed / maxImpactSpeed);
      // One roll per hard impact, never on the subsequent bounces.
      if (speed >= 1900 && Math.random() < .4) explode();
    }
    body.pendingImpact = false;
  }
  function placeBall() {
    control.x = bodies[0].x + bodies[0].el.offsetWidth + 120;
    control.y = bodies[0].y + (bodies[0].el.offsetHeight-knob.offsetHeight)/2;
    bound(control);
  }
  function explode() {
    exploded = true;
    keyboardHold = false;
    knob.style.visibility = 'hidden';
    hint.style.visibility = 'hidden';
    if (!reduced.matches) {
      const x = control.x + knob.offsetWidth/2;
      const y = floor(control) + knob.offsetHeight/2;
      for (let i=0;i<24;i++) {
        const shard = document.createElement('span');
        shard.className = 'ball-shard';
        shard.setAttribute('aria-hidden','true');
        shard.style.left = `${x}px`; shard.style.top = `${y}px`;
        stage.append(shard);
        const dx = (Math.random()-.5)*360;
        const dy = -(50+Math.random()*230);
        shard.animate([
          { transform:'translate(-50%,-50%) scale(1)', opacity:1 },
          { transform:`translate(${dx*.6}px,${dy}px) rotate(120deg) scale(.8)`, opacity:1, offset:.55 },
          { transform:`translate(${dx}px,${dy+120}px) rotate(240deg) scale(0)`, opacity:0 }
        ], {duration:650+Math.random()*300,easing:'ease-out',fill:'forwards'});
        setTimeout(() => shard.remove(),1000);
      }
    }
    setTimeout(() => {
      placeBall(); control.vy = 0; control.pendingImpact = false;
      draw(control);
      knob.style.visibility = ''; hint.style.visibility = '';
      exploded = false;
    },1200);
  }
  function draw(body) {
    body.el.style.transform = `translate(${body.x}px, ${body.y}px)`;
    if (body === control) {
      const x = clamp(body.x + knob.offsetWidth/2 - hint.offsetWidth/2, 6, stage.clientWidth-hint.offsetWidth-6);
      // Follow above the ball, switching below only when the top edge is too close.
      const above = body.y - hint.offsetHeight - 10;
      const y = above >= 6 ? above : body.y + knob.offsetHeight + 10;
      hint.style.transform = `translate(${x}px, ${clamp(y,6,stage.clientHeight-32-hint.offsetHeight)}px)`;
    }
  }
  function bound(body) {
    body.x = clamp(body.x,0,stage.clientWidth-body.el.offsetWidth);
    body.y = clamp(body.y,0,floor(body));
  }
  function release(body, thrown = false) {
    const id = body.pointer;
    body.pointer = null;
    if (id !== null) {
      body.pendingImpact = thrown;
      if (!thrown) body.vy = 0;
    }
    if (id !== null && body.grip.hasPointerCapture(id)) body.grip.releasePointerCapture(id);
    body.el.classList.remove('held');
  }
  function setVolume(value) {
    video.volume = clamp(value,0,1);
    const percent = Math.round(video.volume*100);
    knob.textContent = `${percent}%`;
    knob.setAttribute('aria-label', `Volume ${percent}%. Throw the ball at the floor to set volume. Keyboard: hold Space to charge, release to throw.`);
  }
  function reset() {
    keyboardHold = false;
    dropped = false;
    bodies.forEach(body => release(body));
    bodies[0].x = 18; bodies[0].y = 32;
    placeBall();
    bodies.forEach(body => { body.vy = 0; bound(body); draw(body); });

  }
  function drop() {
    dropped = true;
    control.pendingImpact = true;
  }
  bodies.forEach(body => {
    body.grip.addEventListener('pointerdown', event => {
      if ((body === control && exploded) || event.button !== 0 || body.pointer !== null || keyboardHold) return;
      body.startX = event.clientX; body.startY = event.clientY; body.moved = false;
      if (!dropped) { if (body === control) { drop(); playVideo(); } return; }
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      body.pointer = event.pointerId;
      body.dx = event.clientX-rect.left-stage.clientLeft-body.x;
      body.dy = event.clientY-rect.top-stage.clientTop-body.y;
      body.vy = 0;
      body.pendingImpact = false;
      body.samples = [{y:event.clientY, t:event.timeStamp}];
      body.grip.setPointerCapture(event.pointerId);
      body.el.classList.add('held');
      if (body === control) knob.focus({preventScroll:true});
    });
    body.grip.addEventListener('pointermove', event => {
      if (body.pointer !== event.pointerId) return;
      sample(body,event);
      if (Math.hypot(event.clientX-body.startX,event.clientY-body.startY)>5) body.moved = true;
      const rect = stage.getBoundingClientRect();
      body.x = event.clientX-rect.left-stage.clientLeft-body.dx;
      body.y = event.clientY-rect.top-stage.clientTop-body.dy;
      bound(body); draw(body);
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(type => body.grip.addEventListener(type,event => {
      if (body.pointer !== event.pointerId) return;
      if (type === 'pointerup') {
        sample(body,event);
        const first = body.samples[0], last = body.samples[body.samples.length-1];
        body.vy = last.t > first.t ? clamp((last.y-first.y)*1000/(last.t-first.t),-3500,3500) : 0;
      }
      release(body,type === 'pointerup');
    }));
  });
  function sample(body,event) {
    body.samples.push({y:event.clientY,t:event.timeStamp});
    // Only recent motion counts: pausing before release is a drop, not a throw.
    body.samples = body.samples.filter(point => event.timeStamp-point.t <= 100);
  }
  knob.addEventListener('keydown',event => {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault();
    if (exploded || event.repeat || control.pointer !== null) return;
    if (!dropped) { drop(); playVideo(); return; }
    if (event.code === 'Space') {
      keyboardHold = true; charge = 0; control.y = 40; control.vy = 0;
      control.pendingImpact = false; draw(control);
    }
  });
  document.addEventListener('keyup',event => {
    if (event.code === 'Space' && keyboardHold) {
      keyboardHold = false;
      control.vy = Math.min(charge/1.5,1)*maxImpactSpeed;
      control.pendingImpact = true;
    }
  });
  function releaseAll() { keyboardHold = false; bodies.forEach(body => release(body)); }
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
  new ResizeObserver(() => {
    if (!dropped) reset();
    else bodies.forEach(body => { bound(body); draw(body); });
  }).observe(stage);
  function tick(now) {
    const dt = Math.min((now-previous)/1000 || 0,.033);
    previous = now;
    if (keyboardHold) charge += dt;
    if (dropped) bodies.forEach(body => {
      if (body.pointer !== null || (body === control && (keyboardHold || exploded))) return;
      const bottom = floor(body);
      if (reduced.matches) {
        impact(body, Math.sqrt(body.vy*body.vy + 2*gravity*Math.max(0,bottom-body.y)));
        body.y = bottom; body.vy = 0;
      }
      else {
        body.vy += gravity*dt;
        body.y += body.vy*dt;
        if (body.y >= bottom) {
          impact(body, Math.max(0,body.vy));
          body.y = bottom; body.vy = Math.abs(body.vy)>80 ? -body.vy*.26 : 0;
        }
      }
      draw(body);
    });
    requestAnimationFrame(tick);
  }
  setVolume(.35); reset(); requestAnimationFrame(tick);
})();
