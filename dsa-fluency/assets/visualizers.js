/* ============================================================
   Animated visualizers for dsa-fluency.
   Vanilla JS / SVG. No build step. Each component is a tiny class
   exposed on window.DSAViz so any lesson can call it.

   Public API:
     DSAViz.bigO(target, opts)                         // animated growth curves
     DSAViz.arrayViz(target, items, opts)              // returns {highlight, swap, reset, items, ...}
     DSAViz.hashMap(target, capacity, hashFn?)         // returns {put, get, reset}
     DSAViz.linkedList(target, items)                  // returns {nodes, highlight, reset}
     DSAViz.binaryTree(target, root)                   // returns {visit, reset}
     DSAViz.heap(target, items)                        // returns {push, pop, items}
     DSAViz.graph(target, nodes, edges, opts)          // returns {bfs, dfs, reset}

   Each viz function fills `target` with markup and returns a small
   controller. Most accept a "narrate" callback the caller can use to
   wire to a side-panel narration string.
   ============================================================ */
(function () {
  var DSAViz = {};
  var SLOW = 600;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* -------- Big-O comparative growth chart -------- */
  DSAViz.bigO = function (target, opts) {
    opts = opts || {};
    var W = 540, H = 320, PAD = 40;
    target.classList.add("viz");
    target.innerHTML = '<div class="viz-title">Big-O · how fast each curve grows</div><div class="viz-stage"></div>';
    var stage = target.querySelector(".viz-stage");
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "viz-bigo" }, stage);

    var max = 60;  // input size axis goes 0..max
    var maxY = 1000;

    // grid + axes
    for (var i = 0; i <= 5; i++) {
      var y = PAD + (H - 2 * PAD) * i / 5;
      svgEl("line", { class: "grid", x1: PAD, x2: W - PAD, y1: y, y2: y }, svg);
    }
    svgEl("line", { class: "axis", x1: PAD, y1: H - PAD, x2: W - PAD, y2: H - PAD }, svg);
    svgEl("line", { class: "axis", x1: PAD, y1: PAD, x2: PAD, y2: H - PAD }, svg);
    svgEl("text", { class: "axis-label", x: W / 2, y: H - 10, "text-anchor": "middle" }, svg).textContent = "input size n →";
    var ylabel = svgEl("text", { class: "axis-label", x: 8, y: PAD + 6, transform: "rotate(0)" }, svg);
    ylabel.textContent = "ops";

    var fns = [
      { id: "logn",  label: "O(log n)", color: "#5eead4", f: function (n) { return n < 2 ? 1 : Math.log2(n); } },
      { id: "n",     label: "O(n)",     color: "#86efac", f: function (n) { return n; } },
      { id: "nlogn", label: "O(n log n)", color: "#fbbf24", f: function (n) { return n < 2 ? n : n * Math.log2(n); } },
      { id: "n2",    label: "O(n²)",    color: "#f472b6", f: function (n) { return n * n; } },
      { id: "2n",    label: "O(2ⁿ)",    color: "#f87171", f: function (n) { return Math.pow(2, n); } }
    ];

    function pointStr(f) {
      var pts = [];
      for (var n = 0; n <= max; n += 1) {
        var v = f(n);
        if (!isFinite(v)) v = maxY;
        v = Math.min(v, maxY);
        var x = PAD + (W - 2 * PAD) * (n / max);
        var y = (H - PAD) - (H - 2 * PAD) * (v / maxY);
        pts.push(x.toFixed(1) + "," + y.toFixed(1));
      }
      return pts.join(" ");
    }

    // For each curve, find a label position. Curves that hit the top of the
    // chart get their label where they exit (top edge). Curves that stay below
    // the ceiling get their label at the right edge. After computing, sweep
    // top-to-bottom and bump any label that's too close to the previous one
    // so they never collide.
    function labelPos(fn) {
      // sample finely; find first n where curve crosses the ceiling
      for (var n = 0; n <= max; n += 0.25) {
        if (fn.f(n) >= maxY) {
          var x = PAD + (W - 2 * PAD) * (n / max);
          return { x: x, y: PAD + 12, anchor: "start", atTop: true };
        }
      }
      // never hit ceiling — label at right edge, at curve height
      var v = Math.min(fn.f(max), maxY);
      var x = W - PAD - 6;
      var y = (H - PAD) - (H - 2 * PAD) * (v / maxY);
      return { x: x, y: Math.max(PAD + 12, y - 4), anchor: "end", atTop: false };
    }

    var labelInfos = fns.map(function (fn, i) {
      return Object.assign({ fn: fn, i: i }, labelPos(fn));
    });

    // Resolve top-edge label collisions: nudge subsequent labels right.
    var topLabels = labelInfos.filter(function (l) { return l.atTop; }).sort(function (a, b) { return a.x - b.x; });
    var minGap = 70;   // pixel gap between top-exit labels
    for (var k = 1; k < topLabels.length; k++) {
      if (topLabels[k].x - topLabels[k - 1].x < minGap) {
        topLabels[k].x = topLabels[k - 1].x + minGap;
      }
    }
    // Make sure top labels don't run off the right edge.
    topLabels.forEach(function (l) {
      if (l.x > W - PAD - 6) { l.x = W - PAD - 6; l.anchor = "end"; }
    });

    fns.forEach(function (fn, i) {
      var path = svgEl("polyline", { class: "curve", points: pointStr(fn.f), stroke: fn.color }, svg);
      var len = path.getTotalLength ? path.getTotalLength() : 1000;
      path.setAttribute("stroke-dasharray", len + " " + len);
      path.setAttribute("stroke-dashoffset", len);
      path.style.transition = "stroke-dashoffset 1.4s ease-out " + (i * 220) + "ms";
      requestAnimationFrame(function () { path.setAttribute("stroke-dashoffset", "0"); });

      var info = labelInfos[i];
      svgEl("text", { class: "curve-label", x: info.x, y: info.y, fill: fn.color, "text-anchor": info.anchor }, svg).textContent = fn.label;
    });

    return { svg: svg };
  };

  /* -------- Array visualizer -------- */
  DSAViz.arrayViz = function (target, items, opts) {
    opts = opts || {};
    target.classList.add("viz");
    target.innerHTML = '<div class="viz-title"><span>' + (opts.title || "Array") + '</span><span class="narration faint mono"></span></div><div class="viz-stage"><div class="viz-row"></div></div>';
    var row = target.querySelector(".viz-row");
    var nar = target.querySelector(".narration");
    var data = items.slice();

    function render() {
      row.innerHTML = "";
      data.forEach(function (v, i) {
        var c = el("div", "viz-cell");
        c.dataset.idx = i;
        c.innerHTML = '<span class="val">' + v + '</span><span class="idx">' + i + '</span>';
        row.appendChild(c);
      });
    }
    render();

    function cells() { return row.querySelectorAll(".viz-cell"); }
    function clearMarks() { cells().forEach(function (c) { c.classList.remove("active", "compare", "match", "swap", "faded"); }); }
    function mark(indices, kind) {
      clearMarks();
      indices.forEach(function (i) {
        var c = row.children[i];
        if (c) c.classList.add(kind);
      });
    }
    function narrate(s) { if (nar) nar.textContent = s || ""; }

    function swap(i, j) {
      mark([i, j], "swap");
      return sleep(SLOW / 2).then(function () {
        var t = data[i]; data[i] = data[j]; data[j] = t;
        render();
        mark([i, j], "swap");
        return sleep(SLOW);
      });
    }

    return {
      data: data,
      mark: mark,
      narrate: narrate,
      swap: swap,
      reset: function (next) { data = (next || items).slice(); render(); }
    };
  };

  /* -------- Hash map -------- */
  DSAViz.hashMap = function (target, capacity, hashFn) {
    capacity = capacity || 7;
    hashFn = hashFn || function (k) {
      var s = String(k), h = 0;
      for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return h % capacity;
    };
    target.classList.add("viz");
    target.innerHTML = '<div class="viz-title"><span>Hash map (chaining, ' + capacity + ' buckets)</span><span class="narration faint mono"></span></div><div class="viz-stage"></div>';
    var stage = target.querySelector(".viz-stage");
    var nar = target.querySelector(".narration");
    var buckets = [];
    for (var i = 0; i < capacity; i++) buckets.push([]);

    function render(activeBucket, hotKey) {
      stage.innerHTML = "";
      for (var i = 0; i < capacity; i++) {
        var b = el("div", "viz-bucket" + (i === activeBucket ? " active" : ""));
        b.appendChild(el("div", "bidx", "[" + i + "]"));
        var bar = el("div", "bbar");
        buckets[i].forEach(function (kv) {
          var item = el("span", "item" + (hotKey != null && kv.k === hotKey ? " hot" : ""));
          item.textContent = kv.k + "→" + kv.v;
          bar.appendChild(item);
        });
        b.appendChild(bar);
        stage.appendChild(b);
      }
    }
    render(-1);

    function narrate(s) { if (nar) nar.textContent = s || ""; }

    function put(k, v) {
      var i = hashFn(k);
      narrate("hash(" + k + ") → bucket " + i);
      var found = buckets[i].find(function (kv) { return kv.k === k; });
      if (found) found.v = v; else buckets[i].push({ k: k, v: v });
      render(i, k);
      return sleep(SLOW);
    }
    function get(k) {
      var i = hashFn(k);
      narrate("lookup " + k + " → bucket " + i);
      var found = buckets[i].find(function (kv) { return kv.k === k; });
      render(i, k);
      return Promise.resolve(found ? found.v : undefined);
    }
    return {
      put: put, get: get, narrate: narrate,
      reset: function () { buckets = []; for (var i = 0; i < capacity; i++) buckets.push([]); render(-1); }
    };
  };

  /* -------- Linked list -------- */
  DSAViz.linkedList = function (target, items) {
    target.classList.add("viz");
    target.innerHTML = '<div class="viz-title"><span>Singly linked list</span><span class="narration faint mono"></span></div><div class="viz-stage"><div class="viz-list"></div></div>';
    var list = target.querySelector(".viz-list");
    var nar = target.querySelector(".narration");

    function render(data) {
      list.innerHTML = "";
      data.forEach(function (v, i) {
        var n = el("div", "viz-node");
        n.dataset.idx = i;
        n.innerHTML = '<span class="val">' + v + '</span><span class="next">' + (i === data.length - 1 ? "∅" : "→") + '</span>';
        list.appendChild(n);
        if (i !== data.length - 1) {
          var arrow = el("span", "viz-arrow");
          arrow.textContent = "→";
          list.appendChild(arrow);
        }
      });
    }
    var data = items.slice();
    render(data);

    function highlight(i, kind) {
      Array.prototype.forEach.call(list.querySelectorAll(".viz-node"), function (n) { n.classList.remove("active", "match"); });
      var n = list.querySelectorAll(".viz-node")[i];
      if (n) n.classList.add(kind || "active");
    }
    function narrate(s) { if (nar) nar.textContent = s || ""; }
    return { highlight: highlight, narrate: narrate, render: function (d) { data = d.slice(); render(data); } };
  };

  /* -------- Binary tree -------- */
  DSAViz.binaryTree = function (target, root) {
    target.classList.add("viz");
    target.innerHTML = '<div class="viz-title"><span>Binary tree</span><span class="narration faint mono"></span></div><div class="viz-stage"></div>';
    var stage = target.querySelector(".viz-stage");
    var nar = target.querySelector(".narration");

    var W = 560, H = 320;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "viz-tree-svg" }, stage);

    var nodeMap = {};
    function depth(n) {
      if (!n) return 0;
      return 1 + Math.max(depth(n.left), depth(n.right));
    }
    var d = depth(root);
    var levelH = (H - 30) / Math.max(d, 1);

    function place(n, x0, x1, level) {
      if (!n) return;
      var x = (x0 + x1) / 2, y = 30 + level * levelH;
      n._x = x; n._y = y;
      if (n.left)  { svgEl("line", { class: "viz-tree-edge", x1: x, y1: y, x2: (x0 + x) / 2, y2: y + levelH }, svg); place(n.left,  x0, x, level + 1); }
      if (n.right) { svgEl("line", { class: "viz-tree-edge", x1: x, y1: y, x2: (x + x1) / 2, y2: y + levelH }, svg); place(n.right, x, x1, level + 1); }
    }
    place(root, 20, W - 20, 0);

    function drawNodes(n) {
      if (!n) return;
      var g = svgEl("g", { class: "viz-tree-node", "data-id": n.val }, svg);
      svgEl("circle", { cx: n._x, cy: n._y, r: 17 }, g);
      svgEl("text", { x: n._x, y: n._y + 1 }, g).textContent = n.val;
      nodeMap[n.val] = g;
      drawNodes(n.left); drawNodes(n.right);
    }
    drawNodes(root);

    function visit(val, kind) {
      var g = nodeMap[val];
      if (!g) return;
      g.classList.remove("active", "visited");
      g.classList.add(kind || "active");
    }
    function reset() {
      Object.keys(nodeMap).forEach(function (k) { nodeMap[k].classList.remove("active", "visited"); });
    }
    function narrate(s) { if (nar) nar.textContent = s || ""; }
    return { visit: visit, reset: reset, narrate: narrate, root: root };
  };

  /* -------- Heap -------- */
  DSAViz.heap = function (target, items) {
    target.classList.add("viz");
    target.innerHTML = '<div class="viz-title"><span>Min-heap</span><span class="narration faint mono"></span></div><div class="viz-stage"></div><div class="viz-controls"><div class="narration faint mono" data-arr></div></div>';
    var stage = target.querySelector(".viz-stage");
    var arrLine = target.querySelector("[data-arr]");
    var nar = target.querySelector(".viz-title .narration");
    var W = 540, H = 240;
    var heap = items.slice();

    function render(activeIdx) {
      stage.innerHTML = "";
      var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "viz-tree-svg" }, stage);
      var n = heap.length;
      var levels = Math.floor(Math.log2(Math.max(n, 1))) + 1;
      var levelH = (H - 30) / Math.max(levels, 1);
      var pos = [];
      for (var i = 0; i < n; i++) {
        var lvl = Math.floor(Math.log2(i + 1));
        var idxInLvl = (i + 1) - (1 << lvl);
        var slots = (1 << lvl);
        var x = (W) * (idxInLvl + 0.5) / slots;
        var y = 30 + lvl * levelH;
        pos.push({ x: x, y: y });
      }
      for (var i = 1; i < n; i++) {
        var p = (i - 1) >> 1;
        svgEl("line", { class: "viz-tree-edge", x1: pos[p].x, y1: pos[p].y, x2: pos[i].x, y2: pos[i].y }, svg);
      }
      for (var i = 0; i < n; i++) {
        var g = svgEl("g", { class: "viz-tree-node" + (i === activeIdx ? " active" : "") }, svg);
        svgEl("circle", { cx: pos[i].x, cy: pos[i].y, r: 17 }, g);
        svgEl("text", { x: pos[i].x, y: pos[i].y + 1 }, g).textContent = heap[i];
      }
      arrLine.textContent = "array view: [" + heap.join(", ") + "]";
    }
    render(-1);
    function narrate(s) { if (nar) nar.textContent = s || ""; }

    function bubbleUp(i) {
      while (i > 0) {
        var p = (i - 1) >> 1;
        if (heap[i] < heap[p]) {
          render(i);
          var t = heap[i]; heap[i] = heap[p]; heap[p] = t;
          i = p;
        } else break;
      }
      render(i);
    }
    function bubbleDown(i) {
      var n = heap.length;
      while (true) {
        var l = 2 * i + 1, r = 2 * i + 2, m = i;
        if (l < n && heap[l] < heap[m]) m = l;
        if (r < n && heap[r] < heap[m]) m = r;
        if (m === i) break;
        var t = heap[i]; heap[i] = heap[m]; heap[m] = t;
        i = m;
        render(i);
      }
    }
    function push(v) {
      narrate("push " + v + " — bubble up");
      heap.push(v);
      bubbleUp(heap.length - 1);
      return sleep(SLOW);
    }
    function pop() {
      if (!heap.length) return undefined;
      var top = heap[0];
      narrate("pop " + top + " — bubble down");
      var last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        bubbleDown(0);
      } else {
        render(-1);
      }
      return top;
    }
    return { push: push, pop: pop, items: function () { return heap.slice(); }, narrate: narrate };
  };

  /* -------- Graph (force-free fixed positions, BFS/DFS animation) -------- */
  DSAViz.graph = function (target, nodes, edges, opts) {
    opts = opts || {};
    target.classList.add("viz");
    target.innerHTML = '<div class="viz-title"><span>' + (opts.title || "Graph") + '</span><span class="narration faint mono"></span></div><div class="viz-stage"></div>';
    var stage = target.querySelector(".viz-stage");
    var nar = target.querySelector(".narration");
    var W = 540, H = 320;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "viz-tree-svg" }, stage);
    var pos = {};
    nodes.forEach(function (n, i) {
      if (n.x != null && n.y != null) {
        pos[n.id] = { x: n.x, y: n.y };
      } else {
        var angle = (i / nodes.length) * Math.PI * 2;
        pos[n.id] = { x: W / 2 + Math.cos(angle) * 110, y: H / 2 + Math.sin(angle) * 110 };
      }
    });
    var edgeMap = {};
    edges.forEach(function (e) {
      var a = pos[e.from], b = pos[e.to];
      var ln = svgEl("line", { class: "viz-tree-edge", x1: a.x, y1: a.y, x2: b.x, y2: b.y }, svg);
      edgeMap[e.from + "-" + e.to] = ln;
      edgeMap[e.to + "-" + e.from] = ln;
    });
    var nodeMap = {};
    nodes.forEach(function (n) {
      var g = svgEl("g", { class: "viz-tree-node" }, svg);
      svgEl("circle", { cx: pos[n.id].x, cy: pos[n.id].y, r: 17 }, g);
      svgEl("text", { x: pos[n.id].x, y: pos[n.id].y + 1 }, g).textContent = n.label || n.id;
      nodeMap[n.id] = g;
    });
    function adj(id) {
      return edges.filter(function (e) { return e.from === id; }).map(function (e) { return e.to; })
        .concat(opts.directed ? [] : edges.filter(function (e) { return e.to === id; }).map(function (e) { return e.from; }));
    }
    function reset() { Object.keys(nodeMap).forEach(function (k) { nodeMap[k].classList.remove("active", "visited"); }); }
    function visit(id, kind) {
      var g = nodeMap[id];
      if (!g) return;
      g.classList.remove("active", "visited");
      g.classList.add(kind || "visited");
    }
    function narrate(s) { if (nar) nar.textContent = s || ""; }
    function bfs(start) {
      reset();
      var q = [start], seen = {}; seen[start] = 1;
      var step = 0;
      function tick() {
        if (!q.length) return Promise.resolve();
        var v = q.shift();
        narrate("visit " + v + " · queue: [" + q.join(",") + "]");
        visit(v, "active");
        return sleep(SLOW).then(function () {
          visit(v, "visited");
          adj(v).forEach(function (u) { if (!seen[u]) { seen[u] = 1; q.push(u); } });
          step++;
          return tick();
        });
      }
      return tick();
    }
    function dfs(start) {
      reset();
      var seen = {};
      function go(v) {
        if (seen[v]) return Promise.resolve();
        seen[v] = 1;
        narrate("visit " + v);
        visit(v, "active");
        return sleep(SLOW).then(function () {
          visit(v, "visited");
          var nbrs = adj(v);
          return nbrs.reduce(function (p, u) { return p.then(function () { return go(u); }); }, Promise.resolve());
        });
      }
      return go(start);
    }
    return { bfs: bfs, dfs: dfs, reset: reset, narrate: narrate };
  };

  window.DSAViz = DSAViz;
})();
