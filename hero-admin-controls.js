(() => {
  'use strict';

  const el = (selector) => document.querySelector(selector);

  function currentMode() {
    return el('[data-path="hero.layout"]')?.value === 'single' ? 'single' : 'split';
  }

  function syncMode() {
    const mode = currentMode();
    const single = el('#heroLayoutSingle');
    const split = el('#heroLayoutSplit');
    if (single) single.checked = mode === 'single';
    if (split) split.checked = mode === 'split';

    document.querySelectorAll('.hero-upload-card').forEach((card) => {
      const requiredMode = card.dataset.heroMode;
      card.dataset.modeHidden = String(requiredMode !== mode);
    });
  }

  function setMode(mode) {
    const hidden = el('[data-path="hero.layout"]');
    if (!hidden) return;
    hidden.value = mode === 'single' ? 'single' : 'split';
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
    syncMode();
  }

  function refreshLocalPreviews() {
    document.querySelectorAll('.hero-upload-card').forEach((card) => {
      const img = card.querySelector('img');
      const fallback = card.dataset.fallback || '';
      if (!img || !fallback) return;
      if (img.getAttribute('src') !== fallback) img.setAttribute('src', fallback);
      img.style.display = 'block';
    });
  }

  function bind() {
    const layout = el('[data-path="hero.layout"]');
    layout?.addEventListener('change', syncMode);

    const singleSwitch = el('#heroLayoutSingle');
    const splitSwitch = el('#heroLayoutSplit');

    singleSwitch?.addEventListener('change', () => {
      if (singleSwitch.checked) setMode('single');
      else singleSwitch.checked = true;
    });

    splitSwitch?.addEventListener('change', () => {
      if (splitSwitch.checked) setMode('split');
      else splitSwitch.checked = true;
    });

    syncMode();
    refreshLocalPreviews();

    const adminView = el('#adminView');
    if (adminView) {
      new MutationObserver(() => {
        if (!adminView.classList.contains('hidden')) {
          setTimeout(() => {
            syncMode();
            refreshLocalPreviews();
          }, 80);
        }
      }).observe(adminView, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(bind, 500), { once: true });
  } else {
    setTimeout(bind, 500);
  }
})();
