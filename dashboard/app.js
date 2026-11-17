// Velocity Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a fastest-money strip drawn from weekly inflows, a
// filterable table, a per-protocol detail dialog with the model's own inputs, the sensitivity
// trio and the protocol's farm plan, the live-token set and the set-aside set. No network:
// every byte it shows is in data.js. "Records no token" is the wording throughout: the
// snapshot is DefiLlama's record, and a protocol on it may still hold a token the record
// does not carry. An implied value is this entry's own claim, never a payout promise.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) { document.getElementById('board').textContent = 'No radar data loaded.'; return; }

  var state = { q: '', category: 'all', chain: 'all', signal: 'all', gainers: false, watch: false, tab: 'board', sort: 'implied', dir: -1, selected: null };

  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'text') n.textContent = attrs[k];
        else if (k === 'html') n.innerHTML = attrs[k];
        else if (k === 'onclick') n.addEventListener('click', attrs[k]);
        else n.setAttribute(k, attrs[k]);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      if (typeof c === 'string') n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    }
    return n;
  }

  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function signedMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n >= 0 ? '+' : '\u2212') + money(Math.abs(n)).slice(0);
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function ageText(d) {
    if (d === null || d === undefined) return 'n/a';
    if (d < 365) return d + 'd';
    return (d / 365).toFixed(1) + 'y';
  }
  function chainsText(r) { return (r.chains || []).join(', ') || 'n/a'; }

  var SIGNAL_LABEL = { breakout: 'Breakout', fresh: 'Fresh', overdue: 'Overdue giant', cooling: 'Cooling', steady: 'Steady' };

  function readHash() {
    var h = location.hash.replace(/^#/, '');
    var parts = h.split('&');
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      var k = decodeURIComponent(kv[0] || '');
      var v = decodeURIComponent(kv[1] || '');
      if (k === 'p' && v) state.selected = v;
      if (k === 'signal' && SIGNAL_LABEL[v]) state.signal = v;
      if (k === 'category' && v) state.category = v;
    }
  }
  function writeHash() {
    var bits = [];
    if (state.selected) bits.push('p=' + encodeURIComponent(state.selected));
    if (state.signal !== 'all') bits.push('signal=' + state.signal);
    if (state.category !== 'all') bits.push('category=' + encodeURIComponent(state.category));
    var next = bits.length ? '#' + bits.join('&') : '#';
    if (location.hash !== next) history.replaceState(null, '', next);
  }

  function matches(r) {
    if (state.q) {
      var q = state.q.toLowerCase();
      var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
    if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) === -1) return false;
    if (state.signal !== 'all' && r.signal !== state.signal) return false;
    if (state.gainers && !(r.change_7d !== null && r.change_7d > 0)) return false;
    if (state.watch && !r.watchlist) return false;
    return true;
  }

  function sortedRows(list) {
    var key = state.sort;
    var dir = state.dir;
    function num(a, b) { return (a === null || a === undefined ? -Infinity : a) - (b === null || b === undefined ? -Infinity : b); }
    return list.slice().sort(function (a, b) {
      var d = 0;
      if (key === 'implied') d = num(a.implied_value_usd, b.implied_value_usd);
      else if (key === 'inflow') d = num(a.weekly_inflow_usd, b.weekly_inflow_usd);
      else if (key === 'growth') d = num(a.change_7d, b.change_7d);
      else if (key === 'tvl') d = num(a.tvl_usd, b.tvl_usd);
      else if (key === 'age') d = num(a.age_days, b.age_days);
      else if (key === 'heat') d = num(a.heat, b.heat);
      else if (key === 'name') d = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      if (d === 0) d = a.rank - b.rank;
      return d * dir;
    });
  }

  function badge(signal) {
    return el('span', { 'class': 'badge ' + signal, text: SIGNAL_LABEL[signal] || signal });
  }

  function rowCells(r) {
    var g = r.change_7d;
    var nameCell = el('td', null,
      el('span', { 'class': 'pname', text: r.name }),
      r.watchlist ? el('span', { 'class': 'watch', text: 'WATCHLIST' }) : null,
      el('span', { 'class': 'pmeta', text: (r.category || 'Other') + ' \u00b7 ' + chainsText(r) }));
    return [
      el('td', { 'class': 'num', text: String(r.rank) }),
      nameCell,
      el('td', { 'class': 'num', text: money(r.tvl_usd) }),
      el('td', { 'class': 'num ' + (g === null ? '' : g >= 0 ? 'pos' : 'neg'), text: pct(g) }),
      el('td', { 'class': 'num ' + (r.weekly_inflow_usd >= 0 ? 'pos' : 'neg'), text: signedMoney(r.weekly_inflow_usd) }),
      el('td', null,
        el('span', { 'class': 'heatbar', html: '<i style="width:' + r.heat + '%"></i>' }),
        el('span', { 'class': 'heatnum', text: String(r.heat) })),
      el('td', { 'class': 'num', text: money(r.implied_value_usd) }),
      el('td', null, badge(r.signal)),
    ];
  }

  function boardTable() {
    var list = sortedRows(DATA.rows.filter(matches));
    var table = el('table', null);
    var head = el('thead', null, el('tr', null));
    function sortHeader(key, label, cls) {
      var btn = el('button', {
        'class': 'sortbtn', type: 'button', text: label + (state.sort === key ? (state.dir < 0 ? ' \u25bc' : ' \u25b2') : ''),
        onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); }
      });
      head.firstChild.appendChild(el('th', { 'class': cls || '' }, btn));
    }
    sortHeader('implied', 'Rank', 'num');
    head.firstChild.appendChild(el('th', { text: 'Protocol' }));
    sortHeader('tvl', 'TVL', 'num');
    sortHeader('growth', '7d', 'num');
    sortHeader('inflow', 'Inflow / week', 'num');
    sortHeader('heat', 'Heat', '');
    sortHeader('implied', 'Implied value', 'num');
    head.firstChild.appendChild(el('th', { text: 'Signal' }));
    table.appendChild(head);
    var body = el('tbody', null);
    list.forEach(function (r) {
      var tr = el('tr', { onclick: function () { openDetail(r.slug); } });
      rowCells(r).forEach(function (c) { tr.appendChild(c); });
      body.appendChild(tr);
    });
    table.appendChild(body);
    if (list.length === 0) {
      return el('div', { 'class': 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category, chain or signal to see the board again.' }),
        el('button', {
          'class': 'button primary', type: 'button', text: 'Clear filters',
          onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.signal = 'all'; state.gainers = false; state.watch = false; writeHash(); render(); }
        }));
    }
    return table;
  }

  function liveTable() {
    var table = el('table', null);
    table.appendChild(el('thead', null, el('tr', null,
      el('th', { text: 'Protocol' }), el('th', { 'class': 'num', text: 'TVL' }),
      el('th', { 'class': 'num', text: 'Market cap' }), el('th', { 'class': 'num', text: '7d' }))));
    var body = el('tbody', null);
    DATA.live.forEach(function (r) {
      body.appendChild(el('tr', { onclick: function () {} },
        el('td', null, el('span', { 'class': 'pname', text: r.name }), el('span', { 'class': 'pmeta', text: (r.category || 'Other') + ' \u00b7 ' + chainsText(r) })),
        el('td', { 'class': 'num', text: money(r.tvl_usd) }),
        el('td', { 'class': 'num', text: money(r.mcap_usd) }),
        el('td', { 'class': 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: pct(r.change_7d) })));
    });
    table.appendChild(body);
    return el('div', null,
      el('p', { 'class': 'count', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
      table);
  }

  function asideTable() {
    var list = DATA.aside.filter(function (r) {
      if (state.q) {
        var q = state.q.toLowerCase();
        if ((r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) === -1) return false;
      }
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      return true;
    });
    var table = el('table', null);
    table.appendChild(el('thead', null, el('tr', null,
      el('th', { text: 'Protocol' }), el('th', { 'class': 'num', text: 'TVL' }),
      el('th', { 'class': 'num', text: '7d' }), el('th', { text: 'Why it is set aside' }))));
    var body = el('tbody', null);
    list.forEach(function (r) {
      body.appendChild(el('tr', { onclick: function () {} },
        el('td', null, el('span', { 'class': 'pname', text: r.name }), el('span', { 'class': 'pmeta', text: (r.category || 'Other') + ' \u00b7 ' + chainsText(r) })),
        el('td', { 'class': 'num', text: money(r.tvl_usd) }),
        el('td', { 'class': 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: pct(r.change_7d) }),
        el('td', { text: r.reason })));
    });
    table.appendChild(body);
    return el('div', null,
      el('p', { 'class': 'count', text: list.length + ' pre-token protocols set aside, with the reason each one is not ranked. The watchlist rule is the test: a protocol the list leaves out is no worse a subject, but a wrapped, staked, bridged or exchange product is a different thing entirely.' }),
      table);
  }

  function detailDialog() {
    var dialog = el('dialog', { 'class': 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
    document.body.appendChild(dialog);
    return dialog;
  }

  function openDetail(slug) {
    var r = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) { r = DATA.rows[i]; break; }
    if (!r) return;
    state.selected = slug;
    writeHash();
    var d = document.getElementById('detail');
    if (!d) d = detailDialog();
    while (d.firstChild) d.removeChild(d.firstChild);
    var body = el('div', { 'class': 'detail-body' });
    body.appendChild(el('button', { 'class': 'close', type: 'button', text: 'Close', onclick: function () { closeDetail(); } }));
    body.appendChild(el('h2', { id: 'detail-title', text: '#' + r.rank + ' ' + r.name }));
    body.appendChild(el('p', { 'class': 'meta', text: (r.category || 'Other') + ' \u00b7 ' + chainsText(r) + ' \u00b7 listed ' + (r.listed_at || 'n/a') + ' \u00b7 age ' + ageText(r.age_days) + (r.watchlist ? ' \u00b7 on the watchlist' : '') }));
    body.appendChild(badge(r.signal));
    body.appendChild(el('h3', { text: 'Why it ranks here' }));
    var ft = el('table', null);
    ft.appendChild(el('thead', null, el('tr', null, el('th', { text: 'Factor' }), el('th', { 'class': 'num', text: 'Value' }))));
    var fb = el('tbody', null);
    var factors = [
      ['TVL', money(r.tvl_usd)],
      ['7-day TVL change', pct(r.change_7d)],
      ['Weekly inflow', signedMoney(r.weekly_inflow_usd)],
      ['Velocity (log-compressed week)', String(r.velocity)],
      ['Velocity multiplier', '\u00d7' + r.velocity_multiplier],
      ['Age factor', '\u00d7' + r.age_factor],
      ['Breadth multiplier', '\u00d7' + r.breadth_multiplier],
      ['Heat', r.heat + ' / 100'],
      ['Implied value', money(r.implied_value_usd)],
      ['Farm work', r.farm_hours + ' active hours'],
    ];
    factors.forEach(function (f) {
      fb.appendChild(el('tr', { onclick: function () {} }, el('td', { text: f[0] }), el('td', { 'class': 'num', text: f[1] })));
    });
    ft.appendChild(fb);
    body.appendChild(ft);
    body.appendChild(el('h3', { text: 'If the week had gone differently' }));
    body.appendChild(el('p', { 'class': 'meta', text: 'The implied value again with the 7-day change at \u221210%, as reported, and +25% \u2014 everything else held fixed. A rank that survives a bad week is a rank built on size and age, not on one spike.' }));
    var sens = el('div', { 'class': 'sens' });
    sens.appendChild(el('div', null, el('span', { text: 'At \u221210% this week' }), el('b', { text: money(r.sensitivity_down_usd) })));
    sens.appendChild(el('div', null, el('span', { text: 'As reported (' + pct(r.change_7d) + ')' }), el('b', { text: money(r.implied_value_usd) })));
    sens.appendChild(el('div', null, el('span', { text: 'At +25% this week' }), el('b', { text: money(r.sensitivity_up_usd) })));
    body.appendChild(sens);
    body.appendChild(el('h3', { text: 'How to farm it' }));
    var ol = el('ol', null);
    r.farm_steps.forEach(function (s) { ol.appendChild(el('li', { text: s })); });
    body.appendChild(ol);
    body.appendChild(el('p', { 'class': 'note', text: 'Implied value is this radar\u2019s own claim about what a token would be worth if the protocol\u2019s record stayed as it is. It is not a prediction that a token will launch, and never a payout promise.' }));
    d.appendChild(body);
    if (!d.open) d.showModal();
  }

  function closeDetail() {
    var d = document.getElementById('detail');
    if (d && d.open) d.close();
    state.selected = null;
    writeHash();
  }

  function render() {
    var root = document.getElementById('board');
    root.setAttribute('aria-busy', 'false');
    while (root.firstChild) root.removeChild(root.firstChild);

    var top = DATA.rows[0];
    root.appendChild(el('h1', null, 'Velocity ', el('span', { 'class': 'vel', text: 'Radar' })));
    root.appendChild(el('p', { 'class': 'lede', html: '' }));
    root.lastChild.appendChild(document.createTextNode('Which pre-token protocol is worth farming next? This radar answers with '));
    root.lastChild.appendChild(el('b', { text: 'velocity' }));
    root.lastChild.appendChild(document.createTextNode(' \u2014 the dollars moving into a protocol this week, how young it still is, and how big it already is \u2014 not with size alone. Snapshot ' + DATA.as_of + '; every figure below comes from that snapshot.'));
    var facts = el('div', { 'class': 'facts' });
    facts.appendChild(el('div', { 'class': 'fact' }, el('span', { text: 'Protocols ranked' }), el('b', { text: String(DATA.board_size) })));
    facts.appendChild(el('div', { 'class': 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })));
    facts.appendChild(el('div', { 'class': 'fact' }, el('span', { text: 'Top implied value' }), el('b', { text: money(top.implied_value_usd) })));
    facts.appendChild(el('div', { 'class': 'fact' }, el('span', { text: 'Top protocol' }), el('b', { text: top.name })));
    facts.appendChild(el('div', { 'class': 'fact' }, el('span', { text: 'Live-token set aside' }), el('b', { text: String(DATA.live_size) })));
    root.appendChild(facts);

    var fastest = DATA.rows.slice().sort(function (a, b) { return b.weekly_inflow_usd - a.weekly_inflow_usd; }).slice(0, 5);
    var maxIn = fastest.length ? fastest[0].weekly_inflow_usd : 1;
    var strip = el('section', { 'class': 'strip', 'aria-label': 'Fastest money this week' });
    strip.appendChild(el('h2', { text: 'Fastest money this week' }));
    strip.appendChild(el('p', { 'class': 'sub', text: 'The largest weekly dollar inflows among the ranked protocols. Money arriving now is the radar\u2019s first signal; the board itself still ranks by implied value.' }));
    var flow = el('div', { 'class': 'flow' });
    fastest.forEach(function (r) {
      var btn = el('button', { type: 'button', onclick: function () { openDetail(r.slug); } });
      btn.appendChild(el('span', { 'class': 'nm', text: '#' + r.rank + ' ' + r.name }));
      btn.appendChild(el('span', { 'class': 'amt', text: signedMoney(r.weekly_inflow_usd) }));
      btn.appendChild(el('span', { 'class': 'bar', html: '<i style="width:' + Math.max(4, Math.round(100 * r.weekly_inflow_usd / maxIn)) + '%"></i>' }));
      flow.appendChild(btn);
    });
    strip.appendChild(flow);
    root.appendChild(strip);

    var panel = el('section', { 'class': 'panel' });
    var filters = el('div', { 'class': 'filters' });
    var qInput = el('input', { type: 'search', placeholder: 'Search a protocol\u2026', value: state.q, 'aria-label': 'Search protocols' });
    qInput.addEventListener('input', function () { state.q = qInput.value; render(); });
    filters.appendChild(el('div', { 'class': 'field' }, el('span', { text: 'Search' }), qInput));
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var catSel = el('select', { 'aria-label': 'Category' });
    catSel.appendChild(el('option', { value: 'all', text: 'All categories' }));
    categories.forEach(function (c) { catSel.appendChild(el('option', { value: c, text: c })); });
    catSel.value = state.category;
    catSel.addEventListener('change', function () { state.category = catSel.value; writeHash(); render(); });
    filters.appendChild(el('div', { 'class': 'field' }, el('span', { text: 'Category' }), catSel));
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var chainSel = el('select', { 'aria-label': 'Chain' });
    chainSel.appendChild(el('option', { value: 'all', text: 'All chains' }));
    chains.forEach(function (c) { chainSel.appendChild(el('option', { value: c, text: c })); });
    chainSel.value = state.chain;
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; render(); });
    filters.appendChild(el('div', { 'class': 'field' }, el('span', { text: 'Chain' }), chainSel));
    var sigSel = el('select', { 'aria-label': 'Signal' });
    sigSel.appendChild(el('option', { value: 'all', text: 'All signals' }));
    Object.keys(SIGNAL_LABEL).forEach(function (s) { sigSel.appendChild(el('option', { value: s, text: SIGNAL_LABEL[s] })); });
    sigSel.value = state.signal;
    sigSel.addEventListener('change', function () { state.signal = sigSel.value; writeHash(); render(); });
    filters.appendChild(el('div', { 'class': 'field' }, el('span', { text: 'Signal' }), sigSel));
    var sortSel = el('select', { 'aria-label': 'Sort by' });
    [['implied', 'Implied value'], ['inflow', 'Weekly inflow'], ['growth', '7-day change'], ['tvl', 'TVL'], ['heat', 'Heat'], ['age', 'Age'], ['name', 'Name']].forEach(function (o) {
      sortSel.appendChild(el('option', { value: o[0], text: o[1] }));
    });
    sortSel.value = state.sort;
    sortSel.addEventListener('change', function () { state.sort = sortSel.value; state.dir = -1; render(); });
    filters.appendChild(el('div', { 'class': 'field' }, el('span', { text: 'Sort by' }), sortSel));
    var checks = el('div', { 'class': 'checks' });
    var gChk = el('input', { type: 'checkbox', id: 'gainers' });
    gChk.checked = state.gainers;
    gChk.addEventListener('change', function () { state.gainers = gChk.checked; render(); });
    checks.appendChild(el('label', { 'for': 'gainers' }, gChk, document.createTextNode(' Gainers only')));
    var wChk = el('input', { type: 'checkbox', id: 'watchonly' });
    wChk.checked = state.watch;
    wChk.addEventListener('change', function () { state.watch = wChk.checked; render(); });
    checks.appendChild(el('label', { 'for': 'watchonly' }, wChk, document.createTextNode(' Watchlist only')));
    filters.appendChild(checks);
    panel.appendChild(filters);
    var tabs = el('div', { 'class': 'tabs' });
    [['board', 'Pre-token board'], ['live', 'Live token'], ['aside', 'Set aside']].forEach(function (t) {
      tabs.appendChild(el('button', {
        'class': 'tab', type: 'button', 'aria-pressed': state.tab === t[0] ? 'true' : 'false', text: t[1],
        onclick: function () { state.tab = t[0]; render(); }
      }));
    });
    panel.appendChild(tabs);
    var shown = state.tab === 'board' ? DATA.rows.filter(matches).length : state.tab === 'live' ? DATA.live.length : DATA.aside.length;
    var total = state.tab === 'board' ? DATA.board_size : state.tab === 'live' ? DATA.live_size : DATA.aside_size;
    panel.appendChild(el('p', { 'class': 'count', html: '' }));
    panel.lastChild.appendChild(el('b', { text: String(shown) }));
    panel.lastChild.appendChild(document.createTextNode(' of ' + total + (state.tab === 'board' ? ' ranked rows shown' : state.tab === 'live' ? ' live-token protocols' : ' set-aside protocols') + '. Click a row for its detail, its sensitivity and its farm plan.'));
    panel.appendChild(state.tab === 'board' ? boardTable() : state.tab === 'live' ? liveTable() : asideTable());
    root.appendChild(panel);

    var m = DATA.model;
    var model = el('section', { 'class': 'panel model' });
    model.appendChild(el('h2', { text: 'How implied value is computed' }));
    model.appendChild(el('p', { html: '' }));
    model.lastChild.appendChild(document.createTextNode('Model '));
    model.lastChild.appendChild(el('b', { text: DATA.model_version }));
    model.lastChild.appendChild(document.createTextNode(': implied value = 90 \u00d7 TVL^0.75 \u00d7 velocity multiplier \u00d7 age factor \u00d7 breadth. TVL enters sublinearly, so size helps but cannot dominate. The velocity multiplier is 1 + 0.60 \u00d7 velocity, where velocity is the week\u2019s TVL change, winsorized to [\u221250%, +300%] and log-compressed as sign(g) \u00d7 ln(1 + |g| / 25), clamped to [\u22121.0, +1.5]. The age factor is a hump: 0.85 under 30 days, 1.05 under 90, 1.20 under 180, 1.15 under 540, 1.00 under 3 years, 0.90 under 4, 0.80 beyond \u2014 young and proven beats brand-new and beats long-overdue. Breadth adds 0.05 per extra chain, up to 6. No protocol name is ever special-cased; the same function scores every row.'));
    model.appendChild(el('p', { html: '' }));
    model.lastChild.appendChild(document.createTextNode('Heat is the velocity on a 0\u2013100 scale. Weekly inflow is TVL \u00d7 the week\u2019s change: the dollars that actually moved. The sensitivity trio replays each row at \u221210% and +25% for the week, so a rank built on one spike is visible as one.'));
    var sigTable = el('table', null);
    sigTable.appendChild(el('thead', null, el('tr', null, el('th', { text: 'Signal' }), el('th', { text: 'What it means' }), el('th', { 'class': 'num', text: 'Rows' }))));
    var sigBody = el('tbody', null);
    var counts = {};
    DATA.rows.forEach(function (r) { counts[r.signal] = (counts[r.signal] || 0) + 1; });
    var sigText = {
      breakout: 'Grew 20% or more this week with over $1M flowing in: money is arriving now.',
      fresh: 'Listed under 180 days ago and growing: young, early, still ahead of any token.',
      overdue: 'Over $500M of TVL and listed over 540 days ago: the launch, if it ever comes, is long overdue.',
      cooling: 'Down 20% or more this week: money is leaving; farm small or wait.',
      steady: 'None of the above: a plain rank on size, velocity and age.'
    };
    Object.keys(SIGNAL_LABEL).forEach(function (s) {
      sigBody.appendChild(el('tr', { onclick: function () { state.signal = s; writeHash(); render(); } },
        el('td', null, badge(s)), el('td', { text: sigText[s] }), el('td', { 'class': 'num', text: String(counts[s] || 0) })));
    });
    sigTable.appendChild(sigBody);
    model.appendChild(sigTable);
    model.appendChild(el('p', { 'class': 'note', text: 'Snapshot ' + DATA.as_of + ', ' + DATA.board_size + ' ranked rows, watchlist ' + DATA.watchlist_size + ' of ' + DATA.watchlist_size + ' covered, ' + DATA.live_size + ' live-token protocols and ' + DATA.aside_size + ' pre-token protocols set aside with reasons. A protocol \u201crecords no token\u201d when the snapshot carries no market cap, no CoinGecko id and no symbol for it; the record is not proof it has none.' }));
    root.appendChild(model);
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () { readHash(); render(); if (state.selected) openDetail(state.selected); });
  if (state.selected) openDetail(state.selected);
})();
