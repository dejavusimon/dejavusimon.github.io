/* Home page behaviour
   1. Dock: when the zipper finishes, the centred DEJAVUSIMON shrinks smoothly into the
      title card's top-left corner, with equal space above and to the left of the letters.
   2. Collapse: scrolling down shrinks the title card; the word shortens right-to-left
      (the D stays put) and turns into the logo mark.
   3. Grid: 12 equal cards (3 × 4); hovering one grows it to 2 × 2 and the others reflow. */
(() => {
  const root = document.documentElement, body = document.body;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const V2 = root.dataset.variant === "v2";                        // prototype: toggle card on the left
  const V3 = root.dataset.variant === "v3";                        // prototype: V1 layout, toggle card sweeps left
  const BACKFLAP = V2 || V3;                                       // the toggle card becomes the back button
  // V3's sweep overshoots a little and settles (ease-out-back), both ways
  const outBack = (t, k = 1.25) => 1 + (k + 1) * (t - 1) ** 3 + k * (t - 1) ** 2;
  let workDir = 1;
  let workE = 0, lastC = 0;                                         // work-page morph 0 → 1; last collapse amount
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- title card geometry ----------
  const hero = document.querySelector(".card--hero");
  const block = document.querySelector(".hero-name");
  const clip = block.querySelector(".name-clip");
  const name = block.querySelector(".t-name");
  const mark = block.querySelector(".name-mark");
  const stageName = document.querySelector(".name-stage .t-display");

  const bar = document.querySelector(".topbar-inner");
  const intro = document.querySelector(".hero-intro");
  let m = {};   // measurements
  function flapWidth() {
    const gap = parseFloat(getComputedStyle(root).getPropertyValue("--card-gap")) || 12;
    const W = gridW();
    return W >= 720 ? (W - gap * 2) / 3 : (W - gap) * 0.4;   // = one work card on desktop
  }
  function cardHeight() {
    const g = document.querySelector(".work-grid");
    const gap = parseFloat(getComputedStyle(root).getPropertyValue("--card-gap")) || 12;
    const W = g.clientWidth, cols = W >= 720 ? 3 : 2;
    return Math.round(Math.max(150, ((W - gap * (cols - 1)) / cols) * 0.72));
  }
  // ---- intro behind a plus: closed / open heights, and where the plus/cross sits ----
  const toggle = hero.querySelector(".hero-toggle");
  let open = false, openE = 0;                                     // openE: 0 closed → 1 open (animated)
  // the grid's width, also while it is hidden behind a project page (same box: the board's content)
  const gridW = () => { const g = document.querySelector(".work-grid"); if (!g.hidden) return g.clientWidth;
    const b = document.querySelector(".board"), cs = getComputedStyle(b); return b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); };
  const phone = () => gridW() < 720;
  function measure() {
    // the top row is exactly as wide as the grid below, so the flap's edge always lines up
    bar.style.maxWidth = "none";
    bar.style.width = gridW() + "px";
    // on narrow screens the name shrinks until the whole word fits inside the title card
    name.style.fontSize = "";
    {
      const gap = parseFloat(getComputedStyle(root).getPropertyValue("--card-gap")) || 12;
      const padX = parseFloat(getComputedStyle(hero).paddingLeft);
      const avail = gridW() - flapWidth() - gap - padX * 2
                    - (phone() ? 34 : 0);                         // phones: room for the cross beside the name
      const ctx = document.createElement("canvas").getContext("2d"), cs = getComputedStyle(name);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const w = ctx.measureText(name.textContent.trim()).width;
      if (w > avail) name.style.fontSize = parseFloat(cs.fontSize) * avail / w * 0.98 + "px";
    }
    const cs = getComputedStyle(name), size = parseFloat(cs.fontSize);
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    const D = ctx.measureText("D");
    const asc = D.fontBoundingBoxAscent, desc = D.fontBoundingBoxDescent;
    const cap = D.actualBoundingBoxAscent, bearing = -D.actualBoundingBoxLeft;
    // with line-height 1, the gap from the line box top to the top of the capitals:
    const topInset = asc ? (size - (asc + desc)) / 2 + asc - cap : 0.15 * size;
    // pull the letters up and left so their visible edges sit exactly on the card padding
    name.style.marginTop = -topInset + "px";
    name.style.marginLeft = -bearing + "px";
    name.style.marginBottom = -(size - topInset - cap) + "px";      // block height = cap height
    clip.style.width = "";
    const pad = parseFloat(getComputedStyle(hero).paddingTop);
    m = {
      cap, pad,
      fullW: clip.scrollWidth,
      dW: D.actualBoundingBoxRight - bearing + 1,                   // just the D
      h0: 0,
      flapW: flapWidth(),
      sMin: 0.72,
    };
    m.hMin = Math.round(pad * 2 + cap * m.sMin);
    // intro: under the name, as wide as one work card (desktop) or the whole card (phones)
    const gW = gridW();
    const gap = parseFloat(getComputedStyle(root).getPropertyValue("--card-gap")) || 12;
    const heroW = gW - m.flapW - gap, inner = heroW - pad * 2;
    const ph = phone();
    const introTop = pad + cap + (ph ? 14 : 20);
    hero.style.setProperty("--intro-top", introTop + "px");
    hero.style.setProperty("--intro-w", (ph ? inner : Math.min(inner - 200, (gW - gap * 2) / 3 - pad)) + "px");
    const introH = intro.offsetHeight;
    if (ph) {
      const before = Math.max(cardHeight() * 0.7, pad * 2 + cap + 16 + introH);   // the old phone card
      m.hBase = Math.round(Math.max(before * 0.5, pad * 2 + cap + 12 + 28));
      m.hOpen = Math.round(introTop + introH + 12 + 20 + pad + 4);    // equal gaps name–intro–icons
    } else {
      m.hBase = Math.round(cardHeight() * 0.7);
      m.hOpen = Math.round(Math.max(m.hBase, introTop + introH + pad + 4));
    }
    m.h0 = lerp(m.hBase, m.hOpen, ease(openE));
    m.inner = inner; m.ph = ph; m.gap = gap;
    m.togS = clamp((cap * m.sMin) / 22, 0.45, 1);                  // back arrow ≈ logo height when collapsed
    placeToggle();
    // the mark: same height as the capitals, its left edge on the D's left edge
    mark.style.height = cap + "px";
    mark.style.width = cap * (168.425 / 138.422) + "px";
    root.style.setProperty("--hero-h0", m.h0 + "px");
    collapse();
  }
  function placeToggle() {
    const s = m.ph ? 28 : 36;
    if (m.ph) {
      hero.style.setProperty("--tog-x", (open ? m.inner - s + 4 : 0) + "px");
      hero.style.setProperty("--tog-top", open ? `calc(100% - ${m.pad + 14 + s / 2}px)` : `calc(50% - ${s / 2}px)`);
    } else {
      hero.style.setProperty("--tog-x", (open ? m.inner - s : 0) + "px");
      hero.style.removeProperty("--tog-top");
    }
  }
  let openAnim = 0;
  function setOpen(v) {
    if (v === open) return;
    open = v;
    hero.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open);
    toggle.setAttribute("aria-label", open ? "Close" : "About Simon");
    placeToggle();
    if (scrollY > 0) scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    const from = openE, to = open ? 1 : 0, t0 = performance.now(), dur = reduce ? 1 : 600, id = ++openAnim;
    const step = now => {
      if (id !== openAnim) return;
      const t = clamp((now - t0) / dur);
      openE = from + (to - from) * t;
      m.h0 = lerp(m.hBase, m.hOpen, ease(openE));
      root.style.setProperty("--hero-h0", m.h0 + "px");
      collapse();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  toggle.addEventListener("click", () => { if (workOpen) { if (!BACKFLAP) goBack(); } else setOpen(!open); });
  // desktop: the email icon copies the address and says so; phones keep the mail app link
  const mail = hero.querySelector('.hero-social a[href^="mailto:"]');
  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg><span></span>';
    toastEl.querySelector("span").textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
  }
  mail.addEventListener("click", async e => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const addr = mail.getAttribute("href").replace("mailto:", "");
    e.preventDefault();
    try { await navigator.clipboard.writeText(addr); }
    catch (err) {                                                   // older browsers: copy through a hidden field
      const t = document.createElement("textarea"); t.value = addr; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      const ok = document.execCommand("copy"); t.remove();
      if (!ok) { location.href = "mailto:" + addr; return; }
    }
    toast(`Email copied: ${addr}`);
  });
  addEventListener("keydown", e => { if (e.key === "Escape" && open) setOpen(false); });

  // ---------- 2. collapse on scroll ----------
  // The title card shrinks exactly as fast as the page scrolls, so the cards below always
  // ride up with it. When scrolling stops partway, the page itself glides on: past 50% to the
  // slim logo bar, under 50% back to the full card. Nothing rests half-collapsed.
  function apply(c) {
    lastC = c;
    bar.style.setProperty("--hero-h", lerp(m.h0, m.hMin, c) + "px");
    const fw = lerp(m.flapW, m.flapW / 2, ease(c));
    const E = ease(workE);
    if (E <= 0 && workE <= 0) {
      bar.style.setProperty("--flap-w", fw + "px");
      bar.style.removeProperty("--bar-gap");
      flap.style.width = flap.style.justifySelf = flap.style.opacity = flap.style.marginLeft = "";
      hero.style.width = hero.style.justifySelf = hero.style.opacity = hero.style.transform = "";
    } else if (V3) {
      // V3, in two beats: (1) the toggle card's left edge sweeps to the left border, its right
      // edge held on the right border, shoving the title card out to the left; (2) the right edge
      // lets go and springs left (a quick overshoot and settle) until the card is the left quarter of
      // the bar. Collapsed by scrolling, it is the left eighth.
      const full = bar.clientWidth, L0 = full - fw, split = .45;
      const ta = clamp(workE / split), tb = clamp((workE - split) / (1 - split));
      const Rt = lerp(m.h0, m.hMin, c);                               // a square: as wide as the bar is tall
      const L = lerp(L0, 0, ease(ta));
      const R = tb <= 0 ? full : lerp(full, Rt, workDir > 0 ? outBack(tb, 1.6) : ease(tb));
      const gp = Math.min(m.gap, L), track = full - L;
      bar.style.setProperty("--flap-w", track + "px");
      bar.style.setProperty("--bar-gap", gp + "px");
      flap.style.width = (R - L) + "px"; flap.style.marginLeft = ""; flap.style.justifySelf = "start";
      // too narrow for "‹ Physical": only the "‹" stays (the word folds away, as in the collapsed bar)
      if (backLayer) {
        const wd = backLayer.querySelector(".flap-word"), fs = parseFloat(getComputedStyle(wd).fontSize);
        const need = wd.querySelector(".ic").offsetWidth + wd.querySelector(".flap-label").scrollWidth + fs * .3 + (V3 ? 12 : m.pad * 2);
        flap.classList.toggle("is-narrow", R - L < need);
      }
      const heroNat = full - fw - m.gap, heroTrack = Math.max(0, L - gp);
      hero.style.width = heroNat + "px"; hero.style.justifySelf = "start";
      hero.style.transform = `translateX(${heroTrack - heroNat}px)`; hero.style.opacity = clamp(heroTrack / heroNat * 1.6);
    } else if (!V2) {
      // V1: the title card grows and pushes the toggle card off to the right
      bar.style.setProperty("--flap-w", fw * (1 - E) + "px");
      bar.style.setProperty("--bar-gap", m.gap * (1 - E) + "px");
      flap.style.width = fw + "px"; flap.style.justifySelf = "start"; flap.style.opacity = 1 - clamp(E * 1.25);
    } else {
      // V2: the toggle card grows and pushes the title card off to the right
      const full = bar.clientWidth;
      bar.style.setProperty("--flap-w", lerp(fw, full, E) + "px");
      bar.style.setProperty("--bar-gap", m.gap * (1 - E) + "px");
      hero.style.width = (full - fw - m.gap) + "px"; hero.style.justifySelf = "start"; hero.style.opacity = 1 - clamp(E * 1.25);
    }
    // V1 work page: the name fades as the bar shrinks and the back arrow takes the logo's place
    const fade = BACKFLAP ? 0 : E * clamp(c * 2.5);
    block.style.opacity = 1 - fade;
    hero.style.setProperty("--tog-s", lerp(1, m.togS || 0.7, BACKFLAP ? 0 : E * ease(c)));
    bar.style.setProperty("--c", c.toFixed(3));
    const a = ease(clamp(c / 0.75));                 // shorten + shrink
    const b = ease(clamp((c - 0.7) / 0.3));          // D → mark
    clip.style.width = lerp(m.fullW, m.dW, a) + "px";
    block.style.transform = `scale(${lerp(1, m.sMin, a)})`;
    name.style.opacity = 1 - b;
    mark.style.opacity = b * (1 - (BACKFLAP ? 0 : E));
    body.classList.toggle("is-collapsed", c > 0.3);
  }
  let snapTimer;
  function collapse() {
    if (!m.h0) return;
    const d = m.h0 - m.hMin;
    apply(clamp(scrollY / d));
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      const s = scrollY / d;
      if (s > 0.002 && s < 0.998 && !body.classList.contains("intro-active"))
        scrollTo({ top: s >= 0.5 ? d : 0, behavior: reduce ? "auto" : "smooth" });
    }, 140);
  }
  addEventListener("scroll", collapse, { passive: true });

  // ---------- 1. dock after the zipper ----------
  // About 2 s, one continuous ripple: the big name shrinks into the top-left corner; the title
  // card rises from the backdrop under it, then the toggle card, then the work cards in waves
  // spreading out from the title card toward the bottom of the page.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  // Scroll lock: the wheel/swipe that unzips the zipper must not carry on into the page.
  // The page can't scroll while the zipper or the reveal is running, and stays locked after
  // that until the wheel has been still for a moment (trackpad momentum keeps firing for ~1 s).
  let lastWheel = 0;
  const locked = () => body.classList.contains("intro-active") || body.classList.contains("is-revealing")
                       || performance.now() - lastWheel < 250 && body.dataset.wheelLock === "1";
  const blockScroll = e => {
    if (body.dataset.wheelLock !== "1" && !body.classList.contains("intro-active") && !body.classList.contains("is-revealing")) return;
    if (e.type === "wheel") lastWheel = performance.now();
    if (locked()) { e.preventDefault(); if (scrollY) scrollTo(0, 0); }
    else delete body.dataset.wheelLock;                               // input has gone quiet: unlock for good
  };
  if (document.querySelector(".intro")) body.dataset.wheelLock = "1";
  addEventListener("wheel", blockScroll, { passive: false });
  addEventListener("touchmove", blockScroll, { passive: false });
  addEventListener("keydown", e => { if (["ArrowDown","ArrowUp","PageDown","PageUp"," ","End","Home"].includes(e.key)) blockScroll(e); });
  addEventListener("scroll", () => { if (body.dataset.wheelLock === "1" && scrollY) scrollTo(0, 0); });
  function unlockWhenStill() {                                      // after the reveal: wait out any momentum
    const t = setInterval(() => {
      if (performance.now() - lastWheel >= 250) { delete body.dataset.wheelLock; clearInterval(t); }
    }, 60);
  }
  const POP = "cubic-bezier(.2, .8, .25, 1)";
  // Each piece is held hidden by body.is-revealing and let in by adding .rv-in at its moment
  // (plain CSS transitions; iOS Safari did not hold animations' first frame during a delay,
  // so the toggle card was showing next to the big name).
  function reveal() {
    if (reduce) return Promise.resolve();
    const els = [];
    const at = (el, delay) => { if (!el) return; els.push(el); setTimeout(() => el.classList.add("rv-in"), delay); };
    at(hero.querySelector(".hero-bg"), 750);
    at(flap, 850);
    at(toggle, 1000);
    // work cards: one wave per diagonal, measured from the title card in the top-left
    const maxD = Math.max(...pos.map(q => q.r + q.c)) || 1;
    cards.forEach((el, i) => at(el.querySelector(".work-card-inner"), 950 + (pos[i].r + pos[i].c) * (550 / maxD)));
    return new Promise(r => setTimeout(() => { r(); requestAnimationFrame(() => els.forEach(el => el.classList.remove("rv-in"))); }, 2050));
  }

  function dock() {
    scrollTo(0, 0);
    body.classList.add("is-revealing");
    active = -1; layoutGrid(false);
    // One element only: the name that lives in the card. It starts exactly over the big
    // centred name, scaled up, and settles to its own size, so nothing is swapped mid-flight.
    const stage = document.querySelector(".name-stage");
    const first = stageName.getBoundingClientRect();
    body.classList.add("is-home", "is-docked", "is-flying");   // card stops clipping while it moves
    stage.remove();
    collapse();
    const last = name.getBoundingClientRect();
    const shown = reveal();                                          // starts the ripple behind the name
    if (reduce) { body.classList.remove("is-flying", "is-revealing"); unlockWhenStill(); return; }
    const s = first.width / last.width;
    name.animate(
      [{ transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${s})` },
       { transform: "translate(0px, 0px) scale(1)" }],
      { duration: 800, delay: 400, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "backwards" }
    ).finished.then(() => body.classList.remove("is-flying"));
    shown.then(() => { body.classList.remove("is-revealing"); unlockWhenStill(); queueLit(); });
  }

  // ---------- 3. grid ----------
  // Which card is hovered is worked out from the settled layout (not from what's under the
  // pointer mid-animation), and a card grows from the cell it sits in now, so it never jumps
  // away from the cursor and two cards can't keep trading places.
  const grid = document.querySelector(".work-grid");
  const cards = [...grid.querySelectorAll(".work-card")];
  let active = -1, slots = [], pos = [], cols = 3;
  const gridPool = grid.querySelector(".grid-pool");
  // the photo colour, a little richer (what the old saturate/brightness filter did)
  function vivid(hex) {
    let [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return `hsl(${Math.round(h * 60 + 360) % 360} ${Math.min(100, sat * 175).toFixed(0)}% ${Math.min(92, l * 108).toFixed(0)}%)`;
  }
  const poolBlobs = cards.map(el => {
    if (!el.dataset.c1) return null;
    return [el.dataset.c1, el.dataset.c2].map(c => { const b = document.createElement("i"); b.style.setProperty("--c", vivid(c)); gridPool.appendChild(b); return b; });
  });

  function layoutGrid(animate = true, anchor) {
    const gap = parseFloat(getComputedStyle(root).getPropertyValue("--card-gap")) || 12;
    const W = grid.clientWidth;
    const frames = body.classList.contains("is-frames");
    cols = W >= 720 ? 3 : frames ? 2 : 1;
    const cw = (W - gap * (cols - 1)) / cols, ch = frames ? cw * 4 / 3 : cw * 0.72;   // photos are 3:4
    const occ = [];
    const free = (r, c, n) => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (c + j >= cols || (occ[r + i] && occ[r + i][c + j])) return false; return true; };
    const take = (r, c, n) => { for (let i = 0; i < n; i++) { occ[r + i] ||= []; for (let j = 0; j < n; j++) occ[r + i][c + j] = true; } };
    const next = [];
    if (active >= 0) {
      const at = anchor || pos[active] || { r: Math.floor(active / cols), c: active % cols };
      const r = at.r, c = Math.min(at.c, cols - 2);
      take(r, c, 2); next[active] = { r, c, n: 2 };
    }
    cards.forEach((_, i) => {
      if (i === active) return;
      for (let r = 0; ; r++) {
        let c = 0; while (c < cols && !free(r, c, 1)) c++;
        if (c < cols) { take(r, c, 1); next[i] = { r, c, n: 1 }; break; }
      }
    });
    pos = next;
    grid.classList.toggle("no-anim", !animate);
    let rows = 0; slots = [];
    cards.forEach((el, i) => {
      const { r, c, n } = pos[i];
      rows = Math.max(rows, r + n);
      const x = c * (cw + gap), y = r * (ch + gap), w = n * cw + (n - 1) * gap, h = n * ch + (n - 1) * gap;
      slots.push({ i, x, y, w, h });
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.width = w + "px"; el.style.height = h + "px";
      el.classList.toggle("is-open", i === active);
    });
    grid.style.height = rows * ch + (rows - 1) * gap + "px";
    // colour pool: two blobs per photo card, in that photo's own colours, centred on the card
    slots.forEach(({ i, x, y, w, h }) => {
      const el = cards[i]; if (!el.dataset.c1) return;
      const [b1, b2] = poolBlobs[i];
      const bw = w * 2.6, bh = h * 1.6;                            // each blob spills well past its card
      const place = (b, cx, cy) => { b.style.width = bw + "px"; b.style.height = bh + "px";
                                     b.style.transform = `translate(${cx - bw / 2}px, ${cy - bh / 2}px)`; };
      place(b1, x + w * .5, y + h * .15);                         // main tone, upper half
      place(b2, x + w * .5, y + h * .8);                          // second tone, lower half
    });
    if (!animate) requestAnimationFrame(() => grid.classList.remove("no-anim"));
  }
  function setActive(i) {
    if (i === active) return;
    const anchor = i >= 0 ? { r: pos[i].r, c: pos[i].c } : null;   // grow from where it is now
    active = i;
    layoutGrid(true, anchor);
  }
  function cardAt(e) {
    const r = grid.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = slots.find(s => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
    return hit ? hit.i : null;                                       // null = in a gap between cards
  }
  const framesMode = () => body.classList.contains("is-frames");   // photos don't expand on hover
  // Mouse: a card is open only while the pointer is over it. Over a gap, outside the grid,
  // over the title bar, off the window, or after the page scrolls away from under the
  // pointer, everything returns to the small grid. A short grace period lets the pointer
  // cross a gap into the next card without the whole grid closing and reopening.
  let pointer = null, closeTimer;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)");
  function track() {
    if (!pointer || workOpen || framesMode() || !canHover.matches || body.classList.contains("is-revealing") || body.classList.contains("intro-active")) return;
    const overBar = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest(".topbar");
    let i = overBar ? null : cardAt(pointer);
    if (i !== null && !hasWork(cards[i])) i = null;                  // empty cards never open
    const target = i === null ? -1 : i;
    if (target === active) { clearTimeout(closeTimer); pending = null; return; }
    if (target === pending) return;                                  // already on its way
    clearTimeout(closeTimer); pending = target;
    // Hover intent: a card opens only once the pointer settles on it. Passing over other cards
    // on the way (which would reshuffle the grid and move the card you're heading for) does nothing.
    const wait = target === -1 ? 120 : active === -1 ? 60 : 170;
    closeTimer = setTimeout(() => { pending = null; setActive(target); }, wait);
  }
  let pending = null;
  function hasWork(el) {
    const f = el.querySelector(".face--front");
    return !!f.querySelector(`.panel--${f.dataset.show} .work-cover`);
  }
  document.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    pointer = { clientX: e.clientX, clientY: e.clientY }; track();
  }, { passive: true });
  addEventListener("scroll", () => requestAnimationFrame(track), { passive: true });
  const release = () => { pointer = null; clearTimeout(closeTimer); pending = null; setActive(-1); };
  document.documentElement.addEventListener("pointerleave", release);
  addEventListener("blur", release);
  // touchscreens: cards never expand (no hover there, and tapping should open the project later)

  // decode every cover image up front so the first hover never waits on (or flashes) an image
  grid.querySelectorAll(".work-cover img, .frame-photo").forEach(img => { img.loading = "eager"; img.decode?.().catch(() => {}); });

  // ---------- 3a. Phones: the card in the middle of the screen turns to colour ----------
  // One card at most, the one whose centre is nearest the screen's centre (and within the
  // middle band). A new card only takes over once it is clearly nearer, so two cards near the
  // middle can't keep swapping.
  let lit = null, litQueued = false;
  const narrow = matchMedia("(max-width: 720px)");
  function updateLit() {
    litQueued = false;
    let best = null, bestD = Infinity;
    if (narrow.matches && !framesMode() && body.classList.contains("is-home") && !body.classList.contains("is-revealing")) {
      // the "middle" slides up near the top of the page and down near the bottom, so the first
      // and last works (which can never reach the true centre) still get their turn
      const H = innerHeight, band = H * 0.3, rest = document.documentElement.scrollHeight - (scrollY + H);
      const mid = H * (scrollY < band ? lerp(0.34, 0.5, scrollY / band) : rest < band ? lerp(0.7, 0.5, rest / band) : 0.5);
      for (const el of cards) {
        const f = el.querySelector(".face--front"); if (!f.querySelector(`.panel--${f.dataset.show} .work-cover`)) continue;
        const r = el.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = el; }
      }
      if (bestD > innerHeight * 0.22) best = null;                  // nothing in the middle band
      if (lit && best && best !== lit) {
        const r = lit.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid);
        if (d < innerHeight * 0.22 && d - bestD < 48) best = lit;    // hold until clearly beaten
      }
    }
    if (best !== lit) { lit?.classList.remove("is-lit"); best?.classList.add("is-lit"); lit = best; }
  }
  const queueLit = () => { if (!litQueued) { litQueued = true; requestAnimationFrame(updateLit); } };
  addEventListener("scroll", queueLit, { passive: true });
  addEventListener("resize", queueLit);

  // ---------- 3b. Frames: turn a photo over to see where it was taken ----------
  cards.forEach(el => { if (el.dataset.c1) el.style.setProperty("--tint", el.dataset.c1); });
  const persp = "perspective(1100px) ";
  function turnPhoto(panel, show) {
    if (panel.classList.contains("show-map") === show || panel._turning) return;
    panel._turning = true;
    const done = () => { panel.style.transform = ""; panel._turning = false; };
    if (reduce) { panel.classList.toggle("show-map", show); return done(); }
    const dir = show ? 1 : -1;                                       // turns the same way back
    panel.animate([{ transform: persp + "rotateY(0deg)" }, { transform: persp + `rotateY(${90 * dir}deg)` }],
                  { duration: 230, easing: "cubic-bezier(.55, 0, .85, .35)", fill: "forwards" })
      .finished.then(a => {
        panel.classList.toggle("show-map", show);
        a.cancel();
        return panel.animate([{ transform: persp + `rotateY(${-90 * dir}deg)` }, { transform: persp + "rotateY(0deg)" }],
                             { duration: 320, easing: "cubic-bezier(.15, .65, .35, 1)" }).finished;
      }).then(done, done);
  }
  const touchOnly = matchMedia("(hover: none)");
  grid.addEventListener("click", e => {
    if (touchOnly.matches && framesMode() && !e.target.closest(".frame-pin")) {
      const panel = e.target.closest(".work-card")?.querySelector(".face--front .panel--frames:not(.is-empty)");
      if (panel) turnPhoto(panel, !panel.classList.contains("show-map"));
      return;
    }
    const pin = e.target.closest(".frame-pin"); if (!pin) return;
    e.stopPropagation();
    const panel = pin.closest(".panel--frames");
    turnPhoto(panel, !panel.classList.contains("show-map"));
  });
  cards.forEach(el => el.addEventListener("mouseleave", e => {      // leaving the card turns it back
    if (e.pointerType && e.pointerType !== "mouse") return;
    el.querySelectorAll(".panel--frames.show-map").forEach(p => turnPhoto(p, false));
  }));
  const resetMaps = () => grid.querySelectorAll(".panel--frames.show-map").forEach(p => p.classList.remove("show-map"));

  // ---------- 4. Objects / Interfaces / Frames toggle ----------
  // A split-flap tile cycles three sides. Each flip drops the tile's top leaf and tips every
  // work card over top-to-bottom; the card's hidden face is loaded with the next side first.
  const ICON = {
    cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8 20.5 7.5v9L12 21.2 3.5 16.5v-9Z"/><path d="M3.5 7.5 12 12.2l8.5-4.7M12 12.2v9"/></svg>',
    cursor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 3.5 19 11l-6.2 1.6L9.6 18.8Z"/><path d="m12.8 12.6 4.6 6.4"/></svg>',
    frame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.5 8V4.5h3.5M17 4.5h3.5V8M20.5 16v3.5H17M7 19.5H3.5V16"/><circle cx="12" cy="12" r="2.6"/></svg>',
  };
  const MODES = [
    { key: "physical", panel: "objects", word: "Physical", icon: ICON.cube },
    { key: "digital", panel: "interfaces", word: "Digital", icon: ICON.cursor },
    { key: "frames", panel: "frames", word: "Frames", icon: ICON.frame },
  ];
  const flap = document.querySelector(".flap");
  const face = mo => `<span class="flap-content"><span class="flap-word">${mo.icon}<span class="flap-label">${mo.word}</span></span></span>`;
  let mode = 0, flipping = false, targetPanel = "objects";
  function renderFlap(cur, next = cur) {
    flap.innerHTML = `
      <span class="flap-half flap-top">${face(MODES[next])}</span>
      <span class="flap-half flap-bottom">${face(MODES[cur])}</span>
      <span class="flap-leaf">
        <span class="flap-half flap-top leaf-front">${face(MODES[cur])}</span>
        <span class="flap-half flap-bottom leaf-back">${face(MODES[next])}</span>
      </span>`;
  }
  renderFlap(0);
  function setPageMode(i) {
    root.dataset.mode = MODES[i].key;
    body.classList.toggle("is-digital", i === 1);
    body.classList.toggle("is-frames", i === 2);
  }
  function flip() {
    if (flipping) return;
    flipping = true;
    const next = (mode + 1) % MODES.length;
    renderFlap(mode, next);
    const leaf = flap.querySelector(".flap-leaf");
    // cards: each one tips forward until it is edge-on, its side is swapped while it can't be
    // seen, and it tips back down. Only one face exists, so the old side can never show through.
    const P = "perspective(1400px) ";
    targetPanel = MODES[next].panel;
    cardOrder().forEach((el, k) => {
      const inner = el.querySelector(".work-card-inner"), front = el.querySelector(".face--front");
      if (reduce) { front.dataset.show = MODES[next].panel; return; }
      inner.animate([{ transform: P + "rotateX(0deg)" }, { transform: P + "rotateX(-90deg)" }],
                    { duration: 340, delay: k * 55, easing: "cubic-bezier(.55, 0, .85, .35)", fill: "both" })
        .finished.then(a => {
          front.dataset.show = targetPanel;                        // the latest choice, even mid-run
          inner.animate([{ transform: P + "rotateX(90deg)" }, { transform: P + "rotateX(0deg)" }],
                        { duration: 440, easing: "cubic-bezier(.15, .65, .35, 1)" });
          a.cancel();
        });
    });
    setPageMode(next);
    resetMaps();
    setTimeout(queueLit, 900);
    if (next === 2) active = -1;                                     // collapse any open card entering Frames
    layoutGrid(true);
    const label = `Showing ${MODES[next].word.toLowerCase()}. Flip to show ${MODES[(next + 1) % 3].word.toLowerCase()}`;
    const done = () => { mode = next; renderFlap(mode); flipping = false; flap.setAttribute("aria-label", label); };
    if (reduce) return done();
    leaf.animate([{ transform: "rotateX(0deg)" }, { transform: "rotateX(-180deg)" }],
                 { duration: 520, easing: "cubic-bezier(.55, 0, .85, .35)" })          // falls like a real flap
        .finished.then(() => leaf.animate(
          [{ transform: "rotateX(-180deg)" }, { transform: "rotateX(-168deg)" }, { transform: "rotateX(-180deg)" }],
          { duration: 160, easing: "ease-out" }).finished)                              // small settle bounce
        .then(() => { leaf.style.transform = "rotateX(-180deg)"; done(); });
  }
  // After a flip, every card rests at a whole number of half-turns. Put each one back to 0deg
  // with the showing side on its front face, so the browser drops the 3D layers; leftover
  // turned layers are what made rows of photos render cut off.
  // cards flip in reading order: top-left first, across then down
  const cardOrder = () => [...cards].sort((a, b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return Math.round(ra.top - rb.top) || ra.left - rb.left;
  });
  flap.addEventListener("click", () => { if (workOpen) { if (BACKFLAP) goBack(); } else flip(); });
  flap.removeAttribute("aria-pressed");

  // ---------- 5. Work page (prototype) ----------
  // Click a work: it dips to 95% and springs back, then the view zooms into it: the card grows
  // to fill the page width while the others drift out, and the (for now empty) project page is
  // revealed underneath. V1 turns the title card's plus into a back arrow and pushes the toggle
  // card away; V2 grows the toggle card, pushes the title card away and swaps its icon for "‹".
  let workOpen = false, workBusy = false, workCard = null, savedY = 0, workAnim = 0;
  const page = document.querySelector(".work-page"), sheet = page.querySelector(".work-sheet");
  const sheetTitle = sheet.querySelector(".work-sheet-title");
  const EASE_Z = "cubic-bezier(.7, 0, .2, 1)";
  function tweenWork(to, dur) {
    const from = workE, t0 = performance.now(), id = ++workAnim;
    workDir = to > from ? 1 : -1;
    if (V3) dur *= 1.45;                                             // two beats: sweep, then spring back
    body.classList.add("has-work");
    return new Promise(res => {
      const step = now => {
        if (id !== workAnim) return res();
        const t = clamp((now - t0) / dur); workE = from + (to - from) * t; apply(lastC);
        if (t < 1) requestAnimationFrame(step);
        else { if (to === 0) body.classList.remove("has-work"); res(); }
      };
      requestAnimationFrame(step);
    });
  }
  // V1: the plus's two strokes become a back arrow without moving: the vertical stroke bends
  // into a 90° arrowhead, the horizontal one slides right and grows a little into the shaft
  const tv = toggle.querySelector(".tog-v"), th = toggle.querySelector(".tog-h");
  const PLUS = { v: [[18, 3], [18, 18], [18, 33]], h: [[3, 18], [18, 18], [33, 18]] };
  const ARROW = { v: [[23, 3], [8, 18], [23, 33]], h: [[8, 18], [24, 18], [40, 18]] };   // head as tall as the plus
  let morphId = 0;
  const SLOW = 1.11;                                                 // icon motions, 10% slower
  function morphToggle(toArrow, dur = 560 * SLOW) {
    const A = toArrow ? PLUS : ARROW, B = toArrow ? ARROW : PLUS, t0 = performance.now(), id = ++morphId;
    const pts = (k, t) => A[k].map((p, i) => [lerp(p[0], B[k][i][0], t), lerp(p[1], B[k][i][1], t)].map(n => n.toFixed(2)).join(",")).join(" ");
    const step = now => {
      if (id !== morphId) return;
      const t = ease(clamp((now - t0) / dur));
      tv.setAttribute("points", pts("v", t)); th.setAttribute("points", pts("h", t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    toggle.setAttribute("aria-label", toArrow ? "Back to all work" : "About Simon");
  }
  // V2: "‹" slides in from the right of the toggle card and knocks the mode icon rolling away
  const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 4.5 8 12l7.5 7.5"/></svg>';
  let backLayer = null;
  function flapToBack() {
    const mo = MODES[mode];
    flap.insertAdjacentHTML("beforeend", `<span class="flap-back"><span class="flap-word"><span class="ic"><span class="ic-old">${mo.icon}</span><span class="ic-new">${CHEV}</span></span><span class="flap-label">${mo.word}</span></span></span>`);
    backLayer = flap.lastElementChild; flap.classList.add("is-back");
    flap.setAttribute("aria-label", "Back to all work");
    const ic = backLayer.querySelector(".ic"), oldI = backLayer.querySelector(".ic-old"), newI = backLayer.querySelector(".ic-new");
    const word = backLayer.querySelector(".flap-word");
    const startX = (flap.getBoundingClientRect().width - word.offsetWidth) / 2 - m.pad;   // where the centred word sits now
    if (reduce) { oldI.style.opacity = 0; return; }
    // stays put while "‹" lands and the icon rolls off, then glides to the card's left edge
    if (V2) word.animate([{ transform: `translateX(${startX}px)` }, { transform: "translateX(0)" }],
                 { duration: 520 * SLOW, delay: 1150 * SLOW, easing: "cubic-bezier(.6, 0, .25, 1)", fill: "backwards" });
    const fr = flap.getBoundingClientRect(), ir = ic.getBoundingClientRect();
    const fromRight = (fr.right - ir.left) + 10, toLeft = (ir.right - fr.left) + 20, size = ir.width;
    newI.animate([{ transform: `translateX(${fromRight}px)` }, { transform: "translateX(0)" }],
                 { duration: 620 * SLOW, delay: 260 * SLOW, easing: "cubic-bezier(.3, .9, .35, 1.12)", fill: "backwards" });
    // contact a little before the arrow lands: the cube rolls off to the left
    const turns = -(toLeft / (Math.PI * size)) * 360;               // rolls like a wheel of its own size
    oldI.animate([{ transform: "translateX(0) rotate(0deg)", opacity: 1 },
                  { transform: `translateX(${-toLeft}px) rotate(${turns}deg)`, opacity: 1, offset: .85 },
                  { transform: `translateX(${-toLeft - size}px) rotate(${turns * 1.15}deg)`, opacity: 0 }],
                 { duration: 760 * SLOW, delay: 560 * SLOW, easing: "cubic-bezier(.2, .55, .3, 1)", fill: "both" });
  }
  function flapToMenu() {
    if (!backLayer) return Promise.resolve();
    const oldI = backLayer.querySelector(".ic-old"), newI = backLayer.querySelector(".ic-new"), ic = backLayer.querySelector(".ic");
    oldI.getAnimations().forEach(a => a.cancel());
    // the word heads back to the middle of the card it is about to become
    const word = backLayer.querySelector(".flap-word");
    const menuW = lerp(m.flapW, m.flapW / 2, ease(lastC)), endX = (menuW - word.offsetWidth) / 2 - m.pad;
    if (V2) word.animate([{ transform: "translateX(0)" }, { transform: `translateX(${endX}px)` }],
                 { duration: 640, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "forwards" });
    const fr = flap.getBoundingClientRect(), ir = ic.getBoundingClientRect(), size = ir.width;
    const toLeft = (ir.right - fr.left) + 20, turns = (toLeft / (Math.PI * size)) * 360;
    const a1 = newI.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 * SLOW, easing: "ease-out", fill: "forwards" });
    const a2 = oldI.animate([{ transform: `translateX(${-toLeft - size}px) rotate(${-turns}deg)`, opacity: 0 },
                             { transform: `translateX(${-toLeft}px) rotate(${-turns * .85}deg)`, opacity: 1, offset: .15 },
                             { transform: "translateX(0) rotate(0deg)", opacity: 1 }],
                            { duration: 700 * SLOW, delay: 120 * SLOW, easing: "cubic-bezier(.2, .6, .3, 1)", fill: "both" });
    return Promise.all([a1.finished, a2.finished]).then(() => {
      backLayer.remove(); backLayer = null; flap.classList.remove("is-back");
      flap.setAttribute("aria-label", `Showing ${MODES[mode].word.toLowerCase()}. Flip to show ${MODES[(mode + 1) % 3].word.toLowerCase()}`);
    });
  }
  const rectOf = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
  const box = r => ({ left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  function zoomLayer(card, r) {
    const f = card.querySelector(".face--front"), panel = f.querySelector(`.panel--${f.dataset.show}`);
    const fig = panel.querySelector(".work-cover"), cs = getComputedStyle(fig);
    const z = document.createElement("div"); z.className = "work-zoom";
    z.style.background = getComputedStyle(panel).backgroundColor;
    const clone = fig.cloneNode(true);
    clone.style.background = cs.backgroundColor; clone.style.mixBlendMode = cs.mixBlendMode;
    clone.style.inset = getComputedStyle(fig).inset || "";
    const lit = card.classList.contains("is-open") || card.classList.contains("is-lit");
    clone.querySelector(".cover-sketch").style.opacity = lit ? 0 : 1;
    clone.querySelector(".cover-marker").style.opacity = lit ? 1 : 0;
    z.appendChild(clone); Object.assign(z.style, box(r)); document.body.appendChild(z);
    window.__smooth?.(z);
    return { z, clone, bg: z.style.background, panel };
  }
  function openWork(card) {
    if (workOpen || workBusy) return;
    workBusy = true; workOpen = true; workCard = card; savedY = scrollY;
    if (open) setOpen(false);
    clearTimeout(closeTimer); pending = null;
    const inner = card.querySelector(".work-card-inner");
    const press = reduce ? null : inner.animate([{ transform: "scale(1)" }, { transform: "scale(.95)" }],
      { duration: 200, easing: "cubic-bezier(.4, 0, .6, 1)", fill: "forwards" });
    (press ? press.finished : Promise.resolve()).then(() => {
      // start the zoom from the pressed-in (95%) card, so it springs straight out to the page
      const rc = rectOf(card), k = press ? .95 : 1;
      const r0 = { left: rc.left + rc.width * (1 - k) / 2, top: rc.top + rc.height * (1 - k) / 2, width: rc.width * k, height: rc.height * k };
      const { z, clone, bg, panel } = zoomLayer(card, r0);
      const ink = getComputedStyle(panel).color;
      card.style.visibility = "hidden";
      // where the project page sits once the page is back at the top
      const g = grid.getBoundingClientRect(), topAt0 = g.top + scrollY;
      const r1 = { left: g.left, top: topAt0, width: g.width, height: Math.max(innerHeight - topAt0 + 40, 200) };
      if (scrollY > 0) scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      const D = reduce ? 1 : 720;
      cards.forEach(el => { if (el !== card) el.animate(
        [{ opacity: 1 }, { opacity: 0 }], { duration: D * .6, easing: "ease-in", fill: "forwards" }); });
      grid.animate([{ transform: "scale(1)" }, { transform: "scale(1.04)" }], { duration: D, easing: EASE_Z, fill: "forwards" });
      z.animate([{ ...box(r0), borderRadius: getComputedStyle(card).borderRadius }, { ...box(r1) }], { duration: D, easing: EASE_Z, fill: "forwards" });
      clone.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.35)", opacity: 0 }], { duration: D, easing: "cubic-bezier(.5, 0, .9, .5)", fill: "forwards" });
      tweenWork(1, D);
      if (BACKFLAP) flapToBack(); else morphToggle(true);
      body.classList.add("is-work");
      setTimeout(() => {
        sheet.style.setProperty("--sheet-bg", bg); sheet.style.setProperty("--sheet-ink", ink);
        const alt = card.querySelector(`.face--front .panel--${targetPanel} .cover-sketch`)?.alt || "";
        sheetTitle.textContent = alt.split(",")[0] + " — project page";
        grid.hidden = true; page.hidden = false;
        grid.getAnimations().forEach(a => a.cancel());
        cards.forEach(el => el.getAnimations().forEach(a => { if (a.effect && a.effect.getKeyframes().some(k => "opacity" in k)) a.cancel(); }));
        card.style.visibility = ""; press?.cancel();
        requestAnimationFrame(() => { z.remove(); workBusy = false; });
      }, D + 20);
    });
  }
  function goBack() {
    if (!workOpen || workBusy) return;
    workBusy = true;
    const card = workCard, sr = sheet.getBoundingClientRect();
    const r1 = { left: sr.left, top: sr.top, width: sr.width, height: Math.min(sr.height, innerHeight - sr.top + 40) };
    // back to the grid, where it was
    page.hidden = true; grid.hidden = false; body.classList.remove("is-work");
    active = -1; layoutGrid(false);
    scrollTo({ top: savedY, behavior: "instant" });
    collapse();
    const r0 = rectOf(card);
    const { z, clone } = zoomLayer(card, r1);
    card.style.visibility = "hidden";
    const D = reduce ? 1 : 640;
    cards.forEach(el => { if (el !== card) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D * .8, delay: D * .2, easing: "ease-out", fill: "backwards" }); });
    grid.animate([{ transform: "scale(1.04)" }, { transform: "scale(1)" }], { duration: D, easing: EASE_Z });
    z.animate([{ ...box(r1) }, { ...box(r0), borderRadius: getComputedStyle(card).borderRadius }], { duration: D, easing: EASE_Z, fill: "forwards" });
    clone.animate([{ transform: "scale(1.35)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: D, easing: "cubic-bezier(.1, .5, .5, 1)", fill: "forwards" });
    tweenWork(0, D);
    if (BACKFLAP) flapToMenu(); else morphToggle(false);
    setTimeout(() => {
      card.style.visibility = ""; z.remove();
      workOpen = false; workBusy = false; workCard = null;
    }, D + 20);
  }
  grid.addEventListener("click", e => {
    if (workOpen || framesMode()) return;
    const card = e.target.closest(".work-card");
    if (card && hasWork(card)) openWork(card);
  });
  grid.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && !workOpen && !framesMode()) {
      const card = e.target.closest(".work-card"); if (card && hasWork(card)) { e.preventDefault(); openWork(card); }
    }
  });
  addEventListener("keydown", e => { if (e.key === "Escape" && workOpen) goBack(); });

  // ---------- 6. Continuous corners ----------
  // Smoothed rounded rectangles (the corner curve eases into the straight edge, like iOS), drawn
  // as a clip path for each card at its current size. Corner maths after Figma's corner
  // smoothing (radius r, smoothing s): the curve begins (1 + s)·r from the corner.
  const SQ_R = 16, SQ_S = 0.6;
  function squirclePath(w, h, r = SQ_R, s = SQ_S) {
    const maxP = Math.min(w, h) / 2;
    r = Math.min(r, maxP);
    let p = (1 + s) * r;
    if (p > maxP) { s = Math.max(0, maxP / r - 1); p = maxP; }
    const rad = d => d * Math.PI / 180;
    const alpha = 45 * s, beta = 90 * (1 - s);
    const arc = Math.sin(rad(beta / 2)) * r * Math.SQRT2;
    const c = r * Math.tan(rad((90 - beta) / 4)) * Math.cos(rad(alpha));
    const d = c * Math.tan(rad(alpha));
    const b = (p - arc - c - d) / 3, a = 2 * b;
    const f = n => +n.toFixed(2);
    return `M${f(w - p)} 0` +
      `c${f(a)} 0 ${f(a + b)} 0 ${f(a + b + c)} ${f(d)}a${f(r)} ${f(r)} 0 0 1 ${f(arc)} ${f(arc)}c${f(d)} ${f(c)} ${f(d)} ${f(b + c)} ${f(d)} ${f(a + b + c)}` +
      `L${f(w)} ${f(h - p)}` +
      `c0 ${f(a)} 0 ${f(a + b)} ${f(-d)} ${f(a + b + c)}a${f(r)} ${f(r)} 0 0 1 ${f(-arc)} ${f(arc)}c${f(-c)} ${f(d)} ${f(-(b + c))} ${f(d)} ${f(-(a + b + c))} ${f(d)}` +
      `L${f(p)} ${f(h)}` +
      `c${f(-a)} 0 ${f(-(a + b))} 0 ${f(-(a + b + c))} ${f(-d)}a${f(r)} ${f(r)} 0 0 1 ${f(-arc)} ${f(-arc)}c${f(-d)} ${f(-c)} ${f(-d)} ${f(-(b + c))} ${f(-d)} ${f(-(a + b + c))}` +
      `L0 ${f(p)}` +
      `c0 ${f(-a)} 0 ${f(-(a + b))} ${f(d)} ${f(-(a + b + c))}a${f(r)} ${f(r)} 0 0 1 ${f(arc)} ${f(-arc)}c${f(c)} ${f(-d)} ${f(b + c)} ${f(-d)} ${f(a + b + c)} ${f(-d)}Z`;
  }
  const sqRO = new ResizeObserver(entries => {
    for (const e of entries) {
      const el = e.target, w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) continue;
      el.style.clipPath = `path("${squirclePath(w, h)}")`;
    }
  });
  const smooth = el => { sqRO.observe(el); };
  root.classList.add("sq");
  [hero, flap, sheet, ...cards].forEach(smooth);
  window.__smooth = smooth;                                         // the zoom layers join as they are made
  // the top corners of the window the page scrolls under: the same curve, cut out of the bar
  {
    const P = (1 + SQ_S) * SQ_R, big = P * 4;
    const d = squirclePath(big, big);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${P}" height="${P}" viewBox="0 0 ${P} ${P}"><path fill-rule="evenodd" fill="#000" d="M0 0H${P}V${P}H0Z${d}"/></svg>`;
    bar.style.setProperty("--sq-corner", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    bar.style.setProperty("--sq-p", P + "px");
  }

  // ---------- start ----------
  const start = () => { measure(); active = -1; pos = []; layoutGrid(false); };
  addEventListener("resize", () => { measure(); layoutGrid(false); });
  let lastW = 0;
  // re-measure on the next frame, not inside the observer (changing layout there loops)
  new ResizeObserver(() => requestAnimationFrame(() => {
    if (grid.hidden) return;
    if (grid.clientWidth !== lastW) { lastW = grid.clientWidth; measure(); layoutGrid(false); }
  })).observe(grid);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
  start();

  if (document.querySelector(".intro")) document.addEventListener("intro:done", dock, { once: true });
  else { body.classList.add("is-home", "is-docked"); document.querySelector(".name-stage")?.remove(); }
})();
