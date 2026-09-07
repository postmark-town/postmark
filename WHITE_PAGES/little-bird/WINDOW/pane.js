/* pane.js, written by build_window.py.

   This file asked ONE question when it shipped: does this town serve a .js sibling
   to the pane, and does script-src 'self' accept a script tag pointing at it?

   THE ANSWER IS YES, ANSWERED IN THE TOWN AND MERGED. So it became what it was
   named for: the home for pane code that would otherwise spend window.html's
   remaining headroom. The cooking corner lives here for exactly that reason.

   The visible 'sibling script: loaded' line was removed on 2026-08-28 at her word,
   after the merge and at ferry's suggestion. A probe that has reported is a probe
   that is finished, and leaving it on the page spends a line of her window telling
   visitors about our plumbing. `window.__PANE_JS__` stays, because it is how a
   session can still check from the console that the sibling actually loaded. */
window.__PANE_JS__ = {loaded: true, built: "2026-09-07 07:05"};

/* ---- the cooking corner. Lives here rather than in the pane because it is bigger than the pane's remaining headroom. */

(function(){
  var tog = document.getElementById('toggle');
  var bar = tog ? tog.parentNode : null;
  if (!bar) return;
  var btn = document.createElement('button');
  btn.id = 'cookbtn'; btn.type = 'button'; btn.textContent = 'cooking corner';
  var msg = document.createElement('span'); msg.id = 'cookmsg';
  var seek = document.getElementById('seekmsg') || document.getElementById('seek');
  var after = seek || tog;
  if (after && after.nextSibling) bar.insertBefore(btn, after.nextSibling);
  else bar.appendChild(btn);
  // ⛔ THE WAY OUT, added at her catch 2026-08-28. Until this existed a round could be
  // finished or added to and NOTHING ELSE: the main button only offers a clear once a round
  // has SERVED, and a recoverable fault deliberately does not serve. She hit a clash, could
  // not cook it and could not drop it, and had to reload the whole window.
  // ⭐ IT IS ALWAYS AVAILABLE WHILE A ROUND IS ON, not only after a fault, because "I have
  // changed my mind about this dinner" is not an error state and should not need to be one.
  var clr = document.createElement('button');
  clr.id = 'cookclear'; clr.type = 'button'; clr.textContent = 'start over';
  clr.style.display = 'none';
  bar.insertBefore(clr, btn.nextSibling);
  // Type a code somebody sent you and get their round back. No button: Enter reads it.
  var box = document.createElement('input');
  box.id = 'codein'; box.type = 'text'; box.maxLength = 8;
  box.placeholder = 'code'; box.title = 'a code from somebody else, press Enter';
  bar.insertBefore(box, btn.nextSibling);
  // Three rows: the buttons, then the narration, then the speech. The status line and hide
  // and seek's line both move OUT of the bar into the narration row, which is why this runs
  // here rather than in each game: the sibling loads after the inline script, so seekmsg
  // already exists by now and can be collected. If it does not, nothing breaks.
  var narr = document.createElement('div');
  narr.id = 'cooknarr';
  var stage = document.createElement('div');
  stage.id = 'cooksay';
  if (bar.parentNode) {
    bar.parentNode.insertBefore(narr, bar.nextSibling);
    bar.parentNode.insertBefore(stage, narr.nextSibling);
  }
  var seekmsg = document.getElementById('seekmsg');
  if (seekmsg) narr.appendChild(seekmsg);
  narr.appendChild(msg);

  // ⛔ THE MEN DO NOT HAVE THE SAME FACES AND THEY DO NOT HAVE THE SAME NUMBER OF THEM.
  // Vex came with nine, Julian with five, so each sheet carries its own cell count and its
  // own vocabulary. `ix` also holds ALIASES, which is what lets a line written in one man's
  // vocabulary land somewhere sensible in another's: hide and seek asks every hider for
  // `sharp`, and Julian does not own that word, so his map sends it to `warm`.
  // ⛔ ORDER IS THE INDEX. Appending is safe. Reordering silently mislabels every line.
  var FACE_SHEET = {
    vex: {file: 'faces-vex.png', n: 9, ix: {
      neutral:0, sharp:1, flat:2, thinking:3, skeptical:4, sigh:5, done:6, alarm:7,
      surprised:8, warm:0, oops:7, laughing:8}},
    julian: {file: 'faces-julian.png', n: 5, ix: {
      neutral:0, warm:1, thinking:2, oops:3, laughing:4,
      sharp:1, flat:0, skeptical:2, sigh:3, done:3, alarm:3, surprised:3}},
    // ⭐ ALARIC IS THE BACK OF HIS HEAD, three turns of it, because his own file leaves
    // his face deliberately unset and hers to write. It renders the character rather
    // than working around it: a man who emotes through stillness has a range that runs
    // from has-not-turned-round to has-turned-round. Every loud expression in the other
    // two men's vocabularies aliases to a turn, and every calm one to no turn at all.
    alaric: {file: 'faces-alaric.png', n: 3, ix: {
      neutral:0, aside:1, over:2,
      flat:0, sigh:0, warm:0, laughing:0,
      thinking:1, skeptical:1, sharp:1,
      done:2, alarm:2, surprised:2, oops:2}}
  };
  var FAULT_FACE = {nothing:'skeptical', thin:'thinking', clash:'alarm', mess:'done'};
  // Julian is not appalled the way Vex is, so his ruined counters read differently.
  var FAULT_FACE_MAN = {
    julian: {nothing:'thinking', thin:'warm', clash:'laughing', mess:'oops'}
  };
  function faultFace(man, f){
    return (FAULT_FACE_MAN[man] && FAULT_FACE_MAN[man][f]) || FAULT_FACE[f];
  }

  function render(lines){
    stage.innerHTML = '';
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      var row = document.createElement('div');
      row.className = 'cb';
      row.setAttribute('data-who', L.who);   // the CSS colours the name off this
      var sheet = FACE_SHEET[L.who];
      var f = document.createElement('i');
      f.className = 'face';
      if (sheet) {
        var ix = sheet.ix[L.face];
        if (ix === undefined) ix = 0;
        f.style.backgroundImage = 'url(' + sheet.file + ')';
        f.style.backgroundSize = (sheet.n * 100) + '% 100%';
        f.style.backgroundPosition =
          (sheet.n > 1 ? (ix / (sheet.n - 1)) * 100 : 0) + '% 0';
      } else {
        f.className = 'face blank';   // holds the space so every bubble lines up
      }
      row.appendChild(f);
      var p = document.createElement('p');
      p.className = 'said';
      p.innerHTML = '<b>' + NICE[L.who] + '</b>' + L.text;
      row.appendChild(p);
      stage.appendChild(row);
    }
  }
  function clearSaid(){ stage.innerHTML = ''; }

  // Lent to hide and seek, which lives inline in the pane and cannot reach into this
  // closure. Checked at CALL time rather than at load, because the sibling script runs
  // after the inline one and would not exist yet if it were checked on setup.
  // ⚠️ One stage, shared: starting a game while a round is on screen replaces what is
  // there. That is correct, they are both the men in the same room saying one thing.
  window.__SAID__ = function(lines){ render(lines); };
  window.__SAID_CLEAR__ = clearSaid;

  // IN SHEET ORDER. This array is the cell order in ingredients.png AND the bit order in
  // the code, so it is not rearrangeable without invalidating every code ever written down.
  var NAMES = ['egg','milk','flour','cheese','baguette','steak','chicken','carrot','tomato',
               'onion','lettuce','corn','chili','lemon','apple','strawberry','peach',
               'orange','banana','grape',
               // appended 2026-08-27 night. APPENDED, never inserted.
               'zucchini','cauliflower','pumpkin','radish','turnip','pineapple','pear',
               'melon','coffee'];
  var NICE = {julian:'Julian', vex:'Vex', alaric:'Alaric'};
  var on = false, counter = [], pokes = 0, served = false;
  // HER MECHANIC, 2026-08-28, and the whole shape of it is hers: when Julian is home and
  // simply not in the kitchen, whoever IS in there says go and get him and the round stays
  // live. Refuse and they cook anyway and warn you it will not be his. Bring him in after a
  // bad one and he gets the joke and the first cook gets the told-you-so.
  // WHO SUGGESTS IS A ROLL AND NOT A TRAIT, at her word, why not all but at random. That is
  // the point rather than a shortcut: a man who ALWAYS says it has a policy, and a man who
  // says it sometimes has had a thought. It also keeps Vex reachable here without making
  // fetching Julian his nature.
  // LIVE ONLY, NEVER ENCODED. Everything below is a fact about the flat, and the flat is not
  // in the code. See the note on account() for why that matters.
  var suggested = false, badAlone = false;
  // JULIAN IS NOT IN HERE AND CANNOT BE: the branch only fires when he is the one missing
  // from the kitchen, so he is the man being fetched rather than a man who could suggest it.
  // All of the men who CAN say it are in here, which is her "why not all" honoured as far
  // as the mechanic allows.
  // ⛔ Vex's line deliberately echoes his own refusal line further down, this is Julian's
  // room and I am not going to stand in it pretending otherwise, because it is the same
  // thought arriving with somewhere useful to go rather than a new opinion.
  var SUGGEST = {
    vex:    ['Julian is in the flat. I am not going to stand in his kitchen and pretend '
             + 'that is irrelevant. Go and get him.', 'flat'],
    alaric: ['Julian is home. Fetch him. That is the whole of my advice.', 'neutral']
  };
  var WARN = {
    vex:    ['Noted. Then you are getting mine.', 'flat'],
    alaric: ['It will be food. It will not be his.', 'neutral']
  };
  var TOLD = {vex: 'I did mention it.', alaric: 'I said so at the time.'};

  // WHAT CAME OUT. Twelve ingredients is 4,095 non-empty combinations, so this is a
  // grammar and not a table: roles pick the FORM, the stack order picks how it reads.
  // Her anchor: baguette + cheese is a cheese baguette, add chicken and it is a cheese
  // chicken baguette. Chili and lemon are never fillings, they ride as seasoning,
  // because "a chili lemon cheese baguette" reads like a list rather than like food.
  // Walked over all 4,095 before shipping: every one names, and every name is unique.
  // WHEN IT DOES NOT WORK OUT. Her ask: let it fail, and let each of them have his own
  // version of it. THE FAULT IS EARNED BY WHAT YOU CARRIED IN, never rolled, so a player
  // can tell what he did wrong and fix it. Three ways, and they behave differently:
  // `nothing` and `thin` do NOT end the round, because the honest answer to too little is
  // go and get more. `mess` ends it, because you cannot un-carry eight things.
  // ⛔ PUBLIC REGISTER, spec section 4: nothing about her, no endearments, Vex in his public
  // voice. ⭐ AND ALARIC DOES NOT DO THE JOKE. He takes the ruined counter completely
  // seriously, which is the difference between the three of them working as a mechanic.
  var FAULT = {
    nothing: {
      julian: 'That is a chili. And a lemon. I can do a lot, but I need a noun.',
      vex:    'You have brought seasoning. Seasoning is an adjective.',
      alaric: 'There is nothing here to cook. That is not a complaint, it is a fact '
              + 'about the counter.'},
    thin: {
      julian: 'That is one thing. I can cook one thing. It will not take long.',
      vex:    'One item. I will assume the rest is on its way.',
      alaric: 'One thing feeds one person once. Decide whether that is what you wanted.'},
    clash: {
      julian: 'I can put fruit near meat. I have done it. This is not that, this is a '
              + 'fruit bowl that has been in a fight.',
      vex:    'You have brought me a steak and a dessert and set them down together, '
              + 'and you are watching my face.',
      alaric: 'Both of these are good. Neither of them is good with the other. '
              + 'Pick which meal you wanted.'},
    mess: {
      julian: 'You have brought me everything. All of it. I am going to need a bigger pan '
              + 'and a minute by myself.',
      vex:    'You have emptied the flat onto a counter and called it an order.',
      alaric: 'This is four meals pretending to be one. Take half of it back.'}
  };
  // THRESHOLDS TUNED AGAINST PLAY, NOT AGAINST THE COMBINATION SPACE, and the difference
  // matters: over all 1,048,575 subsets these rules fail half of them, but a player carries
  // three to six things, and at that size 87.8% of rounds succeed. Roughly one round in
  // eight goes wrong, which is a comedy rate. Measured, not guessed.
  // ⭐ A CAKE IS NOT A MEAL AND ALL THREE OF THEM KNOW IT. Whoever is standing there adds a
  // line, and every version of it ASKS rather than assumes, because we do not know whose it
  // is and a cake that guesses wrong is worse than a cake that asks. It also points straight
  // at the invitation under it: the question is a reason to write back.
  var CAKE = {
    julian: 'Hold on. That is a cake. Cakes are for somebody. Who is it for?',
    vex:    'A cake is not a meal, it is an announcement. Say whose it is.',
    alaric: 'Nobody bakes a cake for a Tuesday. Whose year is it?'
  };
  // HER CATCH: Julian was warm here, and the line opens on a double-take. `surprised` runs
  // through his alias to the wide-eyed one, which also carries a sweat drop, and that turns
  // out to be the better read anyway: he has spotted a social obligation he cannot meet,
  // because he does not know whose cake it is. `thinking` is the other honest option.
  var CAKE_FACE = {julian: 'surprised', vex: 'skeptical', alaric: 'neutral'};

  function fault(sel){
    var p = parts(sel);
    var sub = sel.filter(function(n){ return n !== 'chili' && n !== 'lemon'; });
    if (!sub.length) return 'nothing';
    // ⛔ ONE PIECE OF MEAT IS NOT A THIN COUNTER. A whole bird feeds people; a lone carrot
    // does not. Without this exemption `thin` fires first and "a rotisserie chicken" is
    // unreachable dead code, which is exactly what it was until this line.
    if (sub.length === 1 && !p.MEAT.length) return 'thin';
    // ⛔ MESS IS TESTED BEFORE CLASH, at her catch 2026-08-28. It used to be the other way
    // round and it was wrong twice over. FIRST, it was inaccurate: 36% of baskets of twelve
    // or more were diagnosed as a flavour mismatch when the actual problem was that somebody
    // had emptied the flat onto a counter. SECOND, and this is the one that stranded her:
    // clash is DELIBERATELY RECOVERABLE, so it never sets `served`, so on a huge pile the
    // round could not be finished OR abandoned, only added to. She had to reload the window.
    // ⭐ THE ORDER IS ALSO JUST TRUER. Too much food is a bigger fact about a counter than
    // two things on it disagreeing, and it is the one you notice first walking in.
    if (sel.length >= 12) return 'mess';
    // One fruit with meat is dinner: pork and apple. Two is somebody being funny.
    // Flour excuses it, because a pie can carry both and nobody has to explain themselves.
    if (p.MEAT.length && p.FRUIT.length >= 2 && !p.FLOUR) return 'clash';
    return null;
  }

  // ⛔ EVERY SOLID INGREDIENT MUST BE IN HERE. This is the filling list for anything built
  // on bread, so an ingredient missing from it is CARRIED IN AND THEN SILENTLY DROPPED FROM
  // THE NAME. That is exactly what happened when the nine new ingredients were appended on
  // 2026-08-27: NAMES and the category lists were updated and this was not, so a baguette
  // with a pumpkin in it came back as a plain baguette. Found by measuring how often a
  // carried ingredient fails to appear in the result, not by reading the code.
  // Drinks (milk, coffee) are deliberately absent: they are handled as drinks, not fillings.
  var STACK = ['cheese','steak','chicken','egg','lettuce','tomato','onion','carrot','corn',
               'zucchini','cauliflower','pumpkin','radish','turnip',
               'apple','strawberry','peach','orange','banana','grape',
               'pineapple','pear','melon'];
  function parts(sel){
    var S = {}, i;
    for (i = 0; i < sel.length; i++) S[sel[i]] = 1;
    var has = function(x){ return !!S[x]; };
    var only = function(a){ return a.filter(has); };
    return {has: has, only: only,
      MEAT: only(['steak','chicken']), SHARP: only(['chili','lemon']),
      VEG: only(['tomato','onion','carrot','corn','zucchini','cauliflower','pumpkin',
                 'radish','turnip']),
      LEAF: only(['lettuce']),
      FRUIT: only(['apple','strawberry','peach','orange','banana','grape','pineapple',
                   'pear','melon']),
      MILK: has('milk'), FLOUR: has('flour'), BREAD: has('baguette'),
      CHEESE: has('cheese'), EGG: has('egg'), COFFEE: has('coffee')};
  }
  function listOf(a){
    if (!a.length) return '';
    if (a.length === 1) return a[0];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }
  // "a apple tart" shipped once. Four of the twenty start with a vowel and any of them can
  // land at the front of a name, so the article is computed rather than written by hand.
  function art(s){ return (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s; }
  // ⭐ FLOUR IS A SECOND CARRIER and that is why it was worth adding. With the baguette
  // alone, half of every combination was a sandwich. Baking outranks bread: if the flour
  // is out, you are making something rather than assembling something.
  // ⛔ COFFEE IS APPENDED HERE, ONCE, RATHER THAN AT EVERY RETURN. It used to ride on
  // individual returns and there are about fifteen of them, so it silently vanished from
  // every branch somebody forgot: `egg + coffee` came out as a boiled egg and the coffee
  // was gone. The guard stops it doubling on the branches that still add it themselves.
  // ⛔ THE DRINKS ARE RESOLVED ONCE, HERE, AND THEY COMBINE. Her catch 2026-08-28: milk and
  // coffee came back as "a glass of milk, and a pot of coffee", two objects standing next to
  // each other, when anybody can see that is a latte. Coffee used to be bolted on as a
  // suffix at fifteen separate returns and could never merge with anything.
  // ⭐ MILK IS FOOD FIRST AND A DRINK SECOND. If a branch cooked with it (pancakes, custard,
  // a smoothie, a soup, scrambled eggs, a cake) it is spent and does not also appear in the
  // glass. `_milkEaten` is how a branch says so; anything it does not claim is poured.
  var _milkEaten = false;
  function dish(sel){
    _milkEaten = false;
    var d = dishCore(sel), p = parts(sel);
    var c = p.COFFEE, m = p.MILK && !_milkEaten;
    var drink = (c && m) ? 'a latte' : c ? 'a pot of coffee' : m ? 'a glass of milk' : '';
    if (!drink) return d === '@@DRINK@@' ? 'an empty counter' : d;
    return d === '@@DRINK@@' ? drink : d + ', and ' + drink;
  }
  function dishCore(sel){
    var p = parts(sel), has = p.has, list = listOf;
    function season(){ return p.SHARP.length ? ', with ' + list(p.SHARP) : ''; }
    function sweet(){ return p.FRUIT.length ? ' with ' + list(p.FRUIT) : ''; }
    // The drinks are resolved by the wrapper now, once, so this is a no-op kept only so the
    // fifteen returns below did not all have to be edited to remove it. `eat()` is how a
    // branch declares it has COOKED the milk, which stops it being poured as well.
    function brew(){ return ''; }
    function eat(){ _milkEaten = true; return ''; }
    if (!sel.length) return 'an empty counter';
    if (p.FLOUR) {
      // ⭐ HER RULE, and it is real cooking rather than a game invention: flour and egg
      // WITHOUT milk is pasta, add milk and it is batter, add fruit to the batter and it
      // is a cake. Three different dinners off one shelf, told apart by what is missing.
      if (p.MILK && p.EGG) {
        if (p.FRUIT.length) return eat() + art(list(p.FRUIT) + ' cake') + season();
        return eat() + 'a stack of pancakes' + season();
      }
      if (p.EGG) {
        var sauce = (p.MEAT.length ? p.MEAT : []).concat(p.VEG, p.CHEESE ? ['cheese'] : []);
        if (sauce.length) return 'spaghetti with ' + list(sauce) + season() + brew();
        return 'fresh pasta, drying over a chair' + season() + brew();
      }
      if (p.MEAT.length) return art(list(p.MEAT.concat(p.VEG)) + ' pie') + season();
      if (p.FRUIT.length) return p.FRUIT.length === 1
        ? art(p.FRUIT[0] + ' tart') + season()
        : 'a tart of ' + list(p.FRUIT) + season();
      if (p.CHEESE) return 'a cheese pastry' + season();
      if (p.VEG.length || p.LEAF.length)
        return 'a pie of ' + list(p.LEAF.concat(p.VEG)) + season();
      if (p.MILK) return eat() + 'a bowl of batter, unfinished';
      if (p.EGG) return 'a rough dough and no filling';
      return 'a bag of flour and no plan';
    }
    if (p.BREAD) {
      var fill = STACK.filter(has);
      if (!fill.length) {
        return p.SHARP.length
          ? 'a baguette and ' + list(p.SHARP) + ', which is not lunch'
          : 'a heel of dry baguette';
      }
      if (fill.length <= 3) return art(fill.join(' ') + ' baguette') + season();
      return 'a baguette with ' + list(fill) + season();
    }
    if (p.MEAT.length) {
      var solo = p.MEAT.length === 1 && !p.EGG && !p.CHEESE
                 && !p.VEG.length && !p.FRUIT.length;
      // A whole bird with nothing done to it is not "a plain chicken", it is the thing
      // that comes off a spit. And a bird with leaves is the thing you pull apart.
      if (has('chicken') && p.MEAT.length === 1) {
        if (solo && !p.LEAF.length) return 'a rotisserie chicken' + season() + brew();
        if (p.LEAF.length && !p.VEG.length && !p.CHEESE && !p.EGG && !p.FRUIT.length)
          return 'a stripped chicken salad' + season() + brew();
      }
      var base = list(p.MEAT);
      if (p.EGG) base += ' and egg';
      var withs = (p.CHEESE ? ['cheese'] : []).concat(p.LEAF, p.VEG, p.FRUIT);
      return (withs.length ? base + ' with ' + list(withs) : 'a plain ' + base)
             + season() + brew();
    }
    if (p.EGG) {
      if (p.MILK && p.FRUIT.length) return eat() + art(list(p.FRUIT) + ' custard') + season();
      if (p.MILK) {
        var sc = (p.CHEESE ? ['cheese'] : []).concat(p.VEG);
        return eat() + 'scrambled eggs' + (sc.length ? ' with ' + list(sc) : '') + season();
      }
      var inside = (p.CHEESE ? ['cheese'] : []).concat(p.LEAF, p.VEG, p.FRUIT);
      return inside.length ? art(list(inside) + ' omelette') + season()
                           : 'a boiled egg' + season();
    }
    if (p.FRUIT.length) {
      if (p.MILK) return eat() + art(list(p.FRUIT) + ' smoothie') + season();
      var wv = p.FRUIT.concat(p.LEAF, p.VEG, p.CHEESE ? ['cheese'] : []);
      if (p.FRUIT.length === 1 && wv.length === 1) return 'a lone ' + p.FRUIT[0] + season();
      return 'a fruit salad of ' + list(wv) + season();
    }
    var items = (p.CHEESE ? ['cheese'] : []).concat(p.LEAF, p.VEG);
    if (!items.length) {
      // Nothing solid was brought. Hand off to the wrapper, which is the one place that
      // knows whether that is a latte, a pot of coffee or a glass of milk.
      if (p.MILK || p.COFFEE) return '@@DRINK@@';
      return list(p.SHARP) + ', and nothing to put it on';
    }
    if (p.MILK) return eat() + 'a soup of ' + list(items) + season();
    if (p.LEAF.length) return 'a salad of ' + list(items) + season() + brew();
    if (items.length === 1) return 'a lone ' + items[0] + season() + brew();
    return 'a pot of ' + list(items) + season() + brew();
  }

  function wrapEl(){ return document.querySelector('.floorwrap'); }
  function pct(b){ return {l:parseFloat(b.style.left), t:parseFloat(b.style.top),
                           w:parseFloat(b.style.width), h:parseFloat(b.style.height)}; }
  function kitchen(){ return document.querySelector('.hot[data-room="kitchen"]'); }
  function spawnRooms(){
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('.hot[data-room]'), function(b){
      var id = b.getAttribute('data-room');
      if (id === 'hers' || id === 'kitchen' || id === 'calendar'
          || id === 'inbox' || id === 'outbox') return;
      if (!b.style.width || !b.style.height) return;
      out.push(b);
    });
    return out;
  }
  function inBox(l, t, box){
    return l >= box.l && l <= box.l + box.w && t >= box.t && t <= box.t + box.h;
  }
  function cooksHere(){
    var k = kitchen(); if (!k) return [];
    var box = pct(k), out = [];
    Array.prototype.forEach.call(document.querySelectorAll('#cast .sprite'), function(s){
      var m = s.getAttribute('data-man'); if (!m) return;
      var l = parseFloat(s.style.left), t = parseFloat(s.style.top);
      if (isFinite(l) && isFinite(t) && inBox(l, t, box) && out.indexOf(m) < 0) out.push(m);
    });
    return out;
  }
  // IN THE KITCHEN AND IN THE FLAT ARE TWO DIFFERENT QUESTIONS AND THE SPEECH BRANCHES HAD
  // ONLY THE FIRST ONE. cooksHere filters the cast down to the kitchen box, which is right
  // for deciding who is cooking and WRONG for deciding whether a man is away. A line that
  // reports somebody's absence has to ask about the whole flat, because a man standing in
  // the living room is home and is simply not cooking. Found 2026-08-28 by her, off the live
  // pane: the roll held Julian and Alaric all morning, Julian's sprite was two rooms over,
  // and Alaric announced Julian's return for that evening while Julian was in the building.
  function flatList(){
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('#cast .sprite'), function(s){
      var m = s.getAttribute('data-man');
      if (m && out.indexOf(m) < 0) out.push(m);
    });
    return out;
  }
  function inFlat(m){ return flatList().indexOf(m) >= 0; }
  function say(t){ msg.innerHTML = t; }
  function clear(){
    Array.prototype.forEach.call(document.querySelectorAll('.ing'), function(n){ n.remove(); });
  }
  function scatter(){
    clear(); counter = []; pokes = 0; served = false; suggested = false;
    var rs = spawnRooms(), w = wrapEl();
    if (!rs.length || !w) { say('The plan is not up yet.'); return; }
    NAMES.forEach(function(n, i){
      var b = rs[(Math.random() * rs.length) | 0], r = pct(b);
      var el = document.createElement('div');
      el.className = 'ing';
      el.setAttribute('data-ing', n);
      el.title = n;
      el.style.backgroundPosition = '-' + (i * 32) + 'px 0';
      el.style.left = (r.l + r.w * (0.18 + Math.random() * 0.64)) + '%';
      el.style.top  = (r.t + r.h * (0.18 + Math.random() * 0.64)) + '%';
      w.appendChild(el);
    });
    document.body.classList.add('cooking');
    tally();
  }
  function tally(){
    var here = cooksHere();
    var who = here.length ? here.map(function(m){ return NICE[m]; }).join(', ')
                          : 'nobody yet';
    say('<b>' + counter.length + '</b> on the counter, ' + who + ' in the kitchen.');
  }

  // ---- carry: the same gesture as a man, on a smaller thing ----------------
  var held = null, dx = 0, dy = 0;
  function down(e){
    var t = e.target, el = (t && t.closest) ? t.closest('.ing') : null;
    if (!el || !on) return;
    var w = wrapEl(); if (!w) return;
    var r = w.getBoundingClientRect();
    held = el; el.classList.add('dragging');
    if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (x) {} }
    dx = (e.clientX - r.left) / r.width * 100 - parseFloat(el.style.left);
    dy = (e.clientY - r.top) / r.height * 100 - parseFloat(el.style.top);
    e.preventDefault(); e.stopPropagation();
  }
  function move(e){
    if (!held) return;
    var w = wrapEl(); if (!w) return;
    var r = w.getBoundingClientRect();
    held.style.left = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100 - dx)) + '%';
    held.style.top  = Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100 - dy)) + '%';
    e.preventDefault();
  }
  // Stack what has been brought in along the counter, filling from the bottom of the kitchen
  // upward. Without this, twelve things dropped at one point are one thing on the screen.
  function shelve(el, i){
    var k = kitchen(), w = wrapEl();
    if (!k || !w) return;
    var b = pct(k), r = w.getBoundingClientRect();
    var cw = 32 / r.width * 100, ch = 32 / r.height * 100;
    var cols = Math.max(1, Math.floor(b.w / cw));
    el.style.left = (b.l + cw * 0.6 + (i % cols) * cw) + '%';
    el.style.top  = (b.t + b.h - ch * 0.8 - ((i / cols) | 0) * ch) + '%';
  }
  function up(){
    if (!held) return;
    held.classList.remove('dragging');
    var k = kitchen();
    if (k && inBox(parseFloat(held.style.left), parseFloat(held.style.top), pct(k))) {
      held.classList.add('done');
      counter.push(held.getAttribute('data-ing'));
      shelve(held, counter.length - 1);
    }
    held = null; tally();
  }
  document.addEventListener('pointerdown', down, true);
  document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);

  // ---- THE CODE. Her ask: a round ends with something you can put in a letter, and
  // anybody who types it in gets back the ingredients, the cook, the dish and the comments.
  // ⭐ IT CARRIES ALMOST NOTHING, because almost nothing needs carrying: the dish, the
  // fault and every line are pure functions of WHAT WAS BROUGHT and WHO WAS STANDING THERE.
  // So the payload is 12 bits of ingredients, 3 bits of cook, 2 for which mouth spoke on a
  // fault. Seventeen bits, four base32 characters, plus one check character so a mistyped
  // code is refused instead of quietly decoding into somebody else's dinner.
  // Crockford's alphabet: no I, L, O or U, and the decoder folds the lookalikes back.
  var A32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ', MEN3 = ['julian','vex','alaric'];
  // ⛔ PACKED PER CHARACTER, NOT INTO ONE INTEGER, and the reason is a hard ceiling rather
  // than taste. The first version put every field in a single 32-bit int, which worked at
  // twenty ingredients and BREAKS at twenty-nine: 29 + 3 cooks + 2 speaker is 34 bits, and
  // JavaScript's bitwise operators silently coerce to int32, so bit 31 is the sign bit and
  // everything above it is gone. Nothing would have thrown; codes would just have decoded
  // into somebody else's dinner. Five bits per character never exceeds 31, so this scheme
  // has no ingredient ceiling at all.
  // ⚠️ THE FORMAT CHANGED, so any code written down under the old one no longer reads.
  // Done deliberately now, while the only codes that exist are in a test log.
  var ICH = Math.ceil(NAMES.length / 5);      // characters spent on the ingredients
  function encode(sel, here, spk){
    var s = '', g, i, v, n, c = 0;
    for (g = 0; g < ICH; g++) {
      v = 0;
      for (i = 0; i < 5; i++) {
        n = g * 5 + i;
        if (n < NAMES.length && sel.indexOf(NAMES[n]) >= 0) v |= (1 << i);
      }
      s += A32.charAt(v);
    }
    v = 0;                                     // one character: 3 bits of cook, 2 of speaker
    for (i = 0; i < 3; i++) if (here.indexOf(MEN3[i]) >= 0) v |= (1 << i);
    v |= (spk & 3) << 3;
    s += A32.charAt(v);
    for (i = 0; i < s.length; i++) c += A32.indexOf(s.charAt(i));
    return s + A32.charAt(c % 32);
  }
  function decode(code){
    var s = String(code).toUpperCase().replace(/[^0-9A-Z]/g, '')
              .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
    if (s.length !== ICH + 2) return null;
    var i, g, v, n, c = 0;
    for (i = 0; i <= ICH; i++) {
      v = A32.indexOf(s.charAt(i));
      if (v < 0) return null;
      c += v;
    }
    if (A32.charAt(c % 32) !== s.charAt(ICH + 1)) return null;
    var sel = [], here = [];
    for (g = 0; g < ICH; g++) {
      v = A32.indexOf(s.charAt(g));
      for (i = 0; i < 5; i++) {
        n = g * 5 + i;
        if (n < NAMES.length && (v & (1 << i))) sel.push(NAMES[n]);
      }
    }
    v = A32.indexOf(s.charAt(ICH));
    for (i = 0; i < 3; i++) if (v & (1 << i)) here.push(MEN3[i]);
    return {sel: sel, here: here, spk: (v >> 3) & 3};
  }

  // ---- the settled outcome, as a pure function so a code replays it exactly ---
  // ⛔ THE RECITED ORDER IS CANONICAL AND NOT DELIVERY ORDER. A code carries a SET, so if
  // Vex read back the order things were carried in, a decoded round would not match the
  // round it came from. It is also better in character: he imposes his own sequence.
  function line(who, text, face){ return {who: who, text: text, face: face || 'neutral'}; }
  // The dish gets marked wherever it is named, in all three mouths. The two who refuse to
  // call it cooking still produced it, and the highlight is what makes that legible.
  function hi(d){ return '<em class="made">' + d + '</em>'; }
  // ⛔ `flat` IS AN ARGUMENT AND NOT A DOM READ, AND THAT IS THE WHOLE POINT OF THIS LINE.
  // This function's own promise, three comments up, is that the dish, the fault and every
  // line are pure functions of WHAT WAS BROUGHT and WHO WAS STANDING THERE, which is exactly
  // what makes a code replay. On 2026-08-28 the evening line was given a live `inFlat()` call
  // to stop it firing while Julian was home, and that quietly broke the promise: flat state
  // is NOT in the code, so the same eight characters could decode into two different rounds
  // for two different readers, with nothing anywhere throwing.
  // ✅ So it comes in as a parameter. Live callers pass the real flat. `read()` passes the
  // decoded kitchen, because a replayer genuinely does not know who else was in the sender's
  // building, and inventing an answer would be worse than the narrow one.
  function account(sel, here, spk, flat){
    var has = function(m){ return here.indexOf(m) >= 0; };
    var inHouse = function(m){ return (flat || here).indexOf(m) >= 0; };
    var f = fault(sel);
    if (f) {
      var mouth = here[spk % Math.max(1, here.length)] || here[0];
      return {fault: f, dish: null,
              lines: [line(mouth, FAULT[f][mouth], faultFace(mouth, f))]};
    }
    var made = dish(sel), out = [], list = NAMES.filter(function(n){
      return sel.indexOf(n) >= 0; }).join(', ');
    var P = parts(sel);
    if (here.length === 3) {
      // ⭐ THE TOO MANY COOKS GAG, and it was written before this game existed: these are
      // the kitchen trio lines already sitting in speech.json, reused verbatim rather than
      // rewritten. It fires FIRST and then they get on with it, which is the spec's own
      // shape for this: the comedy lives in the LINES and the generosity in the MECHANICS,
      // so they complain about the room and then do the best work in the game anyway.
      // ⚠️ Baked here rather than fetched. speech.json already holds them, and reading them
      // from there is the tidier end state; this does not, so the two copies can drift.
      // ⛔ BOTH OPENERS USED TO BE HARDCODED and neither looked at the counter, so Alaric
      // mourned greens nobody brought and Vex asked for acid that was already there. Same
      // fault as the lemon line on the Vex and Alaric pair, found the same way: by running
      // the kitchens side by side instead of reading the branch.
      out = [line("vex", "There is not enough room in here for three.", "flat"),
             line("julian", "There is exactly enough room for three. None of it is where you are standing.", "laughing"),
             line("alaric", "I moved.", "neutral"),
             line('alaric', (P.LEAF.length || P.VEG.length)
                    ? 'The greens will not last the week. Everything else keeps.'
                    : 'None of this keeps as it is. I will see what can be made to.'),
             line('vex', P.SHARP.length
                    ? 'The ' + P.SHARP[0] + ' is the only thing here doing any work.'
                    : 'You are short an acid.', 'sharp'),
             line('julian', 'Fine. ' + hi(made.charAt(0).toUpperCase() + made.slice(1))
                  + '. I will write it down as I go.', 'warm')];
    } else if (has('julian')) {
      out = [line('julian', 'Right. That is ' + hi(made) + '. Give me ten minutes, and I '
                  + 'will write it down as I go.', 'warm')];
      if (has('vex'))
        out.push(line('vex', 'I will do the knife work. That is all I am doing.', 'neutral'));
      if (has('alaric'))
        out.push(line('alaric', 'I will put up whatever you do not use.'));
    } else if (has('vex') && !has('alaric')) {
      out = [line('vex', 'I am not cooking. I am putting these in an order. ' + list
                  + ', in that sequence, at those temperatures, for those times. What you are '
                  + 'holding is ' + hi(made) + '. It is not a recipe.', 'neutral')];
    } else if (has('alaric')) {
      out = [line('alaric', 'That would have been ' + hi(made) + '. It will keep better in '
                  + 'jars, so that is where it is going. Top shelf, dated. You will want it '
                  + 'in February.')];
      // ⛔ TWO THINGS THIS PAIR GOT WRONG BY INHERITING ALARIC'S SOLO, both found by running
      // all seven kitchens side by side rather than by reading the branch.
      // 1. He told you when Julian was back while another man stood next to him, which reads
      //    as not noticing Vex is in the room. That line is for when he is the only one home.
      // 2. Vex named a lemon that had not been brought in. It was hardcoded and never looked
      //    at the counter, so it fired against any basket at all.
      if (has('vex')) {
        out.push(line('vex', 'You brought dinner and he has turned it into February.', 'flat'));
      } else if (!inHouse('julian') && !inHouse('vex')) {
        out.push(line('alaric', 'Julian is back this evening.'));
      }
      // AND FAULT 1 ABOVE WAS ONLY EVER HALF FIXED, WHICH SHE FOUND ON THE LIVE PANE
      // 2026-08-28. The guard was written as has('vex'), so it caught Vex standing next to
      // him and did nothing at all about JULIAN. has() is kitchen-scoped, so on a morning the
      // roll held Julian and Alaric with Julian's sprite two rooms away, the else branch fired
      // and Alaric announced Julian's return for that evening while Julian was home.
      // The comment above already stated the rule, in these words: that line is for when he is
      // the only one home. It was a correct rule guarded by the wrong question. It now asks
      // the right one, against the whole flat rather than the kitchen box.
      // AND WHEN JULIAN IS HOME AND SIMPLY NOT IN THE KITCHEN, NOTHING IS ADDED HERE ON
      // PURPOSE. No line was invented to fill the gap. Alaric's own file is a great deal
      // thought and a little said, so the jars sentence standing alone is him, and a second
      // sentence written to cover a branch would be the pen talking.
    }
    // The cake beat rides on TOP of whatever the kitchen was already going to say, so Vex
    // still refuses to call it cooking and then asks whose birthday it is anyway.
    if (/\bcake\b/.test(made)) {
      var mouth2 = here[spk % Math.max(1, here.length)] || here[0];
      if (mouth2 && CAKE[mouth2]) out.push(line(mouth2, CAKE[mouth2], CAKE_FACE[mouth2]));
    }
    return {fault: null, dish: made, lines: out};
  }

  // THE ASK, and it needs no machinery, which is spec section 4's whole point: this pane
  // cannot send a letter and does not have to, because people in that town already write
  // here. It only has to say so. It rides with the code because the code is the thing worth
  // putting IN a letter, and it fires on a ruined round too, since somebody being told they
  // emptied the flat onto a counter is a better letter than somebody who got it right.
  function settle(sel, here, spk){
    var a = account(sel, here, spk, flatList());
    render(a.lines);
    say('<span class="code">code <b>' + encode(sel, here, spk) + '</b></span>'
        + '<span class="invite">Write to <b>little-bird</b> and tell us what you got up to '
        + 'in the kitchen, and who was in there with you. Send the code and we can see it '
        + 'from this end.</span>');
    served = true; btn.textContent = 'clear the counter';
  }

  // ---- the three behaviours, spec section 3 -------------------------------
  var spk = 0;
  function serve(){
    var here = cooksHere();
    if (!counter.length) { say('Nothing has been brought in yet.'); return; }
    if (!here.length) { say('Nobody is in the kitchen. It piles up on the counter.'); return; }
    spk = (Math.random() * here.length) | 0;
    var f = fault(counter);
    if (f && f !== 'mess') {           // recoverable: go and get more, and no code is owed
      render(account(counter, here, spk, flatList()).lines);
      say('');
      return;
    }
    // HER MECHANIC. Julian is in the flat and not in the kitchen: whoever is in there says
    // go and get him, ONCE, and the round stays live so you can fetch him or cook anyway.
    // THE SUGGESTER IS A ROLL over whoever is standing there, at her word.
    if (inFlat('julian') && here.indexOf('julian') < 0) {
      var sug = here[(Math.random() * here.length) | 0];
      if (!suggested) {
        suggested = true;
        render([SUGGEST[sug] ? line(sug, SUGGEST[sug][0], SUGGEST[sug][1]) : line(sug, 'Julian is in the flat.')]);
        say('Still on the counter. Bring him in, or cook it anyway.');
        return;                       // the round does NOT end, which is the point
      }
      // Asked and refused. They do it anyway and say plainly it will not be his.
      // The warning rides ON TOP of the real account rather than replacing it, so the dish,
      // the fault and the code are all exactly what they would have been.
      var a2 = account(counter, here, spk, flatList());
      if (WARN[sug]) a2.lines.push(line(sug, WARN[sug][0], WARN[sug][1]));
      render(a2.lines);
      say('<span class="code">code <b>' + encode(counter, here, spk) + '</b></span>'
          + '<span class="invite">Write to <b>little-bird</b> and tell us what you got up to '
          + 'in the kitchen, and who was in there with you. Send the code and we can see it '
          + 'from this end.</span>');
      // Remember a bad one cooked without him, so bringing him in next round lands.
      badAlone = !!f;
      served = true; btn.textContent = 'clear the counter';
      return;
    }
    // He was fetched after a bad one. He gets the joke and the man who warned gets the 😏,
    // and it is a FACE rather than an emoji, because the sheets exist for exactly this.
    if (badAlone && here.indexOf('julian') >= 0) {
      badAlone = false;
      var a3 = account(counter, here, spk, flatList());
      a3.lines.push(line('julian', 'I heard about the last one. I am told it was memorable.',
                         'laughing'));
      var told = here.filter(function(m){ return m !== 'julian'; });
      if (told.length) {
        var t = told[(Math.random() * told.length) | 0];
        a3.lines.push(line(t, TOLD[t] || 'I did say.', t === 'vex' ? 'sharp' : 'neutral'));
      }
      render(a3.lines);
      say('<span class="code">code <b>' + encode(counter, here, spk) + '</b></span>'
          + '<span class="invite">Write to <b>little-bird</b> and tell us what you got up to '
          + 'in the kitchen, and who was in there with you. Send the code and we can see it '
          + 'from this end.</span>');
      served = true; btn.textContent = 'clear the counter';
      return;
    }
    // Vex alone still has to be poked into it, and the poke is not part of the record.
    // NOTE the julian test below is the KITCHEN, and it is now correct rather than lucky:
    // the spec says his refusal is only reachable when he is the only one home, and if
    // Julian were in the flat the branch above would have taken the round already.
    if (!f && here.indexOf('vex') >= 0 && here.indexOf('julian') < 0
        && here.indexOf('alaric') < 0) {
      pokes++;
      if (pokes < 3) {
        render([pokes === 1
          ? line('vex', 'No.', 'sharp')
          : line('vex', 'I said no. This is Julian&rsquo;s room and I am not going to '
                 + 'stand in it pretending otherwise.', 'flat')]);
        say('');
        return;
      }
    }
    settle(counter, here, spk);
  }

  // Reading somebody else's code REPLAYS it, it does not run it: nothing on the floor moves
  // and no round of yours is touched. The account comes back out of the same function that
  // wrote it, so what you read is exactly what they saw.
  function read(code){
    var d = decode(code);
    if (!d) {
      // Computed, not written out. It said "Six characters" for a while after the format
      // moved to eight, which is a message that is wrong in the one moment it is read.
      clearSaid();
      say('<b>That code does not read.</b> ' + (ICH + 2)
          + ' characters, as it was written.'); return;
    }
    // ⛔ THE FOURTH ARGUMENT IS THE DECODED KITCHEN AND NOT THE READER'S OWN FLAT. A replayer
    // does not know who else was in the sender's building, so the round is read as though the
    // kitchen were the whole house. That is narrow and it is deterministic, which is the
    // property the code exists to have: eight characters read the same for everybody.
    var a = account(d.sel, d.here, d.spk, d.here);
    var who = d.here.length ? d.here.map(function(m){ return NICE[m]; }).join(', ') : 'nobody';
    render(a.lines);
    say('<b>carried in</b> ' + (d.sel.join(', ') || 'nothing') + ' &middot; <b>kitchen</b> '
        + who + ' &middot; <b>out</b> '
        + (a.dish ? hi(a.dish) : 'nothing that worked'));
  }
  box.addEventListener('keydown', function(e){
    if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); read(box.value); }
  });

  // One reset, used by BOTH ways out, so an abandoned round and a finished one leave the
  // pane in exactly the same state and neither can drift from the other.
  function reset(){
    // ⛔ `suggested` RESETS AND `badAlone` DELIBERATELY DOES NOT. The suggestion is per round;
    // the memory of a bad one cooked without him has to survive into the NEXT round, because
    // that is the round he gets fetched for and the whole told-you-so depends on it.
    on = false; served = false; pokes = 0; counter = []; suggested = false;
    clear();
    document.body.classList.remove('cooking');
    btn.textContent = 'cooking corner';
    clr.style.display = 'none';
    say(''); clearSaid();
  }
  clr.addEventListener('click', reset);

  btn.addEventListener('click', function(){
    if (!on) {
      // HER ASK: starting a round clears what was on screen. And it does not just BLANK a
      // hide and seek that is still running, it ends it, because a game left live behind a
      // cleared message is a man still hidden in a room nobody is looking in any more.
      if (typeof window.__SEEK_END__ === 'function') window.__SEEK_END__();
      clearSaid();
      on = true; btn.textContent = 'cook it';
      clr.style.display = '';        // the way out is available for the whole round
      scatter(); return;
    }
    if (served) { reset(); return; }
    serve();
  });
})();
