/* Home page behaviour
   1. Dock: when the zipper finishes, the centred DEJAVUSIMON shrinks smoothly into the
      title card's top-left corner, with equal space above and to the left of the letters.
   2. Collapse: scrolling down shrinks the title card; the word shortens right-to-left
      (the D stays put) and turns into the logo mark.
   3. Grid: 12 equal cards (3 × 4); hovering one grows it to 2 × 2 and the others reflow. */
(() => {
  const root = document.documentElement, body = document.body;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    const g = document.querySelector(".work-grid");
    const gap = parseFloat(getComputedStyle(root).getPropertyValue("--card-gap")) || 12;
    const W = g.clientWidth;
    return W >= 720 ? (W - gap * 2) / 3 : (W - gap) * 0.4;   // = one work card on desktop
  }
  function cardHeight() {
    const g = document.querySelector(".work-grid");
    const gap = parseFloat(getComputedStyle(root).getPropertyValue("--card-gap")) || 12;
    const W = g.clientWidth, cols = W >= 720 ? 3 : 2;
    return Math.round(Math.max(150, ((W - gap * (cols - 1)) / cols) * 0.72));
  }
  // the tallest the title card's content needs: padding + name + gap + intro text
  function heroContent() {
    const pad = parseFloat(getComputedStyle(hero).paddingTop);
    const cap = parseFloat(getComputedStyle(name).fontSize) * 0.72;
    return pad * 2 + cap + 16 + intro.offsetHeight;
  }
  function measure() {
    // the top row is exactly as wide as the grid below, so the flap's edge always lines up
    bar.style.maxWidth = "none";
    bar.style.width = document.querySelector(".work-grid").clientWidth + "px";
    // on narrow screens the name shrinks until the whole word fits inside the title card
    name.style.fontSize = "";
    {
      const gap = parseFloat(getComputedStyle(root).getPropertyValue("--card-gap")) || 12;
      const padX = parseFloat(getComputedStyle(hero).paddingLeft);
      const avail = document.querySelector(".work-grid").clientWidth - flapWidth() - gap - padX * 2;
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
      h0: Math.round(Math.max(cardHeight() * 0.7, heroContent())),  // title row: 70% of a work card
      flapW: flapWidth(),
      sMin: 0.72,
    };
    m.hMin = Math.round(pad * 2 + cap * m.sMin);
    // the mark: same height as the capitals, its left edge on the D's left edge
    mark.style.height = cap + "px";
    mark.style.width = cap * (168.425 / 138.422) + "px";
    root.style.setProperty("--hero-h0", m.h0 + "px");
    collapse();
  }

  // ---------- 2. collapse on scroll ----------
  // The title card shrinks exactly as fast as the page scrolls, so the cards below always
  // ride up with it. When scrolling stops partway, the page itself glides on: past 50% to the
  // slim logo bar, under 50% back to the full card. Nothing rests half-collapsed.
  function apply(c) {
    bar.style.setProperty("--hero-h", lerp(m.h0, m.hMin, c) + "px");
    bar.style.setProperty("--flap-w", lerp(m.flapW, m.flapW / 2, ease(c)) + "px");
    bar.style.setProperty("--c", c.toFixed(3));
    const a = ease(clamp(c / 0.75));                 // shorten + shrink
    const b = ease(clamp((c - 0.7) / 0.3));          // D → mark
    clip.style.width = lerp(m.fullW, m.dW, a) + "px";
    block.style.transform = `scale(${lerp(1, m.sMin, a)})`;
    name.style.opacity = 1 - b;
    mark.style.opacity = b;
    intro.style.opacity = clamp(1 - c * 3) * 0.78;
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
  const POP = "cubic-bezier(.2, .8, .25, 1)";
  function reveal() {
    if (reduce) return;
    const rise = (el, delay, dur = 520, opts = {}) => el.animate(
      [{ opacity: 0, transform: "translateY(18px) scale(.94)" }, { opacity: 1, transform: "none" }],
      { duration: dur, delay, easing: POP, fill: "backwards", ...opts });
    const anims = [
      rise(hero, 750, 520, { pseudoElement: "::before" }),
      intro.animate([{ opacity: 0 }, { opacity: getComputedStyle(intro).opacity }],
                    { duration: 450, delay: 1000, easing: "ease-out", fill: "backwards" }),
      rise(flap, 850),
    ];
    // work cards: one wave per diagonal, measured from the title card in the top-left
    const maxD = Math.max(...pos.map(q => q.r + q.c)) || 1;
    cards.forEach((el, i) => {
      const d = pos[i].r + pos[i].c;
      anims.push(rise(el.querySelector(".work-card-inner"), 950 + d * (550 / maxD), 480));
    });
    return Promise.all(anims.map(a => a.finished.catch(() => {})));
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
    if (reduce) { body.classList.remove("is-flying", "is-revealing"); return; }
    const s = first.width / last.width;
    name.animate(
      [{ transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${s})` },
       { transform: "translate(0px, 0px) scale(1)" }],
      { duration: 800, delay: 400, easing: "cubic-bezier(.65, 0, .35, 1)", fill: "backwards" }
    ).finished.then(() => body.classList.remove("is-flying"));
    shown.then(() => body.classList.remove("is-revealing"));
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
    cols = W >= 720 ? 3 : 2;
    const frames = body.classList.contains("is-frames");
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
    if (!pointer || framesMode() || !canHover.matches || body.classList.contains("is-revealing") || body.classList.contains("intro-active")) return;
    const overBar = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest(".topbar");
    const i = overBar ? null : cardAt(pointer);
    clearTimeout(closeTimer);
    if (i !== null) setActive(i);
    else if (active >= 0) closeTimer = setTimeout(() => setActive(-1), 90);
  }
  document.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    pointer = { clientX: e.clientX, clientY: e.clientY }; track();
  }, { passive: true });
  addEventListener("scroll", () => requestAnimationFrame(track), { passive: true });
  const release = () => { pointer = null; clearTimeout(closeTimer); setActive(-1); };
  document.documentElement.addEventListener("pointerleave", release);
  addEventListener("blur", release);
  // touchscreens: cards never expand (no hover there, and tapping should open the project later)

  // decode every cover image up front so the first hover never waits on (or flashes) an image
  grid.querySelectorAll(".work-cover img, .frame-photo").forEach(img => { img.loading = "eager"; img.decode?.().catch(() => {}); });

  // ---------- 4. Objects / Interfaces / Frames toggle ----------
  // A split-flap tile cycles three sides. Each flip drops the tile's top leaf and tips every
  // work card over top-to-bottom; the card's hidden face is loaded with the next side first.
  const ICON = {
    cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8 20.5 7.5v9L12 21.2 3.5 16.5v-9Z"/><path d="M3.5 7.5 12 12.2l8.5-4.7M12 12.2v9"/></svg>',
    cursor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 3.5 19 11l-6.2 1.6L9.6 18.8Z"/><path d="m12.8 12.6 4.6 6.4"/></svg>',
    frame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.5 8V4.5h3.5M17 4.5h3.5V8M20.5 16v3.5H17M7 19.5H3.5V16"/><circle cx="12" cy="12" r="2.6"/></svg>',
  };
  const MODES = [
    { key: "physical", panel: "objects", word: "Objects", icon: ICON.cube },
    { key: "digital", panel: "interfaces", word: "Interfaces", icon: ICON.cursor },
    { key: "frames", panel: "frames", word: "Frames", icon: ICON.frame },
  ];
  const flap = document.querySelector(".flap");
  const face = mo => `<span class="flap-content"><span class="flap-word">${mo.icon}<span class="flap-label">${mo.word}</span></span></span>`;
  let mode = 0, flips = 0, flipping = false;
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
    // cards: load the hidden face with the next side, then tip every card over
    const hidden = flips % 2 === 0 ? ".face--back" : ".face--front";
    cards.forEach(el => { el.querySelector(hidden).dataset.show = MODES[next].panel; });
    flips++;
    grid.classList.add("is-flipping");
    cardOrder().forEach((el, k) => {
      const inner = el.querySelector(".work-card-inner");
      inner.style.transitionDelay = (reduce ? 0 : k * 55) + "ms";
      inner.style.transform = `rotateX(${-180 * flips}deg)`;
    });
    setPageMode(next);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => settleCards(MODES[next].panel), (reduce ? 0 : cards.length * 55) + 850);
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
  let settleTimer;
  function settleCards(panel) {
    if (flipping) return (settleTimer = setTimeout(() => settleCards(panel), 100));
    cards.forEach(el => {
      const inner = el.querySelector(".work-card-inner");
      inner.style.transition = "none"; inner.style.transitionDelay = "0ms"; inner.style.transform = "none";
      el.querySelector(".face--front").dataset.show = panel;
      el.querySelector(".face--back").dataset.show = panel;
    });
    flips = 0;
    grid.classList.remove("is-flipping");
    void grid.offsetHeight;                                           // commit before restoring transitions
    cards.forEach(el => { el.querySelector(".work-card-inner").style.transition = ""; });
  }
  // cards flip in reading order: top-left first, across then down
  const cardOrder = () => [...cards].sort((a, b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return Math.round(ra.top - rb.top) || ra.left - rb.left;
  });
  flap.addEventListener("click", flip);
  flap.removeAttribute("aria-pressed");

  // ---------- start ----------
  const start = () => { measure(); active = -1; pos = []; layoutGrid(false); };
  addEventListener("resize", () => { measure(); layoutGrid(false); });
  let lastW = 0;
  // re-measure on the next frame, not inside the observer (changing layout there loops)
  new ResizeObserver(() => requestAnimationFrame(() => {
    if (grid.clientWidth !== lastW) { lastW = grid.clientWidth; measure(); layoutGrid(false); }
  })).observe(grid);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
  start();

  if (document.querySelector(".intro")) document.addEventListener("intro:done", dock, { once: true });
  else { body.classList.add("is-home", "is-docked"); document.querySelector(".name-stage")?.remove(); }
})();
