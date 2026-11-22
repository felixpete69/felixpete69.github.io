(() => {
  const root = document.documentElement;
  const cover = document.querySelector('.cover');
  const control = document.getElementById('globalMotion');
  const modes = [...document.querySelectorAll('[data-mode]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let pausedByUser = false;
  try { pausedByUser = localStorage.getItem('folio-motion') === 'paused'; } catch {}

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  let choreography;
  let introPlayed = false;
  const finePointer = matchMedia('(any-pointer: fine)');
  const words = [...cover.querySelectorAll('.cover-word')];
  // Split the display copy only. The H1 keeps its complete accessible name.
  for (const word of words) {
    word.replaceChildren(...[...word.textContent].map(letter => {
      const span = document.createElement('span');
      span.className = 'cover-letter';
      span.textContent = letter;
      return span;
    }));
  }

  function setChoreography(running) {
    choreography?.revert();
    words.forEach(word => word.classList.remove('is-revealing'));
    if (!gsap || !ScrollTrigger || !running) return;
    choreography = gsap.context(() => {
      if (!introPlayed && scrollY < 40) {
        // The initial wave travels across each baseline in opposite directions.
        words.forEach((word, index) => {
          word.classList.add('is-revealing');
          gsap.from(word.children, {
            yPercent: 118, rotation: index ? -7 : 7, transformOrigin: '50% 100%',
            stagger: {each: .043, from: index ? 'end' : 'start'}, delay: index * .13,
            duration: .76, ease: 'power3.out', clearProps: 'transform,transformOrigin',
            onComplete: () => word.classList.remove('is-revealing')
          });
        });
        gsap.from('.cover-line i', {yPercent: 35, opacity: 0, stagger: .14, duration: .52, clearProps: 'transform,opacity'});
        gsap.from('.cover-intro', {y: 14, opacity: 0, delay: .18, duration: .65, ease: 'power2.out', clearProps: 'transform,opacity'});
        introPlayed = true;
      }
      if (!finePointer.matches) return;
      const lean = words.map(word => gsap.quickTo(word, 'skewX', {duration:.18, ease:'power2.out'}));
      const settle = gsap.delayedCall(.10, () => lean.forEach(move => move(0))).pause();
      const movement = gsap.timeline({scrollTrigger: {
        trigger: cover, start: () => 'top top+=' + document.querySelector('.masthead').offsetHeight,
        end: 'bottom top', scrub: true, invalidateOnRefresh: true,
        onUpdate: trigger => {
          const degrees = gsap.utils.clamp(-6, 6, trigger.getVelocity() / 180);
          lean[0](-degrees);
          lean[1](degrees);
          settle.restart(true);
        }
      }});
      movement.to('.relief-frame', {yPercent: () => innerWidth > 700 ? 9 : 3, ease: 'none'}, 0)
        .to('.cover-line:first-child', {xPercent: () => innerWidth > 700 ? -9 : -5, ease: 'none'}, 0)
        .to('.second-line', {xPercent: () => innerWidth > 700 ? 16 : 8, ease: 'none'}, 0);
    }, cover);
  }

  function applyMotion() {
    const paused = pausedByUser || reduced.matches;
    root.dataset.motion = paused ? 'paused' : 'on';
    control.setAttribute('aria-pressed', String(paused));
    control.disabled = reduced.matches;
    const label = reduced.matches ? 'Reduced motion' : paused ? 'Motion off' : 'Motion on';
    control.querySelector('span').textContent = label;
    control.setAttribute('aria-label', reduced.matches ? 'Reduced motion enabled in system settings' : paused ? 'Enable all animations' : 'Pause all animations');
    modes.forEach(button => {button.disabled = paused;});
    setChoreography(!paused);
  }

  control.addEventListener('click', () => {
    pausedByUser = !pausedByUser;
    try { localStorage.setItem('folio-motion', pausedByUser ? 'paused' : 'on'); } catch {}
    applyMotion();
  });
  modes.forEach(button => button.addEventListener('click', () => {
    const mode = button.dataset.mode;
    modes.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    cover.dataset.mode = mode;
    window.dispatchEvent(new CustomEvent('terrain:mode', {detail: {mode}}));
  }));
  reduced.addEventListener('change', applyMotion);
  finePointer.addEventListener('change', () => setChoreography(root.dataset.motion !== 'paused'));
  applyMotion();

  const workLink = document.querySelector('.work-link');
  workLink.addEventListener('pointermove', event => {
    if (!finePointer.matches || event.pointerType === 'touch' || root.dataset.motion === 'paused') return;
    const bounds = workLink.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    workLink.style.translate = `${x * 9}px ${y * 7}px`;
  });
  workLink.addEventListener('pointerleave', () => {workLink.style.translate = '';});
})();
