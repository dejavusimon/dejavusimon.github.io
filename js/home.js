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
  // The title card shrinks exactly as fast as the page scrolls, so the cards below always
  // ride up with it. When scrolling stops partway, the page itself glides on: past 50% to the
  // slim logo bar, under 50% back to the full card. Nothing rests half-collapsed.
  function apply(c) {
    hero.style.setProperty("--hero-h", lerp(m.h0, m.hMin, c) + "px");
    const a = ease(clamp(c / 0.75));                 // shorten + shrink
    const b = ease(clamp((c - 0.7) / 0.3));          // D → mark
    clip.style.width = lerp(m.fullW, m.dW, a) + "px";
    block.style.transform = `scale(${lerp(1, m.sMin, a)})`;
    name.style.opacity = 1 - b;
    mark.style.opacity = b;
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
  // Which card is hovered is worked out from the settled layout (not from what's under the
  // pointer mid-animation), and a card grows from the cell it sits in now, so it never jumps
  // away from the cursor and two cards can't keep trading places.
  const grid = document.querySelector(".work-grid");
  const cards = [...grid.querySelectorAll(".work-card")];
  let active = -1, slots = [], pos = [], cols = 3;

  function layoutGrid(animate = true, anchor) {
    const gap = parseFloat(getComputedStyle(root).getPropertyValue("--card-gap")) || 12;
    const W = grid.clientWidth;
    cols = W >= 720 ? 3 : 2;
    const cw = (W - gap * (cols - 1)) / cols, ch = cw * 0.72;
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
  grid.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const i = cardAt(e);
    if (i !== null) setActive(i);
  });
  grid.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") setActive(-1); });
  let lastType = "mouse";
  grid.addEventListener("pointerdown", e => { lastType = e.pointerType; });
  grid.addEventListener("click", e => {                              // touch: tap to open / close
    if (lastType === "mouse") return;
    const i = cardAt(e); if (i !== null) setActive(active === i ? -1 : i);
  });

  // decode every cover image up front so the first hover never waits on (or flashes) an image
  grid.querySelectorAll(".work-cover img").forEach(img => { img.loading = "eager"; img.decode?.().catch(() => {}); });

  // ---------- start ----------
  const start = () => { measure(); active = -1; pos = []; layoutGrid(false); };
  addEventListener("resize", () => { measure(); layoutGrid(false); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
  start();

  if (document.querySelector(".intro")) document.addEventListener("intro:done", dock, { once: true });
  else { body.classList.add("is-home", "is-docked"); document.querySelector(".name-stage")?.remove(); }
})();
