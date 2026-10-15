/* Upsellers landing — interactions & motion (see "KV02 — Motion & interaction notes" in Paper) */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isMobile = window.matchMedia('(max-width: 760px)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ------------------------------------------------------------------
     00 · Hero — staggered entrance + marks following the cursor
     ------------------------------------------------------------------ */
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('is-loaded')));
  // Once the entrance has played, drop the reveal transitions so hover/press feel instant again
  setTimeout(() => $$('.reveal').forEach((el) => el.classList.remove('reveal', 'reveal--pop')), 2200);

  const hero = $('.hero');
  if (hero) new IntersectionObserver(([e]) => hero.classList.toggle('is-offscreen', !e.isIntersecting)).observe(hero);
  const marks = $$('.mark');
  if (hero && finePointer.matches) {
    let raf = 0;
    hero.addEventListener('pointermove', (e) => {
      if (reduceMotion.matches) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
        marks.forEach((m) => {
          const dir = Number(m.dataset.parallax || 1);
          m.style.setProperty('--mx', (nx * 12 * dir).toFixed(2));
          m.style.setProperty('--my', (ny * 12 * dir).toFixed(2));
        });
      });
    });
    hero.addEventListener('pointerleave', () => {
      marks.forEach((m) => { m.style.setProperty('--mx', 0); m.style.setProperty('--my', 0); });
    });
  }

  /* ------------------------------------------------------------------
     Hero merchant stack — depth carousel (after React Bits' DepthCarousel):
     cards sit on a z-rail fanning right; every few seconds the front card
     fades forward and out while the rest move up. The upsell toast follows.
     ------------------------------------------------------------------ */
  const stack = $('.stack');
  const stage = $('.stack__stage', stack);
  const toast = $('.toast', stack);
  const toastTitle = $('[data-upsell-title]', toast);
  const toastMeta = $('[data-upsell-meta]', toast);

  const DC = {
    depth: 110,       // z distance between cards (px)
    spread: 58,       // sideways offset per card (px)
    tilt: 18,         // rotateY of receding cards (deg)
    visible: 2,       // cards behind the front one
    falloff: 0.18,    // brightness / tint per step back
    blur: 3,          // max blur on the furthest card (px)
    duration: 900,    // advance (ms)
    every: 4000,      // autoplay delay (ms)
  };
  const easeOut = (t) => 1 - Math.pow(1 - t, 3); // GSAP power3.out

  // Loop seamlessly: a second copy of the merchants enters at the back while
  // the first fades out in front, so no card ever pops in.
  const merchants = $$('.card', stage);
  merchants.forEach((card) => {
    const copy = card.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    $$('img', copy).forEach((img) => { img.alt = ''; });
    stage.append(copy);
  });
  const deck = $$('.card', stage);
  const tints = deck.map((c) => $('.card__tint', c));
  const tilts = deck.map((c) => parseFloat(c.dataset.tilt) || 0); // each card keeps its own slight lean
  const n = deck.length;

  let pos = 0;
  let focus = 0;
  let tweenRaf = 0;

  function layoutDeck(p) {
    for (let i = 0; i < n; i++) {
      let d = (((i - p) % n) + n) % n;
      if (d > n / 2) d -= n;
      const back = Math.max(0, d);
      const opacity = d < 0 ? Math.max(0, 1 + d) : clamp(DC.visible + 1 - d, 0, 1);
      const tz = -DC.depth * d;
      const tx = DC.spread * d;
      const ry = DC.tilt * clamp(d, 0, 1);
      const bright = Math.max(0.15, 1 - back * DC.falloff);
      const blurPx = Math.min(DC.blur, (back / DC.visible) * DC.blur);
      const el = deck[i];
      el.style.transform = `translate(-50%, -50%) translateX(${tx.toFixed(2)}px) translateZ(${tz.toFixed(2)}px) rotateY(${ry.toFixed(3)}deg) rotate(${tilts[i]}deg)`;
      el.style.opacity = opacity.toFixed(3);
      el.style.filter = blurPx > 0.05 ? `brightness(${bright.toFixed(3)}) blur(${blurPx.toFixed(2)}px)` : `brightness(${bright.toFixed(3)})`;
      el.style.zIndex = String(Math.round(2000 - d * 20));
      el.style.visibility = opacity < 0.01 ? 'hidden' : 'visible';
      tints[i].style.opacity = clamp(back * DC.falloff * 1.25, 0, 0.86).toFixed(3);
    }
  }

  function tweenDeck(target) {
    cancelAnimationFrame(tweenRaf);
    const from = pos;
    const start = performance.now();
    const step = (now) => {
      const t = clamp((now - start) / DC.duration, 0, 1);
      pos = from + (target - from) * easeOut(t);
      layoutDeck(pos);
      if (t < 1) tweenRaf = requestAnimationFrame(step);
      else { pos = ((target % n) + n) % n; layoutDeck(pos); }
    };
    tweenRaf = requestAnimationFrame(step);
  }

  function swapToast(card) {
    toast.classList.add('is-swapping');
    setTimeout(() => {
      toastTitle.textContent = card.dataset.upsell;
      toastMeta.textContent = card.dataset.upsellMeta;
      toast.classList.remove('is-swapping');
    }, 380);
  }

  function advance() {
    focus = (focus + 1) % n;
    tweenDeck(Math.round(pos) + 1);
    swapToast(deck[focus]);
  }

  let heroVisible = true;
  let stackHovered = false;
  const canAdvance = () => heroVisible && !stackHovered && !document.hidden && !reduceMotion.matches;

  // Stacked (tablet / mobile) hero: scale the carousel to the width it gets
  const stackWrap = $('.stack-wrap');
  const STACK_EXTENT = 482; // toast's left edge → third card's right edge, unscaled
  function fitStack() {
    if (getComputedStyle(stackWrap).position !== 'relative') {
      stackWrap.style.removeProperty('--stack-scale');
      return;
    }
    // the deck may use the hero's side padding too (+32px)
    const scale = clamp((stackWrap.clientWidth + 32) / STACK_EXTENT, 0.5, 1.25);
    stackWrap.style.setProperty('--stack-scale', scale.toFixed(3));
  }
  if (stackWrap) {
    fitStack();
    if ('ResizeObserver' in window) new ResizeObserver(fitStack).observe(stackWrap);
    else window.addEventListener('resize', fitStack);
  }

  if (stage && n > 1) {
    layoutDeck(pos);
    new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }, { threshold: 0.25 }).observe(stack);
    stack.addEventListener('pointerenter', () => { stackHovered = true; });
    stack.addEventListener('pointerleave', () => { stackHovered = false; });
    // first advance once the entrance has finished
    setTimeout(() => setInterval(() => { if (canAdvance()) advance(); }, DC.every), 1200);
  }

  /* ------------------------------------------------------------------
     Chapter nav — sliding highlight, glass by ground, click to scroll
     ------------------------------------------------------------------ */
  const nav = $('.chapters');
  const chapterLinks = $$('.chapter', nav);
  const sections = $$('[data-chapter]');
  const root = document.documentElement;
  let activeChapter = ''; // hero: nothing highlighted yet
  let instantTimer = 0;

  // The pill rests at the bottom of the hero; the sticky dock needs that distance
  function layoutDock() {
    const gap = parseFloat(getComputedStyle(root).getPropertyValue('--dock-gap')) || 40;
    root.style.setProperty('--dock-offset', `${hero.offsetHeight - gap - nav.offsetHeight}px`);
  }

  function placeGlider() {
    const link = chapterLinks.find((l) => l.dataset.target === activeChapter);
    if (!link) return;
    nav.style.setProperty('--gx', `${link.offsetLeft}px`);
    nav.style.setProperty('--gw', `${link.offsetWidth}px`);
  }

  // Glue the glider to the link (no slide) while it fades in or the layout settles
  function holdGlider(ms) {
    nav.classList.add('is-instant');
    clearTimeout(instantTimer);
    instantTimer = setTimeout(() => nav.classList.remove('is-instant'), ms);
  }

  function setChapter(id) {
    if (id === activeChapter) return;
    const fromIdle = !activeChapter;
    activeChapter = id;
    chapterLinks.forEach((l) => {
      const on = l.dataset.target === id;
      l.classList.toggle('is-active', on);
      if (on) l.setAttribute('aria-current', 'true');
      else l.removeAttribute('aria-current');
    });
    nav.classList.toggle('is-idle', !id);
    if (!id) return; // glider fades out where it is
    if (fromIdle) holdGlider(480);
    placeGlider();
  }

  layoutDock();
  document.fonts?.ready.then(() => { layoutDock(); holdGlider(60); placeGlider(); });

  // The active link grows when its number appears; keep the glider and dock in step
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => placeGlider());
    chapterLinks.forEach((l) => ro.observe(l));
    new ResizeObserver(() => layoutDock()).observe(hero);
  }

  const goliveSection = $('.golive');
  // A chapter lights up once the pill itself is over that section (Go live: see below)
  function updateNav() {
    const navRect = nav.getBoundingClientRect();
    const navY = navRect.top + navRect.height / 2;
    let ground = 'light';
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= navY && r.bottom >= navY) {
        setChapter(s.dataset.chapter);
        ground = s.dataset.ground;
      }
    }
    // Exception: Go live is the last, shortest stretch — light it as soon as it scrolls in
    const goTop = goliveSection.getBoundingClientRect().top;
    if (goTop <= window.innerHeight * 0.75) setChapter('go-live');
    if (nav.dataset.ground !== ground) nav.dataset.ground = ground;
  }

  chapterLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const target = document.getElementById(link.dataset.target);
      if (!target) return;
      e.preventDefault();
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - margin;
      window.scrollTo({ top, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      history.replaceState(null, '', `#${link.dataset.target}`);
    });
  });

  /* ------------------------------------------------------------------
     01 · Gain — calculator, count-up, bars
     ------------------------------------------------------------------ */
  const LAYERS = [1.09, 1.03, 1.05, 1.03]; // upsells, recovery, BNPL, retarget
  const MIN = 10_000, MID = 100_000, MAX = 1_000_000, MID_T = 0.375;

  const gain = $('.gain');
  const slider = $('#sales');
  const salesOut = $('[data-sales]');
  const amountEl = $('[data-amount]');
  const barEls = $$('[data-bar]');
  const mathEl = $('[data-math]');
  const mathBox = $('#math');
  const mathBtn = $('.footnote__link');

  const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
  function short(n) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
    if (n >= 100_000) return `$${Math.round(n / 1000)}K`;
    return `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }

  // Slider is log-scaled in two halves so $100K sits where the design puts it (~37.5%)
  function valueAt(t) {
    const v = t <= MID_T
      ? MIN * Math.pow(MID / MIN, t / MID_T)
      : MID * Math.pow(MAX / MID, (t - MID_T) / (1 - MID_T));
    const step = v < 50_000 ? 1_000 : v < 200_000 ? 5_000 : 10_000;
    return clamp(Math.round(v / step) * step, MIN, MAX);
  }

  function ladder(sales) {
    const out = [sales];
    LAYERS.forEach((m) => out.push(out[out.length - 1] * m));
    return out;
  }

  let currentGain = 0;
  let counted = false;

  function render(sales, { skipAmount = false } = {}) {
    const steps = ladder(sales);
    const total = steps[steps.length - 1];
    currentGain = total - sales;
    salesOut.textContent = usd(sales);
    slider.setAttribute('aria-valuetext', `${usd(sales)} a month`);
    barEls.forEach((el, i) => { el.textContent = short(steps[i]); });
    mathEl.textContent = `${usd(sales)} × ${LAYERS.join(' × ')} = ${usd(total)}`;
    if (!skipAmount) amountEl.textContent = '+' + usd(currentGain);
  }

  function syncFill() {
    slider.style.setProperty('--p', `${(slider.value / slider.max) * 100}%`);
  }

  slider.addEventListener('input', () => {
    syncFill();
    counted = true; // user took over — stop any count-up
    render(valueAt(slider.value / slider.max));
  });
  syncFill();
  render(valueAt(slider.value / slider.max), { skipAmount: true });

  mathBtn.addEventListener('click', () => {
    const open = mathBtn.getAttribute('aria-expanded') === 'true';
    mathBtn.setAttribute('aria-expanded', String(!open));
    mathBox.hidden = open;
  });

  function countUp(el, to, duration = 1300) {
    if (reduceMotion.matches) { el.textContent = '+' + usd(to); return; }
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    (function frame(now) {
      if (counted) return;
      const t = clamp((now - start) / duration, 0, 1);
      el.textContent = '+' + usd(to * ease(t));
      if (t < 1) requestAnimationFrame(frame);
      else counted = true;
    })(start);
  }

  if (!reduceMotion.matches) amountEl.textContent = '+$0';
  const gainIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      gain.classList.add('is-in');
      if (!counted) countUp(amountEl, currentGain);
      gainIO.disconnect();
    });
  }, { threshold: 0.35 });
  gainIO.observe(gain);

  /* ------------------------------------------------------------------
     02 · Setup — linear process down the page: the rail fills with scroll,
     each node starts its step's micro-demo, steps slide in left/right/left
     ------------------------------------------------------------------ */
  const stepsBox = $('.steps');
  const nodes = $$('.step__node');
  const stepEls = $$('.step');

  const demoConnect = $('.demo--connect');
  const demoBrand = $('.demo--brand');
  const demoOffer = $('.demo--offer');
  const typeEl = $('[data-type]', demoConnect);
  const statusEl = $('[data-status]', demoConnect);
  const statusText = $('[data-status-text]', demoConnect);
  const copiedEl = $('.code__copied', demoConnect);
  const syncText = $('[data-sync-text]', demoBrand);
  const offerBtn = $('.offer__btn', demoOffer);
  const SCRIPT = typeEl.textContent;

  // Demo start states
  function resetDemos() {
    typeEl.textContent = '';
    copiedEl.classList.add('is-hidden');
    statusEl.classList.add('is-waiting');
    statusText.textContent = 'WAITING';
    demoBrand.classList.add('is-empty');
    syncText.textContent = 'Pulling branding from Shopify…';
    demoOffer.classList.remove('is-added', 'has-cursor', 'is-pressing');
  }

  // Demo end states (also the reduced-motion / skip state)
  const finish = [
    () => {
      demoConnect.classList.remove('is-typing');
      typeEl.textContent = SCRIPT;
      copiedEl.classList.remove('is-hidden');
      statusEl.classList.remove('is-waiting', 'is-pop');
      statusText.textContent = 'CONNECTED';
    },
    () => {
      demoBrand.classList.remove('is-syncing', 'is-empty');
      syncText.textContent = 'Branding pulled from Shopify';
    },
    () => {
      demoOffer.classList.remove('has-cursor', 'is-pressing');
      demoOffer.classList.add('is-added');
    },
  ];

  // Each demo resolves when done; `alive()` lets a skip cut it short
  const play = [
    async (alive) => {
      demoConnect.classList.add('is-typing');
      for (let i = 1; i <= SCRIPT.length; i++) {
        if (!alive()) return;
        typeEl.textContent = SCRIPT.slice(0, i);
        await wait(32);
      }
      await wait(220); if (!alive()) return;
      demoConnect.classList.remove('is-typing');
      copiedEl.classList.remove('is-hidden');
      await wait(520); if (!alive()) return;
      statusEl.classList.remove('is-waiting');
      statusEl.classList.add('is-pop');
      statusText.textContent = 'CONNECTED';
      await wait(260);
      statusEl.classList.remove('is-pop');
      await wait(400);
    },
    async (alive) => {
      demoBrand.classList.add('is-syncing');
      await wait(850); if (!alive()) return;
      demoBrand.classList.remove('is-syncing');
      syncText.textContent = 'Branding pulled from Shopify';
      await wait(120); if (!alive()) return;
      demoBrand.classList.remove('is-empty');
      await wait(1100);
    },
    async (alive) => {
      const btnBox = offerBtn.getBoundingClientRect();
      const demoBox = demoOffer.getBoundingClientRect();
      const tx = btnBox.left - demoBox.left + btnBox.width * 0.62;
      const ty = btnBox.top - demoBox.top + btnBox.height * 0.45;
      demoOffer.style.setProperty('--cx', `${demoBox.width + 10}px`);
      demoOffer.style.setProperty('--cy', `${demoBox.height - 20}px`);
      demoOffer.style.setProperty('--cs', '1');
      await wait(30); if (!alive()) return;
      demoOffer.classList.add('has-cursor');
      demoOffer.style.setProperty('--cx', `${tx}px`);
      demoOffer.style.setProperty('--cy', `${ty}px`);
      await wait(1000); if (!alive()) return;
      demoOffer.classList.add('is-pressing');
      demoOffer.style.setProperty('--cs', '0.85');
      await wait(160); if (!alive()) return;
      demoOffer.classList.remove('is-pressing');
      demoOffer.style.setProperty('--cs', '1');
      demoOffer.classList.add('is-added');
      await wait(700); if (!alive()) return;
      demoOffer.classList.remove('has-cursor');
      await wait(400);
    },
  ];

  const state = { started: [false, false, false], done: [false, false, false], token: [0, 0, 0], current: -1 };

  function markDone(i) {
    state.done[i] = true;
    nodes[i].classList.remove('is-active');
    nodes[i].classList.add('is-done');
  }

  function skip(i) {
    if (state.done[i]) return;
    state.token[i]++;
    state.started[i] = true;
    finish[i]();
    markDone(i);
  }

  async function runStep(i) {
    // Anything before this step that hasn't finished jumps to its end state
    for (let j = 0; j < i; j++) skip(j);
    if (state.started[i]) return;
    state.started[i] = true;
    state.current = i;
    nodes[i].classList.add('is-active');
    if (reduceMotion.matches) { finish[i](); markDone(i); return; }
    const token = ++state.token[i];
    await play[i](() => state.token[i] === token);
    if (state.token[i] !== token) return;
    finish[i]();
    markDone(i);
  }

  function showAllFinal() {
    [0, 1, 2].forEach((i) => { state.started[i] = true; finish[i](); markDone(i); });
    stepEls.forEach((el) => el.classList.add('is-in'));
    stepsBox.style.setProperty('--rail-progress', '1');
  }

  resetDemos();

  if (reduceMotion.matches) {
    showAllFinal();
  }

  // Rail runs from the first node's centre to the last one's
  let railTop = 0;
  let railLen = 1;
  let nodeAt = [0, 0.5, 1];
  function layoutRail() {
    const box = stepsBox.getBoundingClientRect();
    const centres = nodes.map((n) => { const r = n.getBoundingClientRect(); return r.top + r.height / 2 - box.top; });
    railTop = centres[0];
    railLen = Math.max(1, centres[centres.length - 1] - centres[0]);
    nodeAt = centres.map((c) => (c - railTop) / railLen);
    stepsBox.style.setProperty('--rail-top', `${railTop}px`);
    stepsBox.style.setProperty('--rail-len', `${railLen}px`);
  }

  // The fill tip follows a line 55% down the viewport; a node starts its step when the tip reaches it
  function updateSetup() {
    if (reduceMotion.matches) return;
    // backup for the reveal observer: anything already well into view slides in
    stepEls.forEach((el) => {
      if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < window.innerHeight * 0.85) el.classList.add('is-in');
    });
    const box = stepsBox.getBoundingClientRect();
    const p = clamp((window.innerHeight * 0.55 - (box.top + railTop)) / railLen, 0, 1);
    stepsBox.style.setProperty('--rail-progress', p.toFixed(4));
    let want = -1;
    nodeAt.forEach((at, i) => { if (p >= at - 0.001 && box.top + railTop < window.innerHeight * 0.55) want = i; });
    if (want >= 0) runStep(want);
  }

  // Each step slides in from its own side as it enters
  const stepIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      stepIO.unobserve(e.target);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  stepEls.forEach((el) => stepIO.observe(el));

  layoutRail();
  if (reduceMotion.matches) showAllFinal();

  /* ------------------------------------------------------------------
     03 · Go live — word reveal, aurora
     ------------------------------------------------------------------ */
  const golive = $('.golive');
  const goIO = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { golive.classList.add('is-in'); goIO.disconnect(); }
  }, { threshold: 0.3 });
  goIO.observe(golive);

  // Aurora only animates while the section is on screen
  new IntersectionObserver(([e]) => golive.classList.toggle('is-visible', e.isIntersecting)).observe(golive);

  /* ------------------------------------------------------------------
     Scroll / resize loop
     ------------------------------------------------------------------ */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      updateNav();
      updateSetup();
    });
  }

  function onResize() {
    layoutDock();
    layoutRail();
    placeGlider();
    onScroll();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  isMobile.addEventListener?.('change', onResize);
  reduceMotion.addEventListener?.('change', () => {
    if (reduceMotion.matches) showAllFinal();
    onResize();
  });
  document.fonts?.ready.then(onResize);

  onScroll();
})();
