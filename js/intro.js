/* Zipper intro.
   The logo, turned vertical, is the zipper pull; pull and rails share one colour (--zip).
   Geometry comes from Web_Dev_Sketch_1/2.svg: two rails as wide as the wave, with the
   wave's ends cut flat to the rail width so rail → pull → rail joins without a seam.
   Scroll, drag or swipe down to unzip; past 70% it finishes by itself. Left partway
   and idle for 2 s, it slides back to the top. Plays on every visit. */
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COVER = css("--zip-cover") || css("--paper") || "#fefefe", ZIP = css("--zip") || "#1b1b1b";

  // Pull geometry in sketch units: left rail x 0–27.94, gap, right rail x 41.62–69.56, height 92.73
  const PW = 69.56, PH = 92.733, RAIL = 27.937, CL = 13.97, CR = 55.59;
  const WAVE = "M27.9 0C4.84 32.249 50.96 60.485 27.9 92.734L0 92.734C23.064 60.485 -23.056 32.249 0 0Z";

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "intro");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Scroll or drag the zipper down to enter");
  svg.innerHTML = `
    <defs>
      <mask id="zipMask" maskUnits="userSpaceOnUse">
        <rect class="m-all" x="0" y="0" fill="#fff"/>
        <path class="m-hole" fill="#000"/>
      </mask>
    </defs>
    <rect class="cover" x="0" y="0" fill="${COVER}" mask="url(#zipMask)"/>
    <g fill="none" stroke="${ZIP}" stroke-linecap="butt" stroke-linejoin="round">
      <path class="rail rail-l"/>
      <path class="rail rail-r"/>
    </g>
    <g class="pull">
      <rect class="hit" fill="transparent"/>
      <path class="wave" fill="${ZIP}" d="${WAVE}"/>
    </g>`;
  document.body.prepend(svg);
  document.body.classList.add("intro-active");

  const q = s => svg.querySelector(s);
  const cover = q(".cover"), all = q(".m-all"), hole = q(".m-hole"),
        railL = q(".rail-l"), railR = q(".rail-r"), wave = q(".wave"), hit = q(".hit");

  let W, H, cx, S, k, ox, w, xL, xR;
  function layout() {
    W = innerWidth; H = innerHeight; cx = W / 2;
    S = Math.round(Math.min(64, Math.max(40, H * 0.06)));   // pull height, px
    k = S / PH; ox = cx - (PW * k) / 2;
    w = RAIL * k; xL = ox + CL * k; xR = ox + CR * k;
    for (const r of [cover, all]) { r.setAttribute("width", W); r.setAttribute("height", H); }
    railL.setAttribute("stroke-width", w); railR.setAttribute("stroke-width", w);
    hit.setAttribute("x", ox - 24); hit.setAttribute("y", -12);
    hit.setAttribute("width", PW * k + 48); hit.setAttribute("height", S + 24);
  }

  const easeOut = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

  let p = 0, target = 0, extra = 0, finishing = false, touched = false, dragging = false;
  let lastInput = 0, hintStart = performance.now();

  function draw() {
    const top = p * (H - S), bot = top + S;
    const open = top > 0.5;
    const yEnd = -0.0105 * H;                                   // curves run just above the top edge (sketch 2)
    const lift = Math.max(8, top);
    const spread = Math.min(cx * easeOut(p / 0.5), lift * 1.1 + 4) + extra * W;
    const xeL = xL - spread, xeR = xR + spread;
    // leaves the pull exactly vertical, then sweeps out to the top corner (sketch 2)
    const c1y = top - (top - yEnd) * 0.3;
    const curve = (x0, xe) => `C${x0} ${c1y} ${x0} ${yEnd} ${xe} ${yEnd}`;
    const seam = 0.75;                                          // rails tuck under the pull by <1px: no hairline

    hole.setAttribute("d", open
      ? `M${xL} ${top} ${curve(xL, xeL)} L${xeR} ${yEnd} C${xR} ${yEnd} ${xR} ${c1y} ${xR} ${top} Z`
      : "");
    // left rail: curve above the pull, the wave (filled) through it, straight below
    railL.setAttribute("d", (open ? `M${xL} ${top + seam} L${xL} ${top} ${curve(xL, xeL)} ` : "") +
                            `M${xL} ${bot - seam} L${xL} ${H + 2}`);
    // right rail: one unbroken stroke, since the logo's bar is the rail itself
    railR.setAttribute("d", `M${xR} ${H + 2} L${xR} ${open ? top : -2}` + (open ? ` ${curve(xR, xeR)}` : ""));
    wave.setAttribute("transform", `translate(${ox} ${top}) scale(${k})`);
    hit.setAttribute("transform", `translate(0 ${top})`);
  }

  // Idle hint: the pull tugs itself down a little every 2.6 s until touched
  function hint(now) {
    if (touched || finishing) return 0;
    const t = ((now - hintStart) / 2600) % 1;
    return t < 0.35 ? 0.07 * Math.sin((t / 0.35) * Math.PI) : 0;
  }

  let loaded = document.readyState === "complete";
  addEventListener("load", () => { loaded = true; });

  function tick(now) {
    // left partway and idle for 2 s → slide back to the top
    if (touched && !finishing && !dragging && target > 0 && now - lastInput > 2000) target = 0;
    if (touched && !finishing && target === 0 && p < 0.003) { touched = false; hintStart = now; }

    const goal = Math.max(target, hint(now));
    const returning = touched && target === 0;
    p += (goal - p) * (finishing ? 0.12 : returning ? 0.06 : 0.18);
    if (finishing) extra += (0.9 - extra) * 0.08;
    draw();
    if (!finishing && target >= 1 && p > 0.985 && loaded) finish();
    if (!svg.isConnected) return;
    requestAnimationFrame(tick);
  }

  function setTarget(v) { touched = true; lastInput = performance.now(); target = Math.min(1, Math.max(0, v)); }
  function release() { if (target > 0.7) target = 1; }
  function finish() {
    finishing = true;
    scrollTo(0, 0);
    svg.classList.add("is-done");                                // zipper clears (0.35 s), the big name stays
    document.dispatchEvent(new CustomEvent("intro:done"));       // page takes over: name docks, cards ripple in
    setTimeout(() => { svg.remove(); document.body.classList.remove("intro-active"); }, 450);
  }

  let wheelTimer;
  addEventListener("wheel", e => {
    if (finishing || !svg.isConnected) return;
    setTarget(target + e.deltaY / (H * 1.4));
    clearTimeout(wheelTimer); wheelTimer = setTimeout(release, 220);
  }, { passive: true });

  let startY = 0, startT = 0;
  svg.addEventListener("pointerdown", e => {
    if (finishing) return;
    dragging = true; startY = e.clientY; startT = target;
    svg.classList.add("dragging"); svg.setPointerCapture(e.pointerId); lastInput = performance.now();
  });
  svg.addEventListener("pointermove", e => { if (dragging) setTarget(startT + (e.clientY - startY) / (H - S)); });
  const up = () => { if (!dragging) return; dragging = false; svg.classList.remove("dragging"); lastInput = performance.now(); release(); };
  svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
  addEventListener("keydown", e => {
    if (!svg.isConnected || finishing) return;
    if (["ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { setTarget(target + (e.key === "Enter" ? 1 : 0.12)); release(); }
  });

  addEventListener("resize", () => { if (svg.isConnected) { layout(); draw(); } });
  layout(); draw(); requestAnimationFrame(tick);
})();
