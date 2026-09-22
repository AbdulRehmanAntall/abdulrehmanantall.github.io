/* Abdul Rehman Antall — portfolio interactions (no dependencies) */
(function () {
  "use strict";

  var SLIDE_INTERVAL = 5500; // milliseconds between photos

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;

  /* ---------- Page-load sequence ---------- */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { root.classList.add("is-loaded"); });
  });

  /* ---------- Footer year ---------- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Photo slideshow ---------- */
  var gallery = document.getElementById("gallery");
  if (gallery) initGallery(gallery);

  function initGallery(el) {
    var frame = el.querySelector(".gallery__frame");
    var controls = el.querySelector(".gallery__controls");
    var dotsWrap = el.querySelector(".gallery__dots");
    var toggle = el.querySelector(".gallery__toggle");
    var all = Array.prototype.slice.call(frame.querySelectorAll("img"));

    el.style.setProperty("--interval", SLIDE_INTERVAL + "ms");

    // Work out which photos actually exist, so missing files never show as broken images.
    var checks = all.map(function (img) {
      img.loading = "eager";
      return new Promise(function (resolve) {
        if (img.complete) return resolve(img.naturalWidth > 0);
        img.addEventListener("load", function () { resolve(true); }, { once: true });
        img.addEventListener("error", function () { resolve(false); }, { once: true });
      });
    });

    Promise.all(checks).then(function (ok) {
      var slides = all.filter(function (img, i) {
        if (!ok[i]) { img.classList.add("is-broken"); img.classList.remove("is-active"); }
        return ok[i];
      });

      if (slides.length === 0) { el.classList.add("is-empty"); return; }

      var index = 0;
      slides.forEach(function (s, i) { s.classList.toggle("is-active", i === 0); });
      if (slides.length === 1) return;

      var timer = null;
      var paused = reduceMotion;   // respect reduced-motion: start paused
      var userPaused = reduceMotion;
      var visible = true;

      var dots = slides.map(function (_, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "gallery__dot";
        b.setAttribute("aria-label", "Show photo " + (i + 1) + " of " + slides.length);
        b.addEventListener("click", function () { go(i); restart(); });
        dotsWrap.appendChild(b);
        return b;
      });

      controls.hidden = false;

      function render() {
        slides.forEach(function (s, i) { s.classList.toggle("is-active", i === index); });
        dots.forEach(function (d, i) {
          var on = i === index;
          d.classList.toggle("is-active", on);
          if (on) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
          // restart the progress animation on the active dot
          if (on) { d.classList.remove("is-active"); void d.offsetWidth; d.classList.add("is-active"); }
        });
      }

      function go(i) {
        index = (i + slides.length) % slides.length;
        render();
      }

      function stop() { clearInterval(timer); timer = null; }
      function start() {
        stop();
        if (paused || !visible || document.hidden) return;
        timer = setInterval(function () { go(index + 1); }, SLIDE_INTERVAL);
      }
      function restart() { if (!paused) { render(); start(); } }

      function setPaused(p) {
        paused = p;
        el.classList.toggle("is-paused", p);
        toggle.setAttribute("aria-label", p ? "Play slideshow" : "Pause slideshow");
        if (p) stop(); else { render(); start(); }
      }

      toggle.addEventListener("click", function () {
        userPaused = !paused;
        setPaused(!paused);
      });

      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop(); else if (!paused) restart();
      });

      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          if (!visible) stop(); else if (!userPaused) { paused = false; restart(); }
        }, { threshold: 0.15 }).observe(frame);
      }

      render();
      setPaused(paused);
    });
  }

  /* ---------- Scroll-linked effects (one rAF loop) ---------- */
  var nav = document.getElementById("nav");
  var darkSections = Array.prototype.slice.call(document.querySelectorAll("[data-nav='dark']"));
  var galleryFrame = document.querySelector(".gallery__frame");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".project"));
  var ticking = false;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function update() {
    ticking = false;
    var vh = window.innerHeight;
    var navBottom = nav ? nav.getBoundingClientRect().bottom : 52;

    // Glass nav turns dark over the black section.
    if (nav) {
      var overDark = darkSections.some(function (s) {
        var r = s.getBoundingClientRect();
        return r.top <= navBottom - 20 && r.bottom >= navBottom - 20;
      });
      nav.classList.toggle("is-dark", overDark);
    }

    if (reduceMotion) return;

    // Photo frame grows to full size as it scrolls into view.
    if (galleryFrame) {
      var gr = galleryFrame.getBoundingClientRect();
      var p = clamp((vh - gr.top) / (vh * 0.75), 0, 1);
      galleryFrame.style.setProperty("--g-scale", (0.92 + 0.08 * p).toFixed(4));
    }

    // Stacking cards: each card shrinks to 0.95 and dims as the next one slides over it.
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var next = cards[i + 1];
      if (!next || getComputedStyle(card).position !== "sticky") {
        card.style.setProperty("--s", 1);
        card.style.setProperty("--dim", 0);
        continue;
      }
      var cr = card.getBoundingClientRect();
      var nr = next.getBoundingClientRect();
      var overlap = clamp(1 - (nr.top - cr.top) / cr.height, 0, 1);
      card.style.setProperty("--s", (1 - 0.05 * overlap).toFixed(4));
      card.style.setProperty("--dim", (0.18 * overlap).toFixed(3));
    }
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();

  /* ---------- BibTeX toggle + copy ---------- */
  document.querySelectorAll("[data-bib-toggle]").forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute("aria-controls"));
    if (!panel) return;
    panel.setAttribute("inert", "");
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      panel.classList.toggle("is-open", !open);
      if (open) panel.setAttribute("inert", ""); else panel.removeAttribute("inert");
    });
  });

  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var code = btn.parentElement.querySelector("code");
      if (!code) return;
      var text = code.textContent;
      var done = function () {
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = "Copy"; }, 1800);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else { fallback(); }
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
      }
    });
  });
})();
