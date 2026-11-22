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

  let m = {};   // measurements
  function measure() {
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
      h0: Math.min(420, Math.max(260, innerHeight * 0.42)),
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
  function collapse() {
    if (!m.h0) return;
    const c = clamp(scrollY / (m.h0 - m.hMin));
    hero.style.setProperty("--hero-h", lerp(m.h0, m.hMin, c) + "px");
    const a = ease(clamp(c / 0.75));                 // shorten + shrink
    const b = ease(clamp((c - 0.7) / 0.3));          // D → mark
    clip.style.width = lerp(m.fullW, m.dW, a) + "px";
    block.style.transform = `scale(${lerp(1, m.sMin, a)})`;
    name.style.opacity = 1 - b;
    mark.style.opacity = b;
  }
  addEventListener("scroll", collapse, { passive: true });

  // ---------- 1. dock after the zipper ----------
  function dock() {
    // One element only: the name that lives in the card. It starts exactly over the big
    // centred name, scaled up, and settles to its own size, so nothing is swapped mid-flight.
    const stage = document.querySelector(".name-stage");
    const first = stageName.getBoundingClientRect();
    body.classList.add("is-home", "is-docked", "is-flying");   // card stops clipping while it moves
    stage.remove();
    collapse();
    const last = name.getBoundingClientRect();
    if (reduce) return body.classList.remove("is-flying");
    const s = first.width / last.width;
    name.animate(
      [{ transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${s})` },
       { transform: "translate(0px, 0px) scale(1)" }],
      { duration: 1100, easing: "cubic-bezier(.65, 0, .35, 1)" }
    ).finished.then(() => body.classList.remove("is-flying"));
  }

  // ---------- 3. grid ----------
  const grid = document.querySelector(".work-grid");
  const cards = [...grid.querySelectorAll(".work-card")];
  let active = -1, anchors = [];

  function layoutGrid(animate = true) {
    const gap = parseFloat(getComputedStyle(root).getPropertyValue("--card-gap")) || 12;
    const W = grid.clientWidth;
    const cols = W >= 720 ? 3 : 2;
    const cw = (W - gap * (cols - 1)) / cols, ch = cw * 0.72;
    const occ = [];                                   // occupied cells, occ[row][col]
    const free = (r, c, n) => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (c + j >= cols || (occ[r + i] && occ[r + i][c + j])) return false; return true; };
    const take = (r, c, n) => { for (let i = 0; i < n; i++) { occ[r + i] ||= []; for (let j = 0; j < n; j++) occ[r + i][c + j] = true; } };
    const pos = [];
    // the hovered card grows from its own cell (shifted left if it's in the last column)
    if (active >= 0) {
      const a = anchors[active] || { r: Math.floor(active / cols), c: active % cols };
      const c = Math.min(a.c, cols - 2), r = a.r;
      take(r, c, 2); pos[active] = { r, c, n: 2 };
    }
    cards.forEach((_, i) => {
      if (i === active) return;
      for (let r = 0; ; r++) { let placed = false;
        for (let c = 0; c < cols; c++) if (free(r, c, 1)) { take(r, c, 1); pos[i] = { r, c, n: 1 }; placed = true; break; }
        if (placed) break; }
    });
    if (active < 0) anchors = pos.map(p => ({ r: p.r, c: p.c }));
    grid.classList.toggle("no-anim", !animate);
    let rows = 0;
    cards.forEach((el, i) => {
      const { r, c, n } = pos[i];
      rows = Math.max(rows, r + n);
      el.style.transform = `translate(${c * (cw + gap)}px, ${r * (ch + gap)}px)`;
      el.style.width = n * cw + (n - 1) * gap + "px";
      el.style.height = n * ch + (n - 1) * gap + "px";
      el.classList.toggle("is-open", i === active);
    });
    grid.style.height = rows * ch + (rows - 1) * gap + "px";
    if (!animate) requestAnimationFrame(() => grid.classList.remove("no-anim"));
  }
  const setActive = i => { if (i === active) return; active = i; layoutGrid(); };
  cards.forEach((el, i) => {
    el.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") setActive(i); });
    el.addEventListener("click", () => setActive(active === i ? -1 : i));   // touch: tap to open/close
  });
  grid.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") setActive(-1); });

  // decode every cover image up front so the first hover never waits on (or flashes) an image
  grid.querySelectorAll(".cover img").forEach(img => { img.loading = "eager"; img.decode?.().catch(() => {}); });

  // ---------- start ----------
  const start = () => { measure(); active = -1; layoutGrid(false); };
  addEventListener("resize", () => { measure(); layoutGrid(false); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
  start();

  if (document.querySelector(".intro")) document.addEventListener("intro:done", dock, { once: true });
  else { body.classList.add("is-home", "is-docked"); document.querySelector(".name-stage")?.remove(); }
})();
