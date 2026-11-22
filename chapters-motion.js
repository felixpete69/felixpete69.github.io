/* The filmstrip also supports native horizontal scrolling without ScrollTrigger. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 900px) and (min-height: 520px) and (hover: hover) and (pointer: fine)');
  const paused = () => reduced.matches || root.dataset.motion === 'paused';
  const story = document.querySelector('.folio-process');
  const rail = story.querySelector('.folio-film');
  const pin = story.querySelector('.folio-process-pin');
  const slides = [...rail.querySelectorAll('figure')];
  const controls = story.querySelector('.folio-process-controls');
  const buttons = [...controls.querySelectorAll('button')];
  const counter = controls.querySelector('span');
  const bar = story.querySelector('.folio-film-progress');
  const triggerLib = window.ScrollTrigger;
  let trigger, anchor, active = 0, max = 0, offsets = [], measureRequest = 0;

  function updateReadout() {
    const left = rail.scrollLeft;
    const index = offsets.reduce((best, offset, i) =>
      Math.abs(left - offset) < Math.abs(left - offsets[best]) ? i : best, 0);
    active = index;
    const fraction = max > 0 ? left / max : 0;
    bar.style.setProperty('--film-progress', String((1 + fraction * (slides.length - 1)) / slides.length));
    counter.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
    buttons[0].setAttribute('aria-disabled', String(index === 0));
    buttons[1].setAttribute('aria-disabled', String(index === slides.length - 1));
  }

  function measure() {
    max = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const start = slides[0].getBoundingClientRect().left;
    offsets = slides.map(slide => Math.min(max, Math.max(0, slide.getBoundingClientRect().left - start)));
    updateReadout();
  }

  function remember() {
    if (trigger && max) anchor = { progress: trigger.progress, position: rail.scrollLeft / max };
  }

  function moveTo(index) {
    index = Math.min(slides.length - 1, Math.max(0, index));
    if (active === index) return;
    // Instant manual steps remain usable during a paused or scroll-driven sequence.
    rail.scrollLeft = offsets[index];
    remember();
    updateReadout();
  }

  buttons.forEach(button => {
    button.addEventListener('click', () => moveTo(active + Number(button.dataset.processStep)));
  });
  rail.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') moveTo(active - 1);
    else if (event.key === 'ArrowRight') moveTo(active + 1);
    else if (event.key === 'Home') moveTo(0);
    else if (event.key === 'End') moveTo(slides.length - 1);
    else return;
    event.preventDefault();
  });
  rail.addEventListener('scroll', updateReadout, {passive: true});

  function paint(progress) {
    if (paused() || document.hidden) return;
    let position = progress;
    if (anchor) {
      // Rejoin the scroll path through the currently displayed frame after a manual step or pause.
      if (progress === anchor.progress) position = anchor.position;
      else if (progress < anchor.progress) position = anchor.position * progress / anchor.progress;
      else position = anchor.position + (1 - anchor.position) * (progress - anchor.progress) / (1 - anchor.progress);
    }
    rail.scrollLeft = Math.round(max * position);
    updateReadout();
  }

  function enableDriver() {
    if (trigger || !desktop.matches || paused() || !triggerLib || !window.gsap) return;
    window.gsap.registerPlugin(triggerLib);
    story.classList.add('is-driven');
    measure();
    trigger = triggerLib.create({
      trigger: story,
      start: () => 'top top+=' + (parseFloat(getComputedStyle(pin).top) || 0),
      end: () => '+=' + Math.max(1, story.offsetHeight - pin.offsetHeight),
      invalidateOnRefresh: true,
      onUpdate: self => paint(self.progress)
    });
    remember();
  }

  function updateMode() {
    if (!desktop.matches && trigger) {
      trigger.kill();
      trigger = null;
      anchor = null;
      story.classList.remove('is-driven');
      measure();
      return;
    }
    // Keep the sticky section's measured height while paused to preserve the reader's vertical position.
    if (!trigger && !paused()) enableDriver();
    else remember();
  }

  function queueMeasure() {
    if (measureRequest) return;
    measureRequest = requestAnimationFrame(() => {
      measureRequest = 0;
      measure();
      if (trigger) trigger.refresh();
    });
  }

  controls.hidden = false;
  measure();
  updateMode();
  desktop.addEventListener('change', updateMode);
  reduced.addEventListener('change', updateMode);
  new MutationObserver(updateMode).observe(root, {attributes: true, attributeFilter: ['data-motion']});
  if ('ResizeObserver' in window) new ResizeObserver(queueMeasure).observe(pin);
  else window.addEventListener('resize', queueMeasure);
  document.fonts?.ready.then(queueMeasure);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !trigger || paused() || !trigger.isActive) return;
    paint(trigger.progress);
  });

  if (!('IntersectionObserver' in window)) return;
  const visibleTitles = new Set();
  const titleLines = new Map();
  const clamp = n => Math.min(1, Math.max(0, n));
  let titleFrame = 0;

  function drawTitles() {
    titleFrame = 0;
    if (paused() || document.hidden) return;
    const viewport = window.innerHeight;
    const narrow = window.innerWidth <= 640;
    const header = document.querySelector('.masthead')?.offsetHeight || 0;
    const boxes = [...visibleTitles].map(title => [title, title.getBoundingClientRect()]);
    for (const [title, box] of boxes) {
      // The middle of the viewport is a still reading area. Only its two edges move the lettering.
      const entering = clamp((viewport * .99 - box.top) / Math.max(box.height * 1.2, viewport * .28));
      const leaving = clamp((header + box.height * .08 - box.top) / Math.max(1, box.height * 1.05));
      const lines = titleLines.get(title);
      lines.forEach((line, i) => {
        const stagger = i * .23;
        const unrevealed = (1 - clamp((entering - stagger) / (1 - stagger))) ** 1.65;
        const exit = leaving * leaving;
        const direction = i % 2 ? 1 : -1;
        const x = direction * ((narrow ? .16 : .30) * unrevealed - .15 * exit);
        const y = unrevealed * 122 - exit * (i ? 8 : 18);
        const tint = Math.round((unrevealed * (i ? 92 : 48) + exit * 24) * 10) / 10;
        line.style.setProperty('--line-x', x.toFixed(3) + 'em');
        line.style.setProperty('--line-y', y.toFixed(2) + '%');
        line.style.setProperty('--line-tint', tint + '%');
      });
    }
  }

  function queueTitles() {
    if (!titleFrame && visibleTitles.size && !paused() && !document.hidden) {
      titleFrame = requestAnimationFrame(drawTitles);
    }
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visibleTitles.add(entry.target);
      else visibleTitles.delete(entry.target);
    }
    queueTitles();
  }, {rootMargin: '14% 0px'});

  for (const heading of document.querySelectorAll('.folio-heading')) {
    const title = heading.querySelector('h2');
    const original = [...title.childNodes];
    const label = title.innerText.replace(/\s+/g, ' ').trim();
    title.setAttribute('aria-label', label);
    title.replaceChildren();
    const lines = [];
    let text;
    for (const node of original) {
      if (node.nodeName === 'BR') {
        text = null;
        continue;
      }
      if (!text) {
        const mask = document.createElement('span');
        mask.className = 'folio-title-line';
        mask.setAttribute('aria-hidden', 'true');
        text = document.createElement('span');
        text.className = 'folio-title-ink';
        mask.append(text);
        title.append(mask);
        lines.push(text);
      }
      text.append(node);
    }
    titleLines.set(title, lines);
    observer.observe(title);
  }
  window.addEventListener('scroll', queueTitles, {passive: true});
  window.addEventListener('resize', queueTitles);
  document.addEventListener('visibilitychange', queueTitles);
  document.fonts?.ready.then(queueTitles);
  reduced.addEventListener('change', queueTitles);
  new MutationObserver(queueTitles).observe(root, {attributes: true, attributeFilter: ['data-motion']});
})();
