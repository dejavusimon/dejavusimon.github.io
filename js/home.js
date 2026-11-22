/* Home: when the zipper finishes, the centred name moves into the top card's
   upper-left corner and the cards fade in. */
(() => {
  const name = document.querySelector(".name-stage .t-display");
  const slot = document.querySelector(".hero-name");
  const stage = document.querySelector(".name-stage");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function dock() {
    document.body.classList.add("is-home");
    const first = name.getBoundingClientRect();

    // move the name into the card, restyled as the docked size
    slot.appendChild(name);
    name.classList.remove("t-display");
    name.classList.add("t-name", "name-docked");
    stage.remove();
    const last = name.getBoundingClientRect();

    if (reduce) return;
    const dx = first.left - last.left, dy = first.top - last.top, s = first.width / last.width;
    name.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: "none" }],
      { duration: 650, easing: "cubic-bezier(.65, 0, .35, 1)" }
    );
  }

  // the intro tells us when it's done; without an intro, dock straight away
  if (document.querySelector(".intro")) document.addEventListener("intro:done", dock, { once: true });
  else dock();
})();
