/* ═══════════════════════════════════════════════════════════════
   WALIMA INVITATION v3 — script.js
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  /* ── Refs ──────────────────────────────────────────────────── */
  var splash      = $('splash');
  var splashPrompt= $('splashPrompt');
  var introVideo  = $('introVideo');
  var heroSection = $('hero');
  var heroVideo   = $('heroVideo');
  var heroContent = $('heroContent');
  var music       = $('music');
  var musicBtn    = $('musicBtn');

  /* ── State ─────────────────────────────────────────────────── */
  var entered     = false;  // true once the site is revealed
  var heroShown   = false;  // true once hero text has faded in
  var videoEnded  = false;  // true once intro video has ended

  /* Timestamp (seconds) at which hero content fades in */
  var HERO_REVEAL_TIME = 7;

  /* ── Helpers ────────────────────────────────────────────────── */
  function safePlay(el) {
    if (!el) return Promise.resolve();
    var p = el.play();
    return (p && p.catch) ? p.catch(function () {}) : Promise.resolve();
  }

  /* ── 1. Splash tap → start video + music ───────────────────── */
  function onSplashTap() {
    if (splash.classList.contains('is-playing')) return;
    splash.classList.add('is-playing');

    /* Start intro video on the splash layer */
    introVideo.muted = true;
    safePlay(introVideo);

    /* Start hero video at the same time (warming up for the reveal) */
    heroVideo.muted = true;
    heroVideo.currentTime = 0;
    safePlay(heroVideo);

    /* Unlock audio — the user gesture is right now */
    startMusic();
  }

  splash.addEventListener('click', onSplashTap);
  splash.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') onSplashTap();
  });

  /* ── 2. Intro video timeupdate → hand over to the hero ─────── */
  introVideo.addEventListener('timeupdate', function () {
    if (heroShown || introVideo.currentTime < HERO_REVEAL_TIME) return;
    heroShown = true;

    /* Revealing the text is not enough — the splash covers the whole
       viewport, so the site has to be entered at the same moment or the
       hero stays hidden behind it until the video ends. heroVideo is
       already playing the same file in sync, so it just continues there. */
    heroContent.classList.add('is-visible');
    enterSite();
  });

  /* ── 3. Video ended → freeze on last frame, transition out splash ── */
  introVideo.addEventListener('ended', function () {
    if (videoEnded) return;
    videoEnded = true;

    /* Safety net: video shorter than HERO_REVEAL_TIME, or timeupdate never
       fired. enterSite() is idempotent, so this is a no-op after an early
       hand-over. */
    heroContent.classList.add('is-visible');
    enterSite();
  });

  /* Fallback: if video errors, still let the guest in */
  introVideo.addEventListener('error', enterSite);

  /* ── 4. Enter site (reveal main content) ───────────────────── */
  function enterSite() {
    if (entered) return;
    entered = true;

    /* Ensure hero text visible */
    heroContent.classList.add('is-visible');

    /* heroVideo is left playing — it holds on its own last frame when it
       ends, which is the frozen-frame effect. Pausing here would freeze it
       at whatever second the hand-over happened. */

    /* Fade out and hide splash */
    splash.classList.add('is-gone');
    document.body.classList.remove('is-locked');

    setTimeout(function () {
      splash.hidden = true;
      /* Release intro video memory */
      introVideo.pause();
      introVideo.removeAttribute('src');
      introVideo.load();
    }, 950);

    /* Restart hero video from last frame — already paused, so nothing to do */
    /* The paused last-frame creates the "frozen on final frame" effect */
  }

  /* ── 5. Countdown ───────────────────────────────────────────── */
  /* 27 September 2026, 19:00 PKT (UTC+5 — no DST in Pakistan) */
  var TARGET_MS = Date.UTC(2026, 8, 27, 14, 0, 0); /* 19:00 PKT = 14:00 UTC */

  function breakdown(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    return {
      days:  Math.floor(s / 86400),
      hours: Math.floor(s / 3600) % 24,
      mins:  Math.floor(s / 60) % 60,
      secs:  s % 60
    };
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  var cdEls = {
    days:  $('cd-days'),
    hours: $('cd-hours'),
    mins:  $('cd-mins'),
    secs:  $('cd-secs')
  };

  function tick() {
    var left = TARGET_MS - Date.now();
    if (left <= 0) {
      $('cd-done').hidden = false;
      cdEls.days.textContent  = '00';
      cdEls.hours.textContent = '00';
      cdEls.mins.textContent  = '00';
      cdEls.secs.textContent  = '00';
      clearInterval(cdTimer);
      return;
    }
    var t = breakdown(left);
    cdEls.days.textContent  = t.days;
    cdEls.hours.textContent = pad(t.hours);
    cdEls.mins.textContent  = pad(t.mins);
    cdEls.secs.textContent  = pad(t.secs);
  }

  tick();
  var cdTimer = setInterval(tick, 1000);

  /* ── 6. Music ───────────────────────────────────────────────── */
  music.addEventListener('loadedmetadata', function () {
    /* Button becomes visible only when music file confirmed to exist */
    musicBtn.hidden = false;
  });

  function startMusic() {
    safePlay(music).then(function () {
      if (music.paused) return;
      musicBtn.hidden = false;
      musicBtn.classList.add('is-playing');
      musicBtn.setAttribute('aria-label', 'Pause music');
    });
  }

  musicBtn.addEventListener('click', function () {
    if (music.paused) {
      safePlay(music);
      musicBtn.classList.add('is-playing');
      musicBtn.setAttribute('aria-label', 'Pause music');
    } else {
      music.pause();
      musicBtn.classList.remove('is-playing');
      musicBtn.setAttribute('aria-label', 'Play music');
    }
  });

  /* ── 7. Falling Petals ──────────────────────────────────────── */
  /* Every .petal-field on the page gets its own set, sized and triggered by
     whichever section it sits in. */
  var PETAL_SPRITES = 5;
  var PETAL_COUNT   = 16;
  var rand = function (min, max) { return min + Math.random() * (max - min); };

  function seedPetals(petalField) {
    var host = petalField.parentElement;
    if (!host) return;

    for (var p = 0; p < PETAL_COUNT; p++) {
      var petal    = document.createElement('span');
      petal.className = 'petal';

      /* Sprite rides in as a CSS mask, not an <img>, so the cream art
         can be painted any theme color. */
      var petalShape = document.createElement('i');
      petalShape.style.setProperty(
        '--sprite',
        "url('./assets/falling-petal-" + ((p % PETAL_SPRITES) + 1) + ".png')"
      );
      petal.appendChild(petalShape);

      petal.style.left = rand(0, 96).toFixed(2) + '%';
      petal.style.setProperty('--size',     rand(14, 28).toFixed(0)  + 'px');
      petal.style.setProperty('--drift',    rand(18, 55).toFixed(0)  + 'px');
      petal.style.setProperty('--spin',     rand(60, 220).toFixed(0) + 'deg');
      petal.style.setProperty('--duration', rand(6, 11).toFixed(1)   + 's');
      petal.style.setProperty('--delay',    rand(0, 1.8).toFixed(1)  + 's');
      petal.style.setProperty('--sway',     rand(2.5, 5).toFixed(1)  + 's');
      petal.style.setProperty('--opacity',  rand(0.45, 0.85).toFixed(2));

      petalField.appendChild(petal);
    }

    var sizePetals = function () {
      petalField.style.setProperty('--fall', (host.offsetHeight + 120) + 'px');
    };
    sizePetals();
    window.addEventListener('load', sizePetals);
    window.addEventListener('resize', sizePetals);

    /* Only fall while the host section is on screen. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        petalField.classList.toggle('is-falling', entries[0].isIntersecting);
      }, { threshold: 0.05 }).observe(host);
    } else {
      petalField.classList.add('is-falling');
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll('.petal-field'), seedPetals);

  /* ── 8. Scroll Reveal ───────────────────────────────────────── */
  /* CSS drives this natively where view() timelines exist; this whole
     block is only the fallback for browsers that lack them. */
  var reveals = document.querySelectorAll('.reveal');
  var nativeTimelines = window.CSS && CSS.supports &&
                        CSS.supports('animation-timeline', 'view()');

  if (nativeTimelines) {
    /* nothing to do — the stylesheet owns it */
  } else if (!('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(reveals, function (el) {
      el.classList.add('is-in');
    });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  }

})();
