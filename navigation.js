(() => {
  const navigation = document.querySelector('.primary-nav');
  const toggle = document.querySelector('.nav-toggle');
  const compact = window.matchMedia('(max-width: 700px)');

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  }

  function applyLayout() {
    toggle.hidden = !compact.matches;
    navigation.classList.toggle('compact', compact.matches);
    setMenu(false);
  }

  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') === 'false'));
  navigation.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || !compact.matches) return;
    setMenu(false);
    const target = document.getElementById(link.hash.slice(1));
    if (target) {
      target.tabIndex = -1;
      target.focus({preventScroll: true});
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.masthead')) setMenu(false);
  });
  navigation.closest('.masthead').addEventListener('focusout', event => {
    if (event.relatedTarget && !event.relatedTarget.closest('.masthead')) setMenu(false);
  });
  compact.addEventListener('change', applyLayout);
  window.addEventListener('pageshow', applyLayout);
  applyLayout();
})();
