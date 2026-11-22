/* Zipper intro.
   The logo, turned vertical, is the zipper pull. Scroll, drag or swipe down to
   unzip; past 70% it finishes by itself. Left halfway and idle for 2 s, it
   slides back to the top. Plays on every visit. */
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const INK = css("--ink") || "#111", ZIP = css("--paper") || "#fff";

  // Logo turned vertical, in its own units (557 wide x 697 tall): wave on the left, bar on the right
  const LW = 557, LH = 697, WAVE = [46, 242], BAR = [340, 557];
  const LOGO = `<path d="M0 47 C50 81 100 93 152 93 C262 93 404 0 545 0 C600 0 650 15 697 46 L697 241 C650 210 600 195 545 195 C404 195 262 288 152 288 C100 288 50 276 0 242 Z"/><rect x="0" y="340" width="697" height="217"/>`;

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
      <linearGradient id="zipGap" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${INK}" stop-opacity="0" class="gap-top"/>
        <stop offset="1" stop-color="${INK}" stop-opacity="1"/>
      </linearGradient>
      <filter id="zipShadow" x="-60%" y="-30%" width="220%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity=".45"/>
        <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".22"/>
      </filter>
    </defs>
    <rect class="cover" x="0" y="0" fill="${INK}" mask="url(#zipMask)"/>
    <rect class="gap" fill="url(#zipGap)"/>
    <path class="rail rail-l" fill="none" stroke="${ZIP}"/>
    <path class="rail rail-r" fill="none" stroke="${ZIP}"/>
    <g class="pull">
      <rect class="hit" fill="transparent"/>
      <g class="logo" fill="${ZIP}" filter="url(#zipShadow)">${LOGO}</g>
    </g>`;
  document.body.prepend(svg);
  document.body.classList.add("intro-active");

  const q = s => svg.querySelector(s);
  const cover = q(".cover"), all = q(".m-all"), hole = q(".m-hole"), gap = q(".gap"), gapTop = q(".gap-top"),
        railL = q(".rail-l"), railR = q(".rail-r"), logo = q(".logo"), hit = q(".hit");

  let W, H, cx, S, k, ox, wL, wR, xL, xR;
  function layout() {
    W = innerWidth; H = innerHeight; cx = W / 2;
    S = Math.round(Math.min(64, Math.max(40, H * 0.07)));    // pull height, px
    k = S / LH; ox = cx - (LW * k) / 2;
    wL = (WAVE[1] - WAVE[0]) * k; wR = (BAR[1] - BAR[0]) * k;
    xL = ox + (WAVE[0] + WAVE[1]) / 2 * k; xR = ox + (BAR[0] + BAR[1]) / 2 * k;
    for (const r of [cover, all]) { r.setAttribute("width", W); r.setAttribute("height", H); }
    railL.setAttribute("stroke-width", wL); railR.setAttribute("stroke-width", wR);
    hit.setAttribute("x", ox - 24); hit.setAttribute("y", -12);
    hit.setAttribute("width", LW * k + 48); hit.setAttribute("height", S + 24);
    gap.setAttribute("x", xL + wL / 2 - 0.5); gap.setAttribute("width", (xR - wR / 2) - (xL + wL / 2) + 1);
    gap.setAttribute("height", S + 2);   // overlaps the cover below by 2px so no seam shows
  }

  const easeOut = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  // One side of the opening: leaves the pull straight up, then sweeps out and
  // crosses the top edge at an angle (so the cover never forms a notch there).
  const side = (x0, xe, top, lift) =>
    `C${x0} ${top - lift * 0.55} ${xe + (x0 - xe) * 0.5} ${lift * 0.1} ${xe} ${-lift * 0.15}`;

  let p = 0, target = 0, extra = 0, finishing = false, touched = false, dragging = false;
  let lastInput = 0, hintStart = performance.now();

  function draw() {
    const top = p * (H - S), bot = top + S - 1, lift = Math.max(8, top);
    const spread = Math.min(cx * 0.95 * easeOut(p / 0.5), lift * 0.9 + 4) + extra * W;
    const eL = xL - wL / 2, eR = xR + wR / 2;                  // outer edges of the zipper
    const xeL = eL - spread, xeR = eR + spread;
    const open = top > 0.5;

    // opening: from the pull's bottom, up both outer edges, out along the curves
    hole.setAttribute("d", open
      ? `M${eL} ${bot} L${eL} ${top} ${side(eL, xeL, top, lift)} L${xeR} ${-lift * 0.15}
         C${xeR + (eR - xeR) * 0.5} ${lift * 0.1} ${eR} ${top - lift * 0.55} ${eR} ${top} L${eR} ${bot} Z`
      : "");
    railL.setAttribute("d", `M${xL} ${bot - 1} L${xL} ${H + 2}`);
    railR.setAttribute("d", `M${xR} ${bot - 1} L${xR} ${H + 2}`);

    // black between the logo halves fades out toward the opening instead of a hard edge
    gap.setAttribute("y", top);
    gap.style.display = open ? "" : "none";
    gapTop.setAttribute("stop-opacity", 0);

    logo.setAttribute("transform", `translate(${ox} ${top}) scale(${k}) matrix(0 -1 1 0 0 ${LH})`);
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
    setTimeout(() => svg.classList.add("is-done"), 350);
    setTimeout(() => { svg.remove(); document.body.classList.remove("intro-active"); }, 1100);
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
