/* Keep the native document scroll position as the sole source of truth. */
(() => {
  'use strict';

  const root = document.documentElement;
  const scroller = document.scrollingElement || root;
  const desktop = matchMedia('(any-pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let goal = 0, position = 0, written = 0, frame = 0, lastTime = 0;
  let damping = 96;
  let listening = false;

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    position = written = goal = window.scrollY;
  }

  function limit() {
    return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  }

  function write(value) {
    position = value;
    window.scrollTo({top:value, behavior:'instant'});
    // Read back the browser's rounded position, but integrate the animation
    // in floating point so it also converges on low-DPI displays.
    written = window.scrollY;
  }

  function advance(now) {
    frame = 0;
    if (Math.abs(window.scrollY - written) > 1) {
      stop();
      return;
    }
    goal = Math.min(limit(), goal);
    const dt = Math.min(52, Math.max(1,now - lastTime));
    lastTime = now;
    if (Math.abs(goal - position) <= .65) {
      write(goal);
      return;
    }
    write(position + (goal - position) * (1 - Math.exp(-dt / damping)));
    frame = requestAnimationFrame(advance);
  }

  function nativeSurface(event) {
    if (document.querySelector('dialog[open]')) return true;
    for (const node of event.composedPath()) {
      if (node === document.body || node === root) break;
      if (!(node instanceof Element)) continue;
      if (node.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-native-scroll]')) return true;
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return true;
      if (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1) return true;
    }
    return false;
  }

  function onWheel(event) {
    if (!event.cancelable || event.defaultPrevented || !event.deltaY ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) * .45 || nativeSurface(event)) {
      stop();
      return;
    }
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientHeight : 1);
    // Reverse from the displayed position immediately, discarding outstanding
    // forward travel. Rebase on browser-driven positioning in the same way.
    if (!frame || Math.abs(window.scrollY - written) > 1 || (goal - position) * delta < 0) stop();
    const max = limit();
    const next = Math.min(max, Math.max(0,goal + delta));
    if (Math.abs(next - position) < .5) {
      stop();
      return;
    }
    event.preventDefault();
    goal = next;
    // Fine trackpad deltas need a shorter tail since the device already
    // supplies momentum. Wheel notches can ease out for a little longer.
    damping = Math.abs(delta) < 28 ? 46 : 98;
    const kick = Math.min(Math.abs(goal - position), Math.abs(delta) * .20);
    write(position + Math.sign(goal - position) * kick);
    if (!frame) {
      lastTime = performance.now();
      frame = requestAnimationFrame(advance);
    }
  }

  function configure() {
    stop();
    const active = desktop.matches && !reduced.matches && root.dataset.motion !== 'paused' && !document.hidden;
    if (active === listening) return;
    listening = active;
    if (active) window.addEventListener('wheel', onWheel, {passive:false});
    else window.removeEventListener('wheel', onWheel);
  }

  // Anchor jumps, history navigation, scrollbar dragging, keyboard navigation
  // and focus changes always take priority over any remaining mouse inertia.
  window.addEventListener('pointerdown',stop,{capture:true,passive:true});
  window.addEventListener('touchstart',stop,{capture:true,passive:true});
  window.addEventListener('keydown',stop,true);
  window.addEventListener('focusin',stop,true);
  window.addEventListener('click',stop,true);
  window.addEventListener('hashchange',stop);
  window.addEventListener('popstate',stop);
  window.addEventListener('pageshow',configure);
  document.addEventListener('visibilitychange',configure);
  desktop.addEventListener('change',configure);
  reduced.addEventListener('change',configure);
  new MutationObserver(configure).observe(root,{attributes:true,attributeFilter:['data-motion']});
  configure();
})();
