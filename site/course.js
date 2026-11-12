/* The course, told on a scroll (after yetanotherbrowser.com's act one).
 *
 * Wide: a sticky stage sits beside five step cards. The step whose heading
 * has come up past 60% of the window is the one playing, and its scene loops
 * on the stage while it stays there. Narrow: no sticky stage; the steps turn
 * into pills under it and play in turn while the stage is on screen.
 *
 * The stage itself (the desktop, the real app, the Terminal, the pointer) is
 * stage.js; this file is the steps and their scenes.
 */
(function () {
  var root = document.getElementById("scrolly");
  if (!root || !window.GGStage) return;

  var narrow = matchMedia("(max-width: 899px)");
  var scrn = root.querySelector(".scrn");
  var steps = Array.prototype.slice.call(root.querySelectorAll(".step"));

  var S = GGStage(scrn, { load: "near", poster: "assets/stage-course.webp" });
  var reduce = S.reduce, play = S.play, stop = S.stop, app = S.app, q = S.q;
  var begin = S.begin, celebrate = S.celebrate, clickApp = S.clickApp, clickTerm = S.clickTerm, run = S.run;
  var point = S.point, inApp = S.inApp, focus = S.focus, moveTo = S.moveTo, clearTerm = S.clearTerm;
  var verifyButton = S.verifyButton, ticks = S.ticks, appwin = S.appwin;

  /* ---------- scenes, one per step ---------- */

  var DONE = ["meet_the_terminal", "command_performance", "you_are_here", "there_and_back_again", "make_it_so",
    "get_git", "repository", "commit_to_it", "githubbin", "remote_control", "forks_and_clones",
    "branches_arent_just_for_birds", "its_a_small_world", "pull_never_out_of_date", "requesting_you_pull_please"];
  var VERIFYWORK = "/Users/ada/git-gud-verifywork";

  function begin(c, scene, dir) {
    app().reset(scene);
    clearTerm(dir);
    focus(appwin);
    moveTo(640, 470);
    return c.until(verifyButton).then(function (b) { return c.w(500).then(function () { return scrollApp(c, b.closest("section")); }); });
  }
  /* The real celebration: let each screen land, then press Continue until it closes. */
  function celebrate(c) {
    function next(n) {
      var b = win();
      if (!b || n > 3) return c.w(1600);
      return c.w(1900).then(function () { return clickApp(c, b); }).then(function () { return c.w(500); }).then(function () { return next(n + 1); });
    }
    return c.until(win, 12000).then(function () { return next(0); });
  }

  var SCENES = {
    terminal: function (c) {
      return begin(c, { route: "#/challenge/meet_the_terminal", history: ["brew update", "open ."] })
        .then(function () { return clickTerm(c); })
        .then(function () { return run(c, "whoami", "ada"); })
        .then(function () { return run(c, "date", "Thu Nov 12 09:41:07 IST 2026"); })
        .then(function () { return c.until(ticks(3)); })
        .then(function () { return celebrate(c); });
    },
    files: function (c) {
      var base = "/Users/ada/gitgud-practice";
      return begin(c, { route: "#/challenge/make_it_so", completed: DONE.slice(0, 4), dir: base, cards: ["whoami", "date", "echo", "ls", "clear", "exit", "pwd", "cd", "cd-up"], history: ["pwd", "ls"] })
        .then(function () { return clickTerm(c); })
        .then(function () { return run(c, "mkdir gitgud-practice", "", function (a) { a.mkdir(base); }); })
        .then(function () { return run(c, "cd gitgud-practice", "", null, "gitgud-practice"); })
        .then(function () { return run(c, "touch hello.txt", "", function (a) { a.touch(base + "/hello.txt"); }); })
        .then(function () { return run(c, "mkdir -p notes/archive/2026", "", function (a) { a.mkdir(base + "/notes/archive/2026"); }); })
        .then(function () { return run(c, "touch notes/day-one.txt", "", function (a) { a.touch(base + "/notes/day-one.txt"); }); })
        .then(function () { return celebrate(c); });
    },
    git: function (c) {
      var path = "/Users/ada/hello-world";
      return begin(c, {
        route: "#/challenge/commit_to_it", completed: DONE.slice(0, 7), dir: path, cards: ["whoami", "date", "echo", "ls", "clear", "exit", "pwd", "cd", "cd-up", "mkdir", "touch", "git-version", "git-config", "git-init"], history: ["git init"],
        repo: { path: path, dirty: "?? readme.txt\n" },
      }, "hello-world")
        .then(function () { return clickTerm(c); })
        .then(function () { return run(c, "git add readme.txt", "", function (a) { a.stage("A  readme.txt\n"); }); })
        .then(function () { return run(c, 'git commit -m "Hello, Git"', "[main (root-commit) 4f2a9c1] Hello, Git\n 1 file changed, 1 insertion(+)\n create mode 100644 readme.txt", function (a) { a.commit("Hello, Git", ["readme.txt"]); }); })
        .then(function () { return run(c, "git status", "On branch main\nnothing to commit, working tree clean"); })
        .then(function () { return celebrate(c); });
    },
    github: function (c) {
      return begin(c, {
        route: "#/challenge/merge_tada", completed: DONE, dir: VERIFYWORK, username: "ada", cards: ["whoami", "date", "echo", "ls", "clear", "exit", "pwd", "cd", "cd-up", "mkdir", "touch", "git-version", "git-config", "git-init", "git-status", "git-add", "git-commit", "git-remote", "git-push", "git-clone", "git-branch-new", "git-fetch"], history: ["git push origin add-ada"],
        repo: {
          path: VERIFYWORK, branch: "add-ada", commits: ["Add ada", "Start the quilt"],
          remotes: { origin: "https://github.com/ada/git-gud-verifywork.git", upstream: "https://github.com/JyotirmoyDas05/git-gud-verifywork.git" },
        },
      }, "git-gud-verifywork")
        .then(function () { return clickTerm(c); })
        .then(function () { return run(c, "git checkout gh-pages", "Switched to branch 'gh-pages'", function (a) { a.checkout("gh-pages", true); }); })
        .then(function () { return run(c, "git merge add-ada", "Already up to date."); })
        .then(function () { return run(c, "git branch -d add-ada", "Deleted branch add-ada (was 4f2a9c1).", function (a) { a.deleteBranch("add-ada"); }); })
        .then(function () { return run(c, "git pull upstream gh-pages", "From github.com:JyotirmoyDas05/git-gud-verifywork\n * branch            gh-pages   -> FETCH_HEAD\nFast-forward\n contributors/add-ada.txt | 1 +", function (a) { a.pullUpstream("contributors/add-ada.txt"); }); })
        .then(function () { return clickApp(c, verifyButton()); })
        .then(function () { return c.until(ticks(2)); })
        .then(function () { return celebrate(c); })
        .then(function () { return c.until(function () { return q("main img[alt$='quilt patch']"); }, 10000); })
        .then(function (patch) { return c.w(600).then(function () { return point(c, inApp(patch)); }); })
        .then(function () { return c.w(2600); });
    },
    lang: function (c) {
      app().reset({ route: "#/challenge/get_git", completed: DONE.slice(0, 5), cards: ["whoami", "date", "echo", "ls", "clear", "exit", "pwd", "cd", "cd-up", "mkdir", "touch"], history: ["touch notes/day-one.txt"] });
      clearTerm();
      focus(appwin);
      moveTo(640, 470);
      return c.until(function () { return q("header button", /^English$/); })
        .then(function (b) { return c.w(700).then(function () { return clickApp(c, b); }); })
        .then(function () { return c.until(function () { return q("[role=menuitem]", /日本語/); }); })
        .then(function (item) { return c.w(500).then(function () { return clickApp(c, item); }); })
        .then(function () { return c.until(function () { return q("header button", /日本語/); }); })
        .then(function () { return point(c, [520, 300]); })
        .then(function () { return c.w(3000); });
    },
  };

  /* ---------- which step is on ---------- */

  var cur = null, seen = false;
  var cap = root.querySelector(".cap"), pills = root.querySelector(".pills"), rail = root.querySelector(".rail");

  pills.innerHTML = steps.map(function (s) {
    return '<button type="button" data-s="' + s.dataset.s + '">' + s.querySelector("h3").textContent.replace(/\.$/, "") + "</button>";
  }).join("");
  rail.innerHTML = steps.map(function (s) {
    return '<button type="button" data-s="' + s.dataset.s + '" aria-label="' + s.querySelector("h3").textContent + '"></button>';
  }).join("");

  function mark() {
    [steps, pills.children, rail.children].forEach(function (group) {
      Array.prototype.forEach.call(group, function (n) { n.classList.toggle("on", n.dataset.s === cur); });
    });
    var st = steps.filter(function (s) { return s.dataset.s === cur; })[0];
    cap.innerHTML = st ? "<b>" + st.querySelector("h3").innerHTML + "</b> " + st.querySelector("p").innerHTML : "";
  }

  function indexOf(s) { return steps.map(function (x) { return x.dataset.s; }).indexOf(s); }
  var lap = 0, playing = null; // lap: bumped whenever the step changes; playing: the step whose scene is running
  function later(f, ms) { var my = lap; setTimeout(function () { if (my === lap && cur) f(); }, ms); }
  function loop(s) {
    stop();
    playing = s;
    return play(SCENES[s]).then(function (ok) {
      if (playing === s) playing = null;
      if (!ok || cur !== s || reduce) return;
      if (narrow.matches) return later(function () { go(steps[(indexOf(s) + 1) % steps.length].dataset.s); }, 900);
      if (s === steps[steps.length - 1].dataset.s) return; // the last one plays once and holds
      return later(function () { loop(s); }, 1600);
    });
  }

  function go(s) {
    if (s === cur) return;
    cur = s;
    lap++;
    mark();
    if (s && seen) loop(s); else { stop(); playing = null; }
  }

  /* wide: the step is the last one whose heading has come up past 60% of the window */
  function stepInView() {
    var line = innerHeight * 0.6, s = null;
    steps.forEach(function (st) { if (st.querySelector("h3").getBoundingClientRect().top < line) s = st.dataset.s; });
    return s;
  }
  var pending = false;
  function pick() {
    pending = false;
    // Off screen the scene holds and the step is settled on the way back. Measured here, not
    // read from `seen`: on a jump the scroll lands a frame before the observer reports it.
    var r = scrn.getBoundingClientRect();
    var shown = (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / (r.height || 1);
    if (narrow.matches || shown <= 0.3) return;
    go(stepInView());
  }
  addEventListener("scroll", function () { if (!pending) { pending = true; requestAnimationFrame(pick); } }, { passive: true });

  new IntersectionObserver(function (es) {
    var was = seen;
    seen = es[es.length - 1].intersectionRatio > 0.3;
    if (was === seen) return;
    if (!seen) { S.pause(); return; } // scrolled away: hold the scene where it is
    S.resume();
    var s = narrow.matches ? cur || steps[0].dataset.s : stepInView();
    if (s && s === cur && playing === cur) return; // back on the same step: it carries on
    cur = null;
    go(s);
  }, { threshold: [0, 0.3, 0.6] }).observe(scrn);

  narrow.addEventListener("change", function () { var s = cur; cur = null; if (narrow.matches) go(s || steps[0].dataset.s); else pick(); });

  pills.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (b) { cur = null; go(b.dataset.s); }
  });
  function centreOn(st) {
    var r = st.getBoundingClientRect();
    scrollTo({ top: scrollY + r.top + r.height / 2 - innerHeight / 2, behavior: reduce ? "auto" : "smooth" });
  }
  rail.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (b) centreOn(steps[indexOf(b.dataset.s)]);
  });
  steps.forEach(function (st) { st.addEventListener("click", function () { centreOn(st); }); });

  pick();
})();
