/* The hero: the real app, touring itself until you take the wheel
 * (after yetanotherbrowser.com's hero, with guidance in cap.so's manner).
 *
 * Four chapters play in turn while the stage is mostly on screen; each pill
 * fills as its chapter runs. Click the desktop (or "Try it yourself") and the
 * chapter on screen becomes yours: two or three small tasks, one quiet
 * numbered hint at a time, with only the parts of the app those tasks need
 * answering the pointer (and the Terminal, always). Another pill switches
 * chapters; Esc or "Resume tour" gives it back. Out of view or in a hidden
 * tab the tour holds its place. Touch screens only watch.
 *
 * The tour shows how the app treats you. What it teaches is the course
 * section's job further down, so no chapter here repeats one of its steps.
 */
(function () {
  var root = document.getElementById("hero-demo");
  if (!root || !window.GGStage) return;

  var S = GGStage(root.querySelector(".scrn"), { load: "now", poster: "assets/stage-hero.webp" });
  var reduce = S.reduce;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var cap = root.querySelector(".hcap"), chaps = root.querySelector(".chaps");
  var driving = root.querySelector(".driving"), tryIt = root.querySelector(".try");

  /* ---------- finding things ---------- */

  var q = function (sel, re) { return S.q(sel, re); };
  var hash = function () { return S.doc().location.hash; };
  var block = function () { return S.verifyBlock(); };
  var has = function (re) { var b = block(); return b && re.test(b.textContent); };
  var picked = function () { return q("main .gg-option[data-state=right], main .gg-option[data-state=wrong]"); };
  /* A card is collected once its face shows; match its command label exactly. */
  var collected = function (cmd) {
    var code = Array.prototype.find.call(S.doc().querySelectorAll(".gg-card[data-collected] code"), function (c) { return c.textContent.trim() === cmd; });
    return code && code.closest(".gg-card");
  };
  var paletteInput = function () { return S.doc().querySelector("input[placeholder]"); };
  var atTerm = function () { return [S.term.offsetLeft + 16, S.term.offsetTop + S.term.offsetHeight - 78]; }; // the Terminal's empty bottom, clear of what you type
  var above = function (el) { return el && S.inApp(el, 0, -54); };
  var beside = function (el) { return el && S.inApp(el, el.getBoundingClientRect().width + 14, -6); };
  var ran = {};

  /* Bring an element in the app's own pane into view (never the page). */
  function reveal(el) {
    var main = S.doc().querySelector("main");
    if (!el || !main) return;
    var mr = main.getBoundingClientRect(), er = el.getBoundingClientRect();
    if (er.top >= mr.top + 60 && er.bottom <= mr.bottom - 20) return;
    main.scrollTo({ top: main.scrollTop + er.top - mr.top - 120, behavior: reduce ? "auto" : "smooth" });
  }

  /* ---------- chapters ---------- */

  var BEFORE = function (n) { return ["meet_the_terminal", "command_performance", "you_are_here", "there_and_back_again", "make_it_so", "get_git", "repository", "commit_to_it", "githubbin", "remote_control", "forks_and_clones", "branches_arent_just_for_birds"].slice(0, n); };
  var CARDS = ["whoami", "date", "ls", "pwd", "cd"];

  var CH = [
    {
      label: "Guess before you run", d: 11,
      say: "Before a new command runs, Git Gud asks what you think it will do. A wrong guess costs nothing and shows you why.",
      setup: function () {
        S.app().reset({ route: "#/challenge/branches_arent_just_for_birds", completed: BEFORE(11), cards: CARDS.concat(["git-init", "git-add", "git-commit"]) });
      },
      allow: "main .gg-option, aside a[href='#/challenge/commit_to_it'], aside a[href='#/challenge/remote_control']",
      tasks: [
        { say: "Where does the new commit go? Click your guess.", at: function () { var o = q("main .gg-option"); reveal(o && o.closest("section")); return above(o && o.closest("section")); }, done: picked },
        { say: "Another one: open <b>Commit to It</b> in the sidebar and guess again.", at: function () { return beside(q("aside a[href='#/challenge/commit_to_it']")); }, done: function () { return /commit_to_it/.test(hash()) && picked(); }, follow: function () { if (/commit_to_it/.test(hash())) { var o = q("main .gg-option"); if (o) reveal(o.closest("section")); } } },
      ],
      scene: function (c) {
        return c.until(function () { return q("main .gg-option"); })
          .then(function (o) { return c.w(500).then(function () { return S.scrollApp(c, o.closest("section")); }); })
          .then(function () { return S.point(c, S.inApp(q("main .gg-option", /^Onto main/))); })
          .then(function () { return c.w(700); })
          .then(function () { return S.point(c, S.inApp(q("main .gg-option", /forking off the first/))); })
          .then(function () { return c.w(500); })
          .then(function () { return S.clickApp(c, q("main .gg-option", /forking off the first/)); })
          .then(function () { return c.w(3800); });
      },
    },
    {
      label: "Get unstuck", d: 14,
      say: "Typed it wrong? Git Gud spots the slip in your history, and each hint you ask for says a little more.",
      setup: function () {
        S.app().reset({ route: "#/challenge/command_performance", completed: BEFORE(1), cards: ["whoami", "date"], history: ["whoami", "date"] });
      },
      allow: "main section button",
      tasks: [
        { say: "Make a slip on purpose: type <code>ehco hi</code> in the Terminal, then press <b>Verify</b>.", at: function () { var b = block(); reveal(b); return ran.ehco ? above(S.verifyButton()) : atTerm(); }, done: function () { return has(/did you mean/i); } },
        { say: "It caught that. Now ask it for a hint.", at: function () { return beside(q("main button", /^Need a hint/)); }, done: function () { return q("main button", /^Another hint/); } },
        { say: "Fix it: <code>echo hi</code>.", at: atTerm, done: function () { return has(/You ran\s*echo/i); } },
      ],
      scene: function (c) {
        return c.until(S.verifyButton)
          .then(function (b) { return c.w(500).then(function () { return S.scrollApp(c, b.closest("section")); }); })
          .then(function () { return S.clickTerm(c); })
          .then(function () { return S.run(c, 'ehco "hello"', "zsh: command not found: ehco"); })
          .then(function () { return S.clickApp(c, S.verifyButton()); })
          .then(function () { return c.until(function () { return q("main button", /^Need a hint/); }); })
          .then(function (b) { return c.w(1600).then(function () { return S.clickApp(c, b); }); })
          .then(function () { return c.w(2600); })
          .then(function () { return S.clickTerm(c); })
          .then(function () { return S.run(c, 'echo "hello"', "hello"); })
          .then(function () { return c.w(3200); });
      },
    },
    {
      label: "Collect the cards", d: 12,
      say: "Every command the course teaches is a card. It turns over the first time you run it for real.",
      setup: function () {
        S.app().reset({ route: "#/deck", cards: CARDS, history: ["whoami", "date", "ls", "pwd", "cd Documents"] });
      },
      allow: ".gg-card",
      tasks: [
        { say: "Run <code>echo hi</code> in the Terminal and watch its card turn over.", at: atTerm, done: function () { return collected("echo"); } },
        { say: "Two more: <code>mkdir notes</code>, then <code>touch notes/today.txt</code>.", at: atTerm, done: function () { return collected("mkdir") && collected("touch"); } },
      ],
      scene: function (c) {
        return c.until(function () { return q(".gg-card[data-collected]"); })
          .then(function () { return c.w(900); })
          .then(function () { return S.clickTerm(c); })
          .then(function () { return S.run(c, 'echo "hello, git gud"', "hello, git gud"); })
          .then(function () { return c.until(function () { return collected("echo"); }, 9000); })
          .then(function (card) { return S.point(c, S.inApp(card)).then(function () { return c.w(2400); }); });
      },
    },
    {
      label: "Find any lesson", d: 10,
      say: "Sixteen challenges, a dictionary and the resources, one search away.",
      setup: function () {
        S.app().reset({ route: "#/challenge/meet_the_terminal", completed: ["meet_the_terminal"], cards: ["whoami", "date"], history: ["whoami", "date"] });
      },
      allow: "aside button, input[placeholder], button[data-index]",
      tasks: [
        { say: "Press <b>Search</b>, or <kbd>Ctrl K</kbd>.", at: function () { return beside(q("aside button", /^Search/)); }, done: paletteInput },
        { say: "Look something up: try <code>clone</code>.", at: function () { return above(paletteInput()); }, done: function () { var i = paletteInput(); return i && i.value.trim().length > 1 && q("button[data-index]"); } },
        { say: "Open a result. It goes straight to that part of the lesson.", at: function () { return above(paletteInput()); }, done: function () { return !/meet_the_terminal/.test(hash()); } },
      ],
      scene: function (c) {
        S.moveTo(640, 470);
        return c.until(function () { return q("aside button", /^Search/); })
          .then(function (b) { return c.w(700).then(function () { return S.clickApp(c, b); }); })
          .then(function () { return c.until(paletteInput); })
          .then(function (input) { return c.w(300).then(function () { return S.typeApp(c, input, "branch"); }); })
          .then(function () { return c.until(function () { return q("button[data-index]"); }); })
          .then(function (hit) { return c.w(600).then(function () { return S.clickApp(c, hit); }); })
          .then(function () { return c.w(2600); });
      },
    },
  ];

  function lay(i) {
    CH[i].setup();
    S.clearTerm();
    S.focus(S.appwin);
  }

  chaps.innerHTML = CH.map(function (ch, i) {
    return '<button class="chap" type="button" data-i="' + i + '"><span class="fill"></span>' + ch.label + "</button>";
  }).join("");

  /* The playing pill fills over its chapter; ones before it top up, ones after empty. */
  function fillTo(i) {
    Array.prototype.forEach.call(chaps.children, function (b, j) {
      var f = b.querySelector(".fill");
      var from = new DOMMatrix(getComputedStyle(f).transform).m41 / (f.offsetWidth || 1) * 100;
      f.getAnimations().forEach(function (a) { a.cancel(); });
      b.classList.toggle("on", j === i);
      var go = function (a, z, d, e) { f.animate([{ transform: "translateX(" + a + "%)" }, { transform: "translateX(" + z + "%)" }], { duration: reduce ? 1 : d, easing: e, fill: "forwards" }); };
      if (j === i) go(-100, 0, CH[i].d * 1000, "linear");
      else if (j < i) go(from, 0, 300, "cubic-bezier(.32,.72,0,1)");
      else go(from, -100, 240, "cubic-bezier(.32,.72,0,1)");
    });
    centre(i);
  }
  /* On a narrow screen the pills scroll sideways; keep the current one in the middle of the row. */
  function centre(i) {
    var b = chaps.children[i];
    if (!b || chaps.scrollWidth <= chaps.clientWidth) return;
    var cr = chaps.getBoundingClientRect(), br = b.getBoundingClientRect();
    chaps.scrollTo({ left: chaps.scrollLeft + br.left - cr.left - (cr.width - br.width) / 2, behavior: reduce ? "auto" : "smooth" });
  }

  /* ---------- the tour ---------- */

  var touring = false, at = 0, run = 0; // run: which tour is current; a stopped one's callback must not touch the next
  function caption(html) { cap.innerHTML = html; }

  function tour(from) {
    drive(false);
    touring = true;
    var i = from, mine = ++run;
    function next() {
      if (mine !== run) return;
      at = i;
      fillTo(i);
      caption(CH[i].say);
      var t0 = performance.now();
      S.play(function (c) { lay(i); return CH[i].scene(c); }).then(function (ok) {
        if (mine !== run) return; // stopped on purpose: whoever stopped it carries on
        if (ok) CH[i].d = (performance.now() - t0) / 1000; // the next lap fills in step with the real run
        if (!touring || reduce) { touring = false; return; }
        // A chapter that failed (a slow phone, say) hands over to the next rather than freezing the tour.
        i = (i + 1) % CH.length;
        if (ok) next(); else setTimeout(next, 800);
      });
    }
    /* Pills and captions wait for the app, so the first pill fills in step with what's on screen. */
    S.ready.then(next);
  }
  function halt() { touring = false; run++; S.stop(); }

  /* Out of view or in a hidden tab, the tour holds its place, pill fill and all. */
  function hold(on) {
    if (on) S.pause(); else S.resume();
    Array.prototype.forEach.call(chaps.querySelectorAll(".fill"), function (f) {
      f.getAnimations().forEach(function (a) { if (on && a.playState === "running") a.pause(); else if (!on && a.playState === "paused") a.play(); });
    });
  }
  var inView = false;
  document.addEventListener("visibilitychange", function () { if (touring) hold(document.hidden || !inView); });

  /* ---------- the visitor at the wheel ---------- */

  var task = 0, watching = 0;
  function show(i) {
    var t = CH[at].tasks[i];
    var xy = t.at();
    if (!xy) return false;
    xy = [Math.max(16, Math.min(xy[0], 1280 - 470)), Math.max(16, xy[1])];
    S.say(t.say, xy, i + 1);
    return true;
  }
  function finish() {
    task = -1;
    var next = CH[(at + 1) % CH.length].label;
    S.say("Done. Try <b>" + next + "</b> next, or <kbd>esc</kbd> hands it back.", [300, 56], "✓");
    caption("That’s " + CH[at].label.toLowerCase() + ". Pick another chapter to try, or <kbd>esc</kbd> gives it back.");
  }

  /* Take the wheel on chapter i: its screen, its tasks, its unlocked parts. */
  function drive(on, i) {
    if (!on) {
      if (!S.driving) return;
      watching++;
      S.app().allow(null);
      S.app().keyboard(false);
      S.drive(false);
      driving.classList.remove("on");
      tryIt.hidden = !fine;
      return;
    }
    halt();
    S.drive(true);
    driving.classList.add("on");
    tryIt.hidden = true;
    at = i;
    Array.prototype.forEach.call(chaps.children, function (b, j) {
      b.classList.toggle("on", j === i);
      var f = b.querySelector(".fill");
      f.getAnimations().forEach(function (a) { a.cancel(); });
    });
    centre(i);
    var n = CH[i].tasks.length;
    caption("Your turn: " + n + " things to try in <b>" + CH[i].label.toLowerCase() + "</b>. The Terminal takes your typing. <kbd>esc</kbd> gives it back.");
    ran = {};
    lay(i);
    S.app().allow(CH[i].allow);
    S.app().keyboard(true);
    S.focus(S.term);
    task = 0;
    var mine = ++watching, shown = false;
    (function watch() {
      if (mine !== watching || !S.driving) return;
      var t = CH[at].tasks[task];
      if (t) {
        try {
          if (!shown) shown = show(task);
          if (t.follow) t.follow();
          if (shown && t.done()) { task++; shown = false; if (task >= CH[at].tasks.length) finish(); }
        } catch (e) { /* the app is still drawing */ }
      }
      setTimeout(watch, 300);
    })();
  }
  S.onCommand = function (name) {
    ran[name] = true;
    if (S.driving && task >= 0 && CH[at].tasks[task]) show(task); // re-anchor: some hints move once you've typed
  };

  S.scrn.addEventListener("click", function () { if (fine && !S.driving) drive(true, at); });
  tryIt.addEventListener("click", function () { drive(true, at); });
  driving.querySelector("button").addEventListener("click", function () { tour(at); });
  chaps.addEventListener("click", function (e) {
    var b = e.target.closest(".chap");
    if (!b) return;
    if (S.driving) drive(true, +b.dataset.i);
    else { halt(); tour(+b.dataset.i); }
  });

  /* Esc gives it back, unless the app has something open that Esc should close. */
  function onKey(e) {
    if (!S.driving) return;
    /* Ctrl/⌘+K belongs to the app while you drive. Pressed with focus outside it
     * (the Terminal, the page), the browser would take it for its own search. */
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      if (e.view === S.frame.contentWindow) return; // inside the app: its own handler has it
      e.preventDefault();
      var search = S.q("aside button", /^Search/);
      if (search && !S.doc().querySelector("input[placeholder]")) { S.focus(S.appwin); search.click(); }
      return;
    }
    if (e.key !== "Escape") return;
    if (S.doc().querySelector("[role=menu], input[placeholder]")) return; // the search box closes first
    tour(at);
  }
  addEventListener("keydown", onKey, true);
  S.ready.then(function () { S.frame.contentWindow.addEventListener("keydown", onKey, true); });

  if (!fine) tryIt.hidden = true;
  if (reduce) caption("Pick a chapter below to see it.");

  /* The tour runs while the stage is mostly on screen, and holds when it has mostly left. */
  new IntersectionObserver(function (es) {
    var e = es[es.length - 1];
    if (e.intersectionRatio <= 0.25) inView = false;
    else if (e.intersectionRatio >= 0.5) inView = true;
    else return; // in between: carry on as before
    if (touring) hold(!inView || document.hidden);
    else if (inView && !S.driving && !reduce) { hold(false); tour(at); }
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] }).observe(S.scrn);
})();
