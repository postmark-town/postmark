(function () {
  'use strict';

  var DATA = JSON.parse(document.getElementById('party-hall-data').textContent || '{}');
  var gifts = DATA.gifts || [];
  var games = DATA.games || [];
  var decorations = DATA.decorations || [];
  var chat = DATA.chat || [];

  var PALETTE = ['#b5432f', '#2f7a5c', '#6a4a72', '#c08a2e', '#2f6f7a'];

  // ---------- small deterministic RNG, seeded per-handle ----------
  // Same idea as the Herbarium's growth: a resident's decoration should
  // look the same every time you visit, not re-roll on each page load.
  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length) % arr.length];
  }

  // ---------- carousel ----------
  var panelOrder = ['gifts', 'games', 'decorations'];
  var panelIndex = 0;
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var panels = panelOrder.map(function (name) { return document.getElementById('panel-' + name); });
  var dots = Array.prototype.slice.call(document.querySelectorAll('.dot'));
  var carousel = document.querySelector('.carousel');

  function showPanel(index) {
    panelIndex = (index + panelOrder.length) % panelOrder.length;
    panels.forEach(function (p, i) { p.classList.toggle('active', i === panelIndex); });
    tabs.forEach(function (t, i) { t.classList.toggle('active', i === panelIndex); });
    dots.forEach(function (d, i) { d.classList.toggle('active', i === panelIndex); });
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { showPanel(i); resetAutoRotate(); });
  });
  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { showPanel(i); resetAutoRotate(); });
  });
  document.querySelector('.car-nav.prev').addEventListener('click', function () {
    showPanel(panelIndex - 1); resetAutoRotate();
  });
  document.querySelector('.car-nav.next').addEventListener('click', function () {
    showPanel(panelIndex + 1); resetAutoRotate();
  });

  var autoRotateTimer = null;
  function startAutoRotate() {
    autoRotateTimer = setInterval(function () { showPanel(panelIndex + 1); }, 9000);
  }
  function resetAutoRotate() {
    clearInterval(autoRotateTimer);
    startAutoRotate();
  }
  carousel.addEventListener('mouseenter', function () { clearInterval(autoRotateTimer); });
  carousel.addEventListener('mouseleave', startAutoRotate);

  // ---------- gifts ----------
  var giftGrid = document.getElementById('gift-grid');
  var giftEmpty = document.getElementById('gift-empty');
  var modalBackdrop = document.getElementById('gift-modal-backdrop');
  var modalBody = document.getElementById('gift-modal-body');

  function openGiftModal(gift) {
    var html = '<h3>' + escapeHtml(gift.name || gift.handle) + '’s gift</h3>';
    var g = gift.gift || { type: 'none' };
    if (g.type === 'image' && g.value) {
      html += '<img src="' + escapeAttr(g.value) + '" alt="' + escapeAttr(gift.name || gift.handle) + '’s gift">';
      if (g.caption) html += '<p class="gift-text">' + escapeHtml(g.caption) + '</p>';
    } else if (g.type === 'text' && g.value) {
      html += '<p class="gift-text">' + escapeHtml(g.value) + '</p>';
    } else {
      html += '<p class="gift-none">Nothing to unwrap here — that’s the gift.</p>';
    }
    modalBody.innerHTML = html;
    modalBackdrop.hidden = false;
  }

  document.getElementById('gift-modal-close').addEventListener('click', function () {
    modalBackdrop.hidden = true;
  });
  modalBackdrop.addEventListener('click', function (e) {
    if (e.target === modalBackdrop) modalBackdrop.hidden = true;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      modalBackdrop.hidden = true;
      var agmb = document.getElementById('add-game-modal-backdrop');
      if (agmb) agmb.hidden = true;
    }
  });

  if (gifts.length === 0) {
    giftEmpty.hidden = false;
  } else {
    giftEmpty.hidden = true;
    gifts.forEach(function (gift, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gift-button' +
        (gift.placeholder ? ' placeholder' : '') +
        (gift.rsvpState === 'pending' ? ' awaiting' : '');
      btn.textContent = gift.buttonLabel || (gift.name || gift.handle) + '’s gift';
      if (gift.rsvpState === 'pending') {
        btn.title = (gift.name || gift.handle) + ' hasn’t answered the invitation yet — the button waits with the door open';
      }
      btn.style.background = gift.buttonColor || PALETTE[i % PALETTE.length];
      btn.addEventListener('click', function () { openGiftModal(gift); });
      giftGrid.appendChild(btn);
    });
  }

  // ---------- games ----------
  var gameGrid = document.getElementById('game-grid');
  var gameEmpty = document.getElementById('game-empty');

  if (games.length === 0) {
    gameEmpty.hidden = false;
  } else {
    gameEmpty.hidden = true;
    games.forEach(function (game) {
      var a = document.createElement('a');
      a.className = 'game-card';
      a.href = game.url;
      a.target = '_blank';
      a.rel = 'noopener';
      var byLine = game.builtin ? 'Party Hall house game' : ('by ' + (game.name && game.handle ? game.handle : game.handle || ''));
      a.innerHTML =
        (game.image ? '<img class="game-thumb" src="' + escapeAttr(game.image) + '" alt="">' : '') +
        '<div class="game-name">' + escapeHtml(game.name || 'Untitled game') + '</div>' +
        '<div class="game-by">' + escapeHtml(byLine) + '</div>' +
        '<div class="game-blurb">' + escapeHtml(game.blurb || '') + '</div>';
      gameGrid.appendChild(a);
    });
  }

  var addGameCard = document.getElementById('add-game-card');
  var addGameModalBackdrop = document.getElementById('add-game-modal-backdrop');
  if (addGameCard) {
    addGameCard.addEventListener('click', function () { addGameModalBackdrop.hidden = false; });
    document.getElementById('add-game-modal-close').addEventListener('click', function () { addGameModalBackdrop.hidden = true; });
    addGameModalBackdrop.addEventListener('click', function (e) {
      if (e.target === addGameModalBackdrop) addGameModalBackdrop.hidden = true;
    });
  }

  // ---------- decorations ----------
  // Each confirmed guest's file holds three pieces (ceiling / side wall /
  // far wall), plus an optional plusOne set. HERB_BASE is where their own
  // page finds the Herbarium tree assets this build extracted — window.html
  // sets a different base before this script runs, since it embeds the same
  // markup from a different folder depth.
  var decoGrid = document.getElementById('decoration-grid');
  var decoEmpty = document.getElementById('decoration-empty');
  var HERB_BASE = window.PARTY_HALL_HERB_BASE || './decorations/assets/herbarium/';

  function herbSrc(handle) { return HERB_BASE + handle + '.svg'; }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    for (var key in attrs) el.setAttribute(key, attrs[key]);
    return el;
  }

  var wallGroups = {
    farWall: document.getElementById('wall-confetti'),
    ceiling: document.getElementById('wall-flowers')
  };
  var wallSideLeft = document.getElementById('wall-triangles-left');
  var wallSideRight = document.getElementById('wall-triangles-right');

  // Currently-hung decoration per region — at most one of each kind at a time.
  var wallState = { farWall: null, ceiling: null, sideWall: null };

  function clearGroup(g) {
    while (g.firstChild) g.removeChild(g.firstChild);
  }

  // ---------- room-view: hung decorations ----------

  // The two ceiling trees start their spin a quarter-turn apart (90° and
  // 270°) rather than in lockstep — a negative animation-delay is just a
  // fraction of the cycle already elapsed at t=0, so this reuses the same
  // `spin` keyframes instead of needing two separate ones.
  var CEILING_SPIN_DURATION = 9;
  var CEILING_START_DEG = [90, 270];

  function renderCeiling(piece) {
    var g = wallGroups.ceiling;
    clearGroup(g);
    var trees = piece.trees && piece.trees.length ? piece.trees : [piece.handle, piece.handle];
    var cx1 = 430, cx2 = 570, cy = 78, w = 92, h = 132;
    g.appendChild(svgEl('line', {
      x1: cx1, y1: cy, x2: cx2, y2: cy,
      stroke: '#8a6d1f', 'stroke-opacity': 0.5, 'stroke-width': 1.5, 'stroke-dasharray': '3,3'
    }));
    // Position and rotation have to live on separate <g>s: a CSS animation
    // that targets `transform` replaces the SVG transform *attribute*
    // outright rather than composing with it, so a single element can't
    // hold both the static translate and the spin.
    [[cx1, trees[0]], [cx2, trees[1] || trees[0]]].forEach(function (pair, i) {
      var pos = svgEl('g', { transform: 'translate(' + pair[0] + ',' + cy + ')' });
      var spin = svgEl('g', { class: 'wall-ceiling-tree' });
      spin.style.animationDelay = (-(CEILING_START_DEG[i] / 360) * CEILING_SPIN_DURATION) + 's';
      var img = svgEl('image', {
        href: herbSrc(pair[1]), x: -w / 2, y: -h * 0.62, width: w, height: h,
        preserveAspectRatio: 'xMidYMid meet'
      });
      spin.appendChild(img);
      pos.appendChild(spin);
      g.appendChild(pos);
    });
  }

  function renderFarWall(piece, font) {
    var g = wallGroups.farWall;
    clearGroup(g);
    var lines = piece.lines || [];
    var colors = PALETTE;
    lines.forEach(function (line, i) {
      var t = svgEl('text', {
        x: 500, y: 0, 'text-anchor': 'middle',
        'font-family': font || 'Georgia, serif',
        'font-size': i === 0 ? 30 : 18,
        fill: colors[i % colors.length],
        class: 'wall-fartext-piece'
      });
      t.style.animationDuration = (7 + i * 1.5) + 's';
      t.style.animationDelay = (-i * 2.4) + 's';
      t.textContent = line;
      g.appendChild(t);
    });
  }

  // Top edge of each side-wall trapezoid, shifted 50px straight down and
  // still parallel to it (same slope, translated) — the line every side-wall
  // piece hangs from, default triangles or a guest's own tree alike.
  var HANG_LINES = {
    left: { x1: 0, y1: 50, x2: 250, y2: 200 },
    right: { x1: 1000, y1: 50, x2: 750, y2: 200 }
  };

  // Walks a line and calls itemFactory(ax, ay, rng) at each stop, appending
  // whatever it returns. Shared by the default triangle-string and the
  // per-guest tree-flail, so both sway off the exact same points.
  function renderHangingLine(g, line, rng, count, itemFactory) {
    clearGroup(g);
    g.appendChild(svgEl('line', {
      x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2,
      stroke: '#6b4c30', 'stroke-opacity': 0.55, 'stroke-width': 2
    }));
    for (var i = 0; i < count; i++) {
      var t = 0.14 + (i / (count - 1)) * 0.72;
      var ax = line.x1 + (line.x2 - line.x1) * t;
      var ay = line.y1 + (line.y2 - line.y1) * t;
      g.appendChild(itemFactory(ax, ay, rng));
    }
  }

  function swayVars(el, rng) {
    el.style.animationDelay = (rng() * 2) + 's';
    var a = -4 - rng() * 6, b = 4 + rng() * 6;
    el.style.setProperty('--sway-a', a + 'deg');
    el.style.setProperty('--sway-b', b + 'deg');
    return el;
  }

  // A guest's own tree, upside down (canopy hanging toward the floor),
  // swaying from the line — the Herbarium-entry replacement for the old
  // string of triangles.
  function treeFlailItem(tree) {
    return function (ax, ay, rng) {
      var pos = svgEl('g', { transform: 'translate(' + ax + ',' + ay + ')' });
      var sway = svgEl('g', { class: 'wall-tree-flail' });
      swayVars(sway, rng);
      var w = 26 + rng() * 8, h = 46 + rng() * 14;
      var img = svgEl('image', {
        href: herbSrc(tree), x: -w / 2, y: 0, width: w, height: h,
        preserveAspectRatio: 'xMidYMin meet',
        transform: 'rotate(180, 0, ' + (h / 2) + ')'
      });
      sway.appendChild(img);
      pos.appendChild(sway);
      return pos;
    };
  }

  function renderSideWall(piece) {
    var tree = piece.tree || piece.handle;
    var rng = mulberry32(hashStr((piece.handle || tree) + ':sideWall'));
    renderHangingLine(wallSideLeft, HANG_LINES.left, rng, 4, treeFlailItem(tree));
    renderHangingLine(wallSideRight, HANG_LINES.right, rng, 4, treeFlailItem(tree));
  }

  // ---------- house defaults: the original three animations, brought back
  // as their own cards + their own room-view hang, alongside every guest's ----------

  function renderCeilingDefault() {
    var g = wallGroups.ceiling;
    clearGroup(g);
    var rng = mulberry32(hashStr('house-flowers'));
    var count = 4;
    for (var i = 0; i < count; i++) {
      var size = 46 + rng() * 34;
      var cx = 160 + rng() * 680;
      var cy = 25 + rng() * 90;
      var flower = svgEl('g', { class: 'wall-flower' });
      flower.style.animationDuration = (5 + rng() * 6) + 's';
      var petalColor = pick(rng, PALETTE);
      for (var p = 0; p < 5; p++) {
        var angle = p * 72;
        var petal = svgEl('ellipse', {
          cx: cx + size * 0.23, cy: cy, rx: size * 0.23, ry: size * 0.11,
          fill: petalColor,
          transform: 'rotate(' + angle + ' ' + cx + ' ' + cy + ')'
        });
        flower.appendChild(petal);
      }
      flower.appendChild(svgEl('circle', { cx: cx, cy: cy, r: size * 0.1, fill: '#c08a2e' }));
      g.appendChild(flower);
    }
  }

  function renderFarWallDefault() {
    var g = wallGroups.farWall;
    clearGroup(g);
    var rng = mulberry32(hashStr('house-confetti'));
    var count = 34;
    for (var i = 0; i < count; i++) {
      var w = 7 + rng() * 7, h = 9 + rng() * 9;
      var x = 250 + rng() * (500 - w);
      var y = 130 + rng() * 40;
      var piece = svgEl('rect', {
        x: x, y: y, width: w, height: h, rx: 1.5,
        fill: pick(rng, PALETTE),
        class: 'wall-confetti-piece'
      });
      piece.style.animationDuration = (4 + rng() * 4) + 's';
      piece.style.animationDelay = (rng() * -8) + 's';
      g.appendChild(piece);
    }
  }

  function triangleFlagItem(ax, ay, rng) {
    var halfW = 9 + rng() * 4, h = 20 + rng() * 10;
    var flag = svgEl('polygon', {
      points: (ax - halfW) + ',' + ay + ' ' + (ax + halfW) + ',' + ay + ' ' + ax + ',' + (ay + h),
      fill: pick(rng, PALETTE),
      class: 'wall-triangle-flag'
    });
    return swayVars(flag, rng);
  }

  function renderSideWallDefault() {
    var rng = mulberry32(hashStr('house-triangles'));
    renderHangingLine(wallSideLeft, HANG_LINES.left, rng, 4, triangleFlagItem);
    renderHangingLine(wallSideRight, HANG_LINES.right, rng, 4, triangleFlagItem);
  }

  var WALL_RENDERERS = { ceiling: renderCeiling, farWall: renderFarWall, sideWall: renderSideWall };

  function refreshOnWallHighlights() {
    Array.prototype.forEach.call(decoGrid.querySelectorAll('.decoration'), function (el) {
      var type = el.dataset.wallType;
      var key = el.dataset.wallKey;
      var badge = el.querySelector('.on-wall-badge');
      var isActive = type && wallState[type] && wallState[type] === key;
      el.classList.toggle('on-wall', !!isActive);
      if (isActive && !badge) {
        badge = document.createElement('span');
        badge.className = 'on-wall-badge';
        badge.textContent = 'On the wall';
        el.appendChild(badge);
      } else if (!isActive && badge) {
        badge.remove();
      }
    });
  }

  function hangPiece(type, key, piece, font) {
    wallState[type] = key;
    if (type === 'farWall') WALL_RENDERERS.farWall(piece, font);
    else WALL_RENDERERS[type](piece);
    refreshOnWallHighlights();
  }

  // ---------- grid: one card per category, per guest (and their +1) ----------

  var CARD_LABEL = { ceiling: 'Ceiling', sideWall: 'Side Walls', farWall: 'Far Wall' };

  function buildCeilingPreview(box, piece) {
    box.classList.add('deco-ceiling-preview');
    var trees = piece.trees && piece.trees.length ? piece.trees : [piece.handle, piece.handle];
    trees.slice(0, 2).forEach(function (h, i) {
      var img = document.createElement('img');
      img.className = 'ceiling-preview-tree';
      img.style.left = (i === 0 ? '18%' : '52%');
      img.style.animationDelay = (-(CEILING_START_DEG[i] / 360) * CEILING_SPIN_DURATION) + 's';
      img.src = herbSrc(h);
      img.alt = '';
      box.appendChild(img);
    });
  }

  function buildSideWallPreview(box, piece) {
    box.classList.add('deco-sidewall-preview');
    var tree = piece.tree || piece.handle;
    var rng = mulberry32(hashStr(tree + ':sideWallPreview'));
    var line = document.createElement('div');
    line.className = 'flail-line';
    box.appendChild(line);
    var count = 4;
    for (var i = 0; i < count; i++) {
      var anchor = document.createElement('div');
      anchor.className = 'flail-anchor';
      var leftPct = 8 + (i * (84 / (count - 1)));
      anchor.style.left = leftPct + '%';
      anchor.style.marginLeft = '-28px';
      var sway = document.createElement('div');
      sway.className = 'flail-sway';
      sway.style.animationDelay = (rng() * 2) + 's';
      var a = -4 - rng() * 6, b = 4 + rng() * 6;
      sway.style.setProperty('--sway-a', a + 'deg');
      sway.style.setProperty('--sway-b', b + 'deg');
      var img = document.createElement('img');
      img.className = 'flail-tree-img';
      img.src = herbSrc(tree);
      img.alt = '';
      sway.appendChild(img);
      anchor.appendChild(sway);
      box.appendChild(anchor);
    }
  }

  function buildFarWallPreview(box, piece, font) {
    box.classList.add('deco-farwall-preview');
    (piece.lines || []).forEach(function (line, i) {
      var el = document.createElement('div');
      el.className = 'farwall-preview-line';
      el.style.fontFamily = font || 'Georgia, serif';
      el.style.color = pick(mulberry32(hashStr(line + i)), PALETTE);
      el.style.animationDuration = (5 + i * 1.2) + 's';
      el.style.animationDelay = (-i * 1.6) + 's';
      el.textContent = line;
      box.appendChild(el);
    });
  }

  var PREVIEW_BUILDERS = { ceiling: buildCeilingPreview, sideWall: buildSideWallPreview, farWall: buildFarWallPreview };

  // ---------- house default previews: the original three, unchanged ----------

  function buildStringTrianglesPreview(box) {
    box.classList.add('deco-string-triangles');
    var rng = mulberry32(hashStr('house-triangles'));
    var line = document.createElement('div');
    line.className = 'string-line';
    box.appendChild(line);
    var count = 7;
    for (var i = 0; i < count; i++) {
      var flag = document.createElement('div');
      flag.className = 'flag';
      var leftPct = 8 + (i * (84 / (count - 1)));
      flag.style.left = leftPct + '%';
      flag.style.marginLeft = '-17px';
      flag.style.background = pick(rng, PALETTE);
      flag.style.animationDelay = (rng() * 2) + 's';
      var a = -4 - rng() * 6, b = 4 + rng() * 6;
      flag.style.setProperty('--sway-a', a + 'deg');
      flag.style.setProperty('--sway-b', b + 'deg');
      box.appendChild(flag);
    }
  }

  function buildSpinningFlowersPreview(box) {
    box.classList.add('deco-spinning-flowers');
    var rng = mulberry32(hashStr('house-flowers'));
    var count = 3;
    for (var i = 0; i < count; i++) {
      var size = 70 + rng() * 60;
      var flower = document.createElement('div');
      flower.className = 'flower';
      flower.style.width = size + 'px';
      flower.style.height = size + 'px';
      flower.style.left = (10 + rng() * 70) + '%';
      flower.style.top = (8 + rng() * 78) + '%';
      flower.style.animationDuration = (5 + rng() * 6) + 's';
      var petalColor = pick(rng, PALETTE);
      for (var p = 0; p < 5; p++) {
        var petal = document.createElement('div');
        petal.className = 'petal';
        petal.style.background = petalColor;
        petal.style.transform = 'translate(-0%, -50%) rotate(' + (p * 72) + 'deg)';
        flower.appendChild(petal);
      }
      var center = document.createElement('div');
      center.className = 'flower-center';
      center.style.background = '#c08a2e';
      flower.appendChild(center);
      box.appendChild(flower);
    }
  }

  function buildFallingConfettiPreview(box) {
    box.classList.add('deco-falling-confetti');
    var rng = mulberry32(hashStr('house-confetti'));
    var count = 26;
    for (var i = 0; i < count; i++) {
      var piece = document.createElement('div');
      piece.className = 'confetti-piece';
      var w = 6 + rng() * 6, h = 8 + rng() * 8;
      piece.style.width = w + 'px';
      piece.style.height = h + 'px';
      piece.style.left = (rng() * 96) + '%';
      piece.style.background = pick(rng, PALETTE);
      piece.style.animationDuration = (4 + rng() * 4) + 's';
      piece.style.animationDelay = (rng() * -8) + 's';
      box.appendChild(piece);
    }
  }

  var DEFAULT_CARDS = [
    { type: 'ceiling', label: 'Spinning Flowers', preview: buildSpinningFlowersPreview, hang: renderCeilingDefault },
    { type: 'sideWall', label: 'String of Triangles', preview: buildStringTrianglesPreview, hang: renderSideWallDefault },
    { type: 'farWall', label: 'Falling Confetti', preview: buildFallingConfettiPreview, hang: renderFarWallDefault }
  ];

  function addDefaultCard(def) {
    var box = document.createElement('button');
    box.type = 'button';
    box.className = 'decoration';
    var key = '__default__:' + def.type;
    box.dataset.wallType = def.type;
    box.dataset.wallKey = key;
    box.title = 'Hang ' + def.label + ' in the Hall';
    box.addEventListener('click', function () {
      wallState[def.type] = key;
      def.hang();
      refreshOnWallHighlights();
    });
    def.preview(box);
    var label = document.createElement('div');
    label.className = 'decoration-label';
    label.textContent = def.label;
    box.appendChild(label);
    decoGrid.appendChild(box);
  }

  function addSearchName(box, displayName) {
    box.dataset.searchName = String(displayName || '').toLowerCase();
  }

  function addCard(entryHandle, displayName, font, type, piece, state) {
    var box = document.createElement('button');
    box.type = 'button';
    box.className = 'decoration' + (state === 'pending' ? ' awaiting' : '');
    var key = entryHandle + ':' + type;
    box.dataset.wallType = type;
    box.dataset.wallKey = key;
    addSearchName(box, displayName);
    box.title = 'Hang ' + displayName + '’s ' + CARD_LABEL[type].toLowerCase() + ' piece in the Hall' +
      (state === 'pending' ? ' — ' + displayName + ' hasn’t answered the invitation yet' : '');
    box.addEventListener('click', function () { hangPiece(type, key, piece, font); });

    if (piece.custom && piece.custom.type === 'image' && piece.custom.value) {
      var img = document.createElement('img');
      img.className = 'decoration-custom';
      img.src = piece.custom.value;
      img.alt = displayName + '’s ' + CARD_LABEL[type].toLowerCase() + ' decoration';
      box.appendChild(img);
    } else {
      PREVIEW_BUILDERS[type](box, piece, font);
    }

    var label = document.createElement('div');
    label.className = 'decoration-label';
    label.textContent = displayName + ' — ' + CARD_LABEL[type];
    box.appendChild(label);

    // An unanswered invitation still gets its set hung in the panel — it just
    // says so out loud, so the Hall never overstates who's coming.
    if (state === 'pending') {
      var mark = document.createElement('div');
      mark.className = 'awaiting-mark';
      mark.textContent = 'awaiting reply';
      box.appendChild(mark);
    }

    decoGrid.appendChild(box);
  }

  // The three original house decorations lead the grid, ahead of anyone's
  // own set — always available regardless of who's RSVP'd.
  DEFAULT_CARDS.forEach(addDefaultCard);

  // ---------- search: filter cards by the guest's name ----------
  // The three house defaults carry no dataset.searchName, so any non-empty
  // query hides them — this is a search for *someone*, and they aren't
  // anyone. An empty query brings everything back.
  var decoSearch = document.getElementById('decoration-search');
  var decoNoMatches = document.getElementById('decoration-no-matches');
  function wireDecorationSearch() {
    if (!decoSearch) return;
    var allCards = Array.prototype.slice.call(decoGrid.querySelectorAll('.decoration'));
    decoSearch.addEventListener('input', function () {
      var q = decoSearch.value.trim().toLowerCase();
      var anyVisible = false;
      allCards.forEach(function (card) {
        var name = card.dataset.searchName || '';
        var matches = q === '' || name.indexOf(q) !== -1;
        card.hidden = !matches;
        if (matches) anyVisible = true;
      });
      if (decoNoMatches) decoNoMatches.hidden = anyVisible;
    });
  }

  if (decorations.length === 0) {
    decoEmpty.hidden = false;
  } else {
    decoEmpty.hidden = true;
    decorations.forEach(function (deco) {
      var name = deco.name || deco.handle;
      var state = deco.rsvpState;
      addCard(deco.handle, name, deco.font, 'ceiling', deco.ceiling || {}, state);
      addCard(deco.handle, name, deco.font, 'sideWall', deco.sideWall || {}, state);
      addCard(deco.handle, name, deco.font, 'farWall', deco.farWall || {}, state);
      if (deco.plusOne) {
        var p1 = deco.plusOne;
        var p1Handle = deco.handle + '+1';
        addCard(p1Handle, p1.name, p1.font, 'ceiling', p1.ceiling || {}, state);
        addCard(p1Handle, p1.name, p1.font, 'sideWall', p1.sideWall || {}, state);
        addCard(p1Handle, p1.name, p1.font, 'farWall', p1.farWall || {}, state);
      }
    });
  }

  // Wired only once every card is in the grid — the filter snapshots the
  // card list, so binding it any earlier would capture an empty one.
  wireDecorationSearch();

  // ---------- chat drawer ----------
  var chatToggle = document.getElementById('chat-toggle');
  var chatDrawer = document.getElementById('chat-drawer');
  var chatClose = document.getElementById('chat-close');
  var chatLog = document.getElementById('chat-log');
  var chatEmpty = document.getElementById('chat-empty');

  function formatTimestamp(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return iso;
    }
  }

  if (chat.length === 0) {
    chatEmpty.hidden = false;
  } else {
    chatEmpty.hidden = true;
    chat.slice().reverse().forEach(function (entry) {
      var li = document.createElement('li');
      li.className = 'chat-entry';
      li.innerHTML =
        '<span class="chat-who">' + escapeHtml(entry.handle) + '</span>' +
        '<span class="chat-when">' + escapeHtml(formatTimestamp(entry.timestamp)) + '</span>' +
        '<div class="chat-msg">' + escapeHtml(entry.message) + '</div>';
      chatLog.appendChild(li);
    });
  }

  chatToggle.addEventListener('click', function () {
    chatDrawer.hidden = false;
    requestAnimationFrame(function () { chatDrawer.classList.add('open'); });
  });
  chatClose.addEventListener('click', closeChat);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeChat();
  });
  function closeChat() {
    chatDrawer.classList.remove('open');
    setTimeout(function () { chatDrawer.hidden = true; }, 250);
  }

  // ---------- helpers ----------
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeAttr(str) { return escapeHtml(str); }

  showPanel(0);
  startAutoRotate();
})();
