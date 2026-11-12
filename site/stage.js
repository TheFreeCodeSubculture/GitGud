/* The stage: a 1280×800 Mac desktop scaled into any `.scrn` box, shared by
 * the hero (hero.js) and the course (course.js).
 *
 * It holds Cap's wallpaper, the real Git Gud app (demo/demo.html, the
 * shipping UI on a fake backend) and a macOS Terminal drawn in HTML. Scenes
 * are async functions that move a pointer, type into the Terminal, tell the
 * app's fake backend what each command did, and click the app with real
 * pointer events; the app's own checks do the rest. Stopping bumps a token so
 * the running scene throws out of its next wait.
 *
 * `drive(true)` hands the desktop to the visitor: the app takes their clicks
 * and the Terminal their keys, through a small shell that knows the commands
 * the first lessons use. Every command they run lands in the same history the
 * app reads, so its checks tick for them too.
 */
(function () {
  var W = 1280;
  var APP = { x: 28, y: 34, w: 920, h: 732 };
  var HOME = "/Users/ada";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var FOLDER =
    '<svg viewBox="0 0 16 13" aria-hidden="true"><path d="M1.2 1.6C1.2.9 1.7.5 2.4.5h3.5c.4 0 .7.1 1 .4l.9.9h5.8c.7 0 1.2.5 1.2 1.2v.6H1.2z" fill="#66b3f7"/>' +
    '<path d="M.6 4.2c0-.6.4-1 1-1h12.8c.6 0 1 .4 1 1v6.9c0 .8-.6 1.4-1.4 1.4H2c-.8 0-1.4-.6-1.4-1.4z" fill="#4a9fec"/></svg>';
  var ARROW =
    '<svg viewBox="0 0 16 24" aria-hidden="true"><path d="M1 1v18.4l4.6-4.4 3.3 7.4 3-1.3-3.2-7.2h6.4z" fill="#000" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg>';

  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
  var queue = Promise.resolve(); // stages load their app one after another, in the order they were made

  /* Fling the page past the course and every step it crosses starts its
   * scene, each with a card's chime. So the demos' volume follows scroll
   * speed: full at a reading pace, falling off exponentially past about
   * 1 px/ms (a fast wheel), near silent when dragging the scrollbar, and
   * easing back over most of a second once the page settles. */
  var duck = { v: 1, speed: 0, y: scrollY, t: performance.now(), frame: 0, stages: [] };
  function settle() {
    duck.frame = 0;
    if (performance.now() - duck.t > 60) duck.speed *= 0.95;
    var v = Math.exp(-Math.max(0, duck.speed - 1) / 1.5);
    if (v > 0.97) v = 1;
    if (Math.abs(v - duck.v) > 0.02 || (v === 1 && duck.v !== 1)) {
      duck.v = v;
      duck.stages.forEach(function (S) { S.volume(v); });
    }
    if (duck.speed > 0.05) duck.frame = requestAnimationFrame(settle);
  }
  addEventListener("scroll", function () {
    var now = performance.now(), dt = Math.max(8, now - duck.t);
    duck.speed = Math.max(Math.abs(scrollY - duck.y) / dt, duck.speed * 0.9);
    duck.y = scrollY;
    duck.t = now;
    if (!duck.frame) duck.frame = requestAnimationFrame(settle);
  }, { passive: true });

  window.GGStage = function (scrn, opts) {
    opts = opts || {};
    scrn.innerHTML =
      '<div class="desk">' +
        '<div class="appwin" style="left:' + APP.x + "px;top:" + APP.y + "px;width:" + APP.w + "px;height:" + APP.h + 'px"><iframe tabindex="-1" title="Git Gud" width="' + APP.w + '" height="' + APP.h + '"></iframe></div>' +
        '<div class="tw">' +
          '<div class="tbar"><span class="lights"><i></i><i></i><i></i></span><span class="ttl">' + FOLDER + "<span>ada — -zsh — 80×24</span></span></div>" +
          '<div class="tbody"></div>' +
          '<input class="tin" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Terminal" tabindex="-1">' +
        "</div>" +
        '<div class="hint" aria-live="polite"></div>' +
        '<div class="cursor">' + ARROW + "</div>" +
      "</div>";

    var desk = scrn.querySelector(".desk");
    var appwin = desk.querySelector(".appwin"), frame = appwin.querySelector("iframe");
    var term = desk.querySelector(".tw"), tbody = desk.querySelector(".tbody"), tin = desk.querySelector(".tin");
    var cursor = desk.querySelector(".cursor"), hint = desk.querySelector(".hint");

    new ResizeObserver(function () { desk.style.transform = "scale(" + scrn.clientWidth / W + ")"; }).observe(scrn);

    /* Until the app has drawn its first screen, its window shows a still of
     * that screen (opts.poster) instead of an empty, black frame. */
    if (opts.poster) appwin.style.backgroundImage = "url(" + opts.poster + ")";

    /* The app is ~500 kB. The hero asks for it once the page has loaded; the
     * course when it is a screen or two away, and never before the hero's
     * copy has arrived, so on a slow connection the two don't race. */
    var ready = new Promise(function (resolve) {
      addEventListener("message", function (e) {
        if (e.source !== frame.contentWindow || !e.data || e.data.type !== "gitgud-demo-ready") return;
        resolve();
        /* The script is in, but nothing is drawn until a scene sets the app up;
         * lift the poster only once something has been, a frame later. */
        var app = frame.contentDocument.getElementById("root");
        var lift = function () { requestAnimationFrame(function () { requestAnimationFrame(function () { scrn.classList.add("live"); }); }); };
        if (app.childElementCount) lift();
        else new MutationObserver(function (_, mo) { if (app.childElementCount) { mo.disconnect(); lift(); } }).observe(app, { childList: true });
      });
      var load = function (after) {
        queue = queue.then(function () { return after; }).then(function () { frame.src = "demo/demo.html"; return ready; });
      };
      if (opts.load === "now") {
        // Takes its place in the queue now; asks for the app once the page itself has loaded.
        load(document.readyState === "complete" ? null : new Promise(function (r) { addEventListener("load", r, { once: true }); }));
      } else {
        new IntersectionObserver(function (es, io) {
          if (!es.some(function (e) { return e.isIntersecting; })) return;
          io.disconnect();
          load();
        }, { rootMargin: "1200px 0px" }).observe(scrn);
      }
    });

    var S = { scrn: scrn, desk: desk, appwin: appwin, term: term, frame: frame, ready: ready, reduce: reduce, HOME: HOME };
    S.app = function () { return frame.contentWindow.demo; };
    S.doc = function () { return frame.contentDocument; };
    S.volume = function (v) {
      var a = frame.contentWindow && frame.contentWindow.demo;
      if (a && a.volume) a.volume(v);
    };
    duck.stages.push(S);
    ready.then(function () { S.volume(duck.v); });

    /* ---------- the runner ---------- */

    var token = 0, STOP = {};
    /* Paused while the stage is scrolled away (the page says so) or the tab is hidden. */
    var paused = false, away = false;
    function sync() {
      paused = away || document.hidden;
      scrn.classList.toggle("paused", paused);
    }
    document.addEventListener("visibilitychange", sync);
    S.pause = function () { away = true; sync(); };
    S.resume = function () { away = false; sync(); };
    S.play = function (scene) {
      var my = ++token;
      /* Every wait runs on the stage's own clock, which stands still while the
       * stage is paused (scrolled away, tab hidden), so a scene picks up
       * exactly where it was instead of timing out or starting over. */
      function tick(each) {
        return new Promise(function (resolve, reject) {
          var last = performance.now();
          (function step() {
            if (my !== token) return reject(STOP);
            var now = performance.now(), dt = paused ? 0 : now - last;
            last = now;
            var v;
            try { v = each(dt); } catch (e) { return reject(e); }
            if (v) return resolve(v);
            setTimeout(step, paused ? 200 : 50);
          })();
        });
      }
      var c = {
        /* pacing: skipped under reduced motion */
        w: function (ms) {
          if (reduce) return Promise.resolve().then(function () { if (my !== token) throw STOP; });
          var left = ms;
          return tick(function (dt) { left -= dt; return left <= 0; });
        },
        /* the app's own time (its 2.5 s watch, a render): always waited for */
        until: function (test, ms) {
          var left = ms || 15000; // generous: a phone can take seconds over its first render
          return tick(function (dt) {
            if (paused) return null;
            var v = null;
            try { v = test(); } catch (e) { /* not rendered yet */ }
            if (v) return v;
            if ((left -= dt) <= 0) throw new Error("stage.js: gave up waiting for " + test);
            return null;
          });
        },
      };
      return ready.then(function () { return scene(c); }).then(function () { return true; }, function (e) {
        if (e !== STOP) console.error(e);
        return false;
      });
    };
    S.stop = function () { token++; };

    /* ---------- the hands ---------- */

    S.moveTo = function (x, y) { cursor.style.transform = "translate(" + x + "px," + y + "px)"; };
    /* Centre of an element in the app, in desktop pixels. */
    S.inApp = function (el, dx, dy) {
      var r = el.getBoundingClientRect();
      return [APP.x + r.left + (dx == null ? r.width / 2 : dx), APP.y + r.top + (dy == null ? r.height / 2 : dy)];
    };
    S.point = function (c, xy) { S.moveTo(xy[0], xy[1]); return c.w(720); };

    /* Raise a window the way clicking one does on a Mac. */
    S.focus = function (win) {
      appwin.classList.toggle("front", win === appwin);
      term.classList.toggle("front", win === term);
    };

    function press(c) {
      cursor.classList.add("dn");
      return c.w(120).then(function () { cursor.classList.remove("dn"); return c.w(140); });
    }
    /* A full pointer sequence: Base UI menus open on pointerdown, buttons on click. */
    S.clickApp = function (c, el) {
      var w = el.ownerDocument.defaultView, r = el.getBoundingClientRect();
      var o = { bubbles: true, cancelable: true, composed: true, view: w, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, pointerId: 1, pointerType: "mouse", isPrimary: true };
      return S.point(c, S.inApp(el)).then(function () {
        S.focus(appwin);
        el.dispatchEvent(new w.PointerEvent("pointerover", o));
        el.dispatchEvent(new w.PointerEvent("pointerdown", Object.assign({ buttons: 1 }, o)));
        el.dispatchEvent(new w.MouseEvent("mousedown", Object.assign({ buttons: 1 }, o)));
        return press(c);
      }).then(function () {
        el.dispatchEvent(new w.PointerEvent("pointerup", o));
        el.dispatchEvent(new w.MouseEvent("mouseup", o));
        el.dispatchEvent(new w.MouseEvent("click", o));
      });
    };
    S.clickTerm = function (c) {
      return S.point(c, [term.offsetLeft + 200, term.offsetTop + 150]).then(function () { S.focus(term); return press(c); });
    };
    /* Type into a React-controlled field in the app, a key at a time. */
    S.typeApp = function (c, input, text) {
      var w = input.ownerDocument.defaultView, set = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set, i = 0;
      function key() {
        if (i > text.length) return c.w(300);
        set.call(input, text.slice(0, i++));
        input.dispatchEvent(new w.Event("input", { bubbles: true }));
        return c.w(70 + Math.random() * 60).then(key);
      }
      return key();
    };

    /* Scroll the app's own pane (never the page) so `el` sits mid-window. */
    S.scrollApp = function (c, el) {
      var main = S.doc().querySelector("main"), mr = main.getBoundingClientRect(), er = el.getBoundingClientRect();
      var top = main.scrollTop + er.top - mr.top - Math.max(24, (mr.height - er.height) / 2);
      main.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
      return c.w(700);
    };

    /* ---------- the Terminal ---------- */

    var cwd = HOME, typing = null;
    var shown = function (p) { return p === HOME ? "~" : p.slice(p.lastIndexOf("/") + 1); };
    function line(html, cls) {
      var d = document.createElement("div");
      d.className = "ln" + (cls ? " " + cls : "");
      d.innerHTML = html;
      tbody.appendChild(d);
      tbody.scrollTop = tbody.scrollHeight;
      return d;
    }
    function out(text) {
      if (text) text.split("\n").forEach(function (o) { line(esc(o) || "&nbsp;", "out"); });
    }
    function prompt(dir) {
      if (dir) cwd = dir;
      Array.prototype.forEach.call(tbody.querySelectorAll(".caret"), function (n) { n.remove(); });
      var d = line("ada@MacBook-Air " + esc(shown(cwd)) + ' % <span class="in"></span><span class="caret"></span>');
      typing = d.querySelector(".in");
    }
    S.clearTerm = function (dir) {
      tbody.innerHTML = "";
      line("Last login: Thu Nov 12 09:40:12 on ttys000");
      prompt(dir ? HOME + "/" + dir : HOME);
    };
    /* A scene types a command, presses return, prints its output, then lets
     * the fake computer know what it did (`effect`) so the app's checks see it. */
    S.run = function (c, cmd, output, effect, nextDir) {
      var i = 0;
      function key() {
        if (i < cmd.length && !reduce) {
          typing.textContent += cmd[i++];
          return c.w(36 + Math.random() * 50).then(key);
        }
        typing.textContent = cmd;
        return c.w(240).then(function () {
          S.app().ran(cmd);
          if (effect) effect(S.app());
          out(output);
          prompt(nextDir ? HOME + "/" + nextDir : null);
          return c.w(420);
        });
      }
      return key();
    };

    /* The visitor's shell: the commands the first two modules teach, played
     * against the same pretend computer. Anything else says so plainly. */
    var abs = function (p) {
      if (!p || p === "~") return HOME;
      if (p.indexOf("~/") === 0) return HOME + p.slice(1);
      var parts = (p[0] === "/" ? [] : cwd.split("/").slice(1)).concat(p.split("/"));
      var stack = [];
      parts.forEach(function (s) { if (s === "..") stack.pop(); else if (s && s !== ".") stack.push(s); });
      return "/" + stack.join("/");
    };
    function stamp() {
      var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
      return d.toDateString().slice(0, 10) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()) + " " + d.getFullYear();
    }
    S.exec = function (raw) {
      var cmd = raw.trim();
      typing.textContent = raw;
      if (!cmd) return prompt();
      var a = S.app(), args = cmd.match(/"[^"]*"|'[^']*'|\S+/g).map(function (s) { return s.replace(/^["']|["']$/g, ""); });
      var name = args[0], rest = args.slice(1), dir;
      a.ran(cmd);
      switch (name) {
        case "whoami": out("ada"); break;
        case "date": out(stamp()); break;
        case "pwd": out(cwd); break;
        case "echo": out(rest.join(" ")); break;
        case "ls": out((a.ls(abs(rest.filter(function (r) { return r[0] !== "-"; })[0] || ".")) || []).join("  ")); break;
        case "cd":
          dir = abs(rest[0]);
          if (a.exists(dir)) cwd = dir; else out("cd: no such file or directory: " + rest[0]);
          break;
        case "mkdir": rest.filter(function (r) { return r[0] !== "-"; }).forEach(function (r) { a.mkdir(abs(r)); }); break;
        case "touch": rest.forEach(function (r) { a.touch(abs(r)); }); break;
        case "clear": tbody.innerHTML = ""; break;
        case "exit": out("\nSaving session...\n...completed.\n\n[Process completed]"); return setTimeout(function () { S.clearTerm(); }, 1400);
        case "git":
          if (rest[0] === "--version") out("git version 2.47.1");
          else out("This demo plays the first lessons only. Git Gud checks the real git on your computer.");
          break;
        default: out("zsh: command not found: " + name);
      }
      prompt();
      if (S.onCommand) S.onCommand(name, cmd);
    };

    /* ---------- the visitor at the wheel ---------- */

    tin.addEventListener("input", function () { typing.textContent = tin.value; });
    tin.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      S.exec(tin.value);
      tin.value = "";
    });
    /* Keys go to a hidden field; keep focus there rather than on the click target. */
    term.addEventListener("mousedown", function (e) {
      if (!S.driving) return;
      e.preventDefault();
      S.focus(term);
      tin.focus({ preventScroll: true });
    });
    /* A click into the app raises it, as on a Mac. */
    frame.addEventListener("load", function () {
      frame.contentDocument.addEventListener("pointerdown", function () { if (S.driving) S.focus(appwin); }, true);
    });

    S.drive = function (on) {
      S.driving = on;
      S.stop();
      scrn.classList.toggle("steer", on);
      frame.tabIndex = on ? 0 : -1;
      tin.tabIndex = on ? 0 : -1;
      if (!on) { tin.blur(); S.say(""); }
    };

    /* A quiet, numbered nudge on the desktop, in Cap's manner: one at a time. */
    S.say = function (html, xy, n) {
      hint.classList.remove("up");
      if (!html) return;
      hint.innerHTML = (n ? '<span class="hn">' + n + "</span>" : "") + "<span>" + html + "</span>";
      hint.style.transform = "translate(" + xy[0] + "px," + xy[1] + "px)";
      void hint.offsetWidth;
      hint.classList.add("up");
    };

    /* ---------- finding things in the app ---------- */

    S.q = function (sel, text) {
      return Array.prototype.find.call(S.doc().querySelectorAll(sel), function (n) {
        return n.getClientRects().length && (!text || text.test(n.textContent.trim()));
      });
    };
    S.verifyButton = function () { return S.q("main button", /^(Verify|Check again|Checking)/); };
    S.verifyBlock = function () { var b = S.verifyButton(); return b && b.closest("section"); };
    S.ticks = function (n) { return function () { var s = S.verifyBlock(); return s && s.querySelectorAll("li .gg-tick").length >= n; }; };
    S.win = function () { return S.q(".gg-win button.gg-raised"); };

    /* Lay out a scene in the app, clear the Terminal, bring the checks into view. */
    S.begin = function (c, scene, dir) {
      S.app().reset(scene);
      S.clearTerm(dir);
      S.focus(appwin);
      S.moveTo(640, 470);
      return c.until(S.verifyButton).then(function (b) { return c.w(500).then(function () { return S.scrollApp(c, b.closest("section")); }); });
    };
    /* The real celebration: let each screen land, then press Continue until it closes. */
    S.celebrate = function (c) {
      function next(n) {
        var b = S.win();
        if (!b || n > 3) return c.w(1600);
        return c.w(1900).then(function () { return S.clickApp(c, b); }).then(function () { return c.w(500); }).then(function () { return next(n + 1); });
      }
      return c.until(S.win, 18000).then(function () { return next(0); });
    };

    S.clearTerm();
    S.moveTo(640, 470);
    return S;
  };
})();
