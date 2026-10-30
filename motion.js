/* GSAP exhibition choreography. Static content remains usable without the library. */
(() => {
  'use strict';
  if (!window.gsap || !window.ScrollTrigger) return;
  const {gsap, ScrollTrigger} = window;
  gsap.registerPlugin(ScrollTrigger);
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let media = null;
  let introPlayed = false;
  const inactive = () => reduced.matches || root.dataset.motion === 'paused';
  function setup() {
    media?.revert();
    media = null;
    if (inactive()) return;
    media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      if (!introPlayed && scrollY < 100) {
        gsap.from('.title-line > span', {yPercent:110, rotation:3, duration:1.3, stagger:.13, ease:'power4.out', clearProps:'all'});
        gsap.from('.terrain-stack', {y:70, autoAlpha:0, duration:1.6, delay:.2, ease:'power3.out', clearProps:'opacity,visibility'});
        introPlayed = true;
      }
      gsap.to('.heading-star', {rotation:135, ease:'none', scrollTrigger:{trigger:'.thesis-heading', start:'top bottom', end:'bottom top', scrub:1}});
      gsap.to('.terrain-stack', {yPercent:14, rotation:3, ease:'none', scrollTrigger:{trigger:'.editorial-hero', start:'top top', end:'bottom top', scrub:1}});
      gsap.to('.layer-back', {xPercent:9, yPercent:-7, rotation:25, ease:'none', scrollTrigger:{trigger:'.editorial-hero', start:'top top', end:'bottom top', scrub:1}});
      gsap.to('.layer-front', {xPercent:-3, rotation:-9, ease:'none', scrollTrigger:{trigger:'.editorial-hero', start:'top top', end:'bottom top', scrub:1}});
    });
    media.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      const story = document.querySelector('.visual-story');
      const track = story.querySelector('.story-track');
      story.classList.add('is-scroll-story');
      story.scrollLeft = 0;
      const distance = () => Math.max(0, track.scrollWidth - story.clientWidth + 96);
      const slide = gsap.to(track, {x:() => -distance(), ease:'none', scrollTrigger:{trigger:story, start:'top 76px', end:() => '+=' + distance(), pin:true, scrub:.7, invalidateOnRefresh:true, onUpdate:self => gsap.set('.story-progress span',{scaleX:self.progress})}});
      return () => { slide.scrollTrigger?.kill(); story.classList.remove('is-scroll-story'); };
    });
    media.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
      const cleanups = [];
      document.querySelectorAll('.magnetic').forEach(el => {
        const move = e => {
          if (inactive()) return;
          const r=el.getBoundingClientRect();
          gsap.to(el,{x:(e.clientX-r.left-r.width/2)*.18,y:(e.clientY-r.top-r.height/2)*.18,duration:.45,ease:'power3.out',overwrite:'auto'});
        };
        const leave = () => gsap.to(el,{x:0,y:0,duration:.65,ease:'elastic.out(1,.5)',overwrite:'auto'});
        el.addEventListener('pointermove',move);el.addEventListener('pointerleave',leave);
        cleanups.push(() => {el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',leave);gsap.killTweensOf(el);gsap.set(el,{clearProps:'x,y'});});
      });
      const stage=document.querySelector('.terrain-stage');
      const move=e=>{if(inactive())return;const r=stage.getBoundingClientRect();gsap.to('.terrain-stack',{rotationY:(e.clientX-r.left-r.width/2)/r.width*15,rotationX:-(e.clientY-r.top-r.height/2)/r.height*12,duration:.7,ease:'power3.out',overwrite:'auto'});};
      const leave=()=>gsap.to('.terrain-stack',{rotationX:0,rotationY:0,duration:.9,ease:'power3.out'});
      stage.addEventListener('pointermove',move);stage.addEventListener('pointerleave',leave);
      return()=>{cleanups.forEach(f=>f());stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerleave',leave);gsap.killTweensOf('.terrain-stack','rotationX,rotationY');gsap.set('.terrain-stack',{rotationX:0,rotationY:0});};
    });
    ScrollTrigger.refresh();
  }
  setup();
  new MutationObserver(setup).observe(root,{attributes:true,attributeFilter:['data-motion']});
  reduced.addEventListener('change',setup);
  document.fonts.ready.then(()=>ScrollTrigger.refresh());
  addEventListener('load',()=>ScrollTrigger.refresh(),{once:true});
  document.querySelectorAll('details').forEach(el=>el.addEventListener('toggle',()=>ScrollTrigger.refresh()));
  document.querySelectorAll('[data-filter]').forEach(el=>el.addEventListener('click',()=>requestAnimationFrame(()=>ScrollTrigger.refresh())));
})();
