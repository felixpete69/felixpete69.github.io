(() => {
  'use strict';
  const section = document.getElementById('flight');
  const stage = section.querySelector('.flight-stage');
  const canvas = section.querySelector('.flight-canvas');
  const scenes = [...section.querySelectorAll('.flight-scene')];
  const steps = [...section.querySelectorAll('[data-flight-step]')];
  const play = section.querySelector('.flight-play');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => reduce.matches || document.documentElement.dataset.motion === 'paused';
  const clamp = x => Math.max(0, Math.min(1, x));
  const stops = [0, .48, .90];
  const render = window.renderZijinFlight;
  const duration = 18;
  let position = 0, clock = 0, visible = false, playing = false;
  let animation = 0, lastFrame = 0, activeScene = -1, anchor = null;
  let lastScrollY = window.scrollY;
  let canRender = typeof render === 'function';
  let holdCopy = false, lastCopyPosition = -1, lastCopyHeld = false;

  const headlines = scenes.map(scene => {
    const heading = scene.querySelector('h2');
    const lines = [...heading.children];
    heading.setAttribute('aria-label', lines.map(line => line.textContent.trim()).join(' '));
    for (const line of lines) {
      const ink = document.createElement('span');
      ink.className = 'flight-line-ink';
      ink.textContent = line.textContent;
      line.className = 'flight-line-mask';
      line.setAttribute('aria-hidden', 'true');
      line.replaceChildren(ink);
    }
    return lines;
  });
  section.classList.add('has-line-motion');

  function ease(start, end, value) {
    const t = clamp((value - start) / (end - start));
    return t * t * (3 - 2 * t);
  }

  function paintCopy() {
    const held = paused() || holdCopy;
    if (position === lastCopyPosition && held === lastCopyHeld) return;
    lastCopyPosition = position; lastCopyHeld = held;
    const current = Math.min(scenes.length-1, Math.floor(position*scenes.length));
    for (const [i, scene] of scenes.entries()) {
      const start = i/scenes.length, end = (i+1)/scenes.length;
      const exposed = held ? i === current : position >= start-.04 && position <= end+.025;
      scene.classList.toggle('is-exposed', exposed);
      if (!exposed) continue;
      const first = i === 0, last = i === scenes.length-1;
      for (const [row, line] of headlines[i].entries()) {
        // The first baseline clears while the second is still on screen.
        // The next line enters the same slot only after it has been vacated.
        const handoff = row ? .019 : -.038;
        const enter = held || first ? 1 : ease(start+handoff, start+handoff+.084, position);
        const leave = held || last ? 0 : ease(end+handoff-.095, end+handoff, position);
        const direction = row ? -1 : 1;
        const register = held ? 0 : .18*Math.sin((position-stops[i])*8);
        const x = direction * (1.24*(1-enter) - .84*leave + register);
        line.style.setProperty('--line-travel', x.toFixed(3)+'em');
        line.style.setProperty('--line-lift', (112*(1-enter-leave)).toFixed(2)+'%');
      }
      const entering = held || first ? 1 : ease(start-.002, start+.082, position);
      const leaving = held || last ? 0 : ease(end-.092, end-.014, position);
      const caption = entering*(1-leaving);
      scene.style.setProperty('--caption-opacity', caption.toFixed(3));
      scene.style.setProperty('--caption-travel', ((1-entering-leaving)*.75).toFixed(3)+'em');
    }
    if (current !== activeScene) {
      activeScene = current;
      section.dataset.view = String(current);
      scenes.forEach((scene, index) => {
        scene.classList.toggle('is-current', index === current);
        scene.setAttribute('aria-hidden', String(index !== current));
        steps[index].setAttribute('aria-pressed', String(index === current));
      });
    }
  }

  function paint() {
    if (canRender) {
      const rendered = render(canvas, position, clock);
      if (rendered === false) canRender = false;
      section.classList.toggle('has-renderer', canRender);
    }
    if (!canRender) section.style.setProperty('--fallback-zoom', String(1 + position * .38));
    section.style.setProperty('--flight-progress', String(position));
    paintCopy();
  }

  function scrollFraction() {
    if (!section.classList.contains('is-driven')) return 0;
    const top = parseFloat(getComputedStyle(stage).top) || 0;
    return clamp((top - section.getBoundingClientRect().top) / Math.max(1, section.offsetHeight - stage.offsetHeight));
  }

  function remember() {
    anchor = {scroll: scrollFraction(), view: position};
  }

  function viewFor(scroll) {
    if (!anchor) return scroll;
    if (scroll === anchor.scroll) return anchor.view;
    if (scroll < anchor.scroll) return anchor.view * scroll / anchor.scroll;
    return anchor.view + (1 - anchor.view) * (scroll - anchor.scroll) / (1 - anchor.scroll);
  }

  function setPlaying(value) {
    playing = value;
    play.setAttribute('aria-pressed', String(value));
    play.querySelector('span').textContent = value ? 'Pause fly-through' : 'Play fly-through';
  }

  function frame(now) {
    animation = 0;
    if (!visible || document.hidden || paused()) return;
    const elapsed = lastFrame ? now - lastFrame : 50;
    if (elapsed >= 1000 / 30) {
      lastFrame = now;
      const delta = Math.min(elapsed / 1000, .13);
      clock += delta;
      if (playing) {
        position = clamp(position + delta / duration);
        if (position >= 1) {setPlaying(false); remember();}
      }
      paint();
    }
    if (canRender || playing) animation = requestAnimationFrame(frame);
  }

  function schedule() {
    if (!visible || document.hidden || paused()) {
      cancelAnimationFrame(animation);
      animation = 0; lastFrame = 0;
    } else if (!animation) animation = requestAnimationFrame(frame);
  }

  function onScroll() {
    const y = window.scrollY;
    if (!visible || paused() || y === lastScrollY) {lastScrollY = y; return;}
    const fraction = scrollFraction();
    if (playing) {setPlaying(false); remember();}
    holdCopy = false;
    position = clamp(viewFor(fraction));
    lastScrollY = y;
    if (!canRender) paint();
    schedule();
  }

  steps.forEach((button, index) => button.addEventListener('click', () => {
    position = stops[index];
    holdCopy = true;
    setPlaying(false);
    remember();
    paint();
    schedule();
  }));
  play.addEventListener('click', () => {
    if (position >= .99 && !playing) position = 0;
    holdCopy = playing;
    setPlaying(!playing);
    remember();
    paint();
    schedule();
  });

  function applyPreferences() {
    play.disabled = paused();
    if (paused()) {
      setPlaying(false);
      remember();
    } else {
      section.classList.add('is-driven');
    }
    if (visible) paint();
    schedule();
  }

  section.querySelector('.flight-toolbar').hidden = false;
  paintCopy();
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', () => {if (visible) paint();});
  document.addEventListener('visibilitychange', schedule);
  reduce.addEventListener('change', applyPreferences);
  new MutationObserver(applyPreferences).observe(document.documentElement, {attributes:true,attributeFilter:['data-motion']});
  applyPreferences();
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      position = paused() ? position : clamp(viewFor(scrollFraction()));
      paint();
    } else if (playing) {
      setPlaying(false);
      remember();
    }
    schedule();
  }).observe(stage);
})();
