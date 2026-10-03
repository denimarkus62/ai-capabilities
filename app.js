(function () {
  var REPO = "denimarkus62/ai-capabilities";
  var MODES = {
    own:   { name: "Сам", color: "m-own", hint: "Делаю в чате и в файлах без внешних подключений" },
    tool:  { name: "Инструменты", color: "m-tool", hint: "Браузер, терминал, SSH, скрипты и планировщик на вашем компьютере" },
    file:  { name: "Через файлы", color: "m-file", hint: "Выгрузки и загрузки: Excel, CSV, XML, PDF, docx" },
    api:   { name: "Через API", color: "m-api", hint: "Нужен токен или ключ сервиса. Без него готовлю материал, но не вижу данные" },
    conn:  { name: "Коннектор", color: "m-conn", hint: "Готовый коннектор из каталога Claude, нужна авторизация владельцем аккаунта" },
    mcp:   { name: "MCP", color: "m-mcp", hint: "MCP-сервер, уже подключенный здесь или написанный под вашу задачу" },
    human: { name: "Нужен человек", color: "m-human", hint: "Физическое действие, подпись, звонок, ответственность или решение" },
    none:  { name: "Не делаю", color: "m-none", hint: "Запрещено правилами сервиса или безопасностью, либо нет способа подключиться" }
  };
  var MODE_ORDER = ["own", "tool", "file", "api", "conn", "mcp", "human", "none"];
  var ACCESS = {
    ready:   { name: "Подключено", color: "m-own", hint: "Работает в рабочей среде сейчас" },
    tool:    { name: "На компьютере", color: "m-tool", hint: "Работает через инструменты на компьютере" },
    file:    { name: "Через файлы", color: "m-file", hint: "Работаю с выгрузками и файлами сервиса" },
    api:     { name: "Нужен ключ API", color: "m-api", hint: "Нужен токен, ключ или пароль приложения" },
    conn:    { name: "Нужен коннектор", color: "m-conn", hint: "Есть в каталоге коннекторов, нужна авторизация" },
    browser: { name: "Через браузер", color: "m-mcp", hint: "Только публичная часть или ваш вход в интерфейс" },
    none:    { name: "Закрыто", color: "m-none", hint: "Доступ запрещен правилами или невозможен" }
  };
  var ACCESS_ORDER = ["ready", "tool", "file", "api", "conn", "browser", "none"];
  var BANDS = [
    { min: 8.5, cls: "s-g", name: "9 и 10", text: "Делаю сам на уровне сильного специалиста. Вам остается проверить результат." },
    { min: 7, cls: "s-b", name: "7 и 8", text: "Делаю хорошо. Нужна проверка человеком или одно подключение." },
    { min: 5, cls: "s-a", name: "5 и 6", text: "Помогаю частично. Нужны подключения, доступы или ваша экспертиза." },
    { min: 0, cls: "s-r", name: "0 до 4", text: "Только подсказки. Основную работу делает человек." }
  ];
  var BAR_COLOR = { g: "var(--g)", b: "var(--b)", a: "var(--a)", r: "var(--r)" };

  function prep(list, prefix) {
    return list.map(function (p, i) {
      var sum = 0;
      p.t.forEach(function (t) { sum += t[1]; });
      p.id = i + 1;
      p.key = prefix + (i + 1);
      p.avg = Math.round((sum / p.t.length) * 10) / 10;
      p.modes = {};
      p.t.forEach(function (t) { p.modes[t[2]] = (p.modes[t[2]] || 0) + 1; });
      return p;
    });
  }
  var profs = prep(window.PROFESSIONS, "p");
  var svcs = prep(window.SERVICES, "s");
  var byName = { p: {}, s: {} };
  profs.forEach(function (p) { byName.p[p.n] = p; p.svc = []; });
  svcs.forEach(function (s) { byName.s[s.n] = s; });
  svcs.forEach(function (s) {
    s.prof = [];
    (s.pr || []).forEach(function (n) {
      var p = byName.p[n];
      if (p) { s.prof.push(p); p.svc.push(s); }
    });
  });

  function cats(list) { var r = []; list.forEach(function (p) { if (r.indexOf(p.c) < 0) r.push(p.c); }); return r; }
  var CATS = { p: cats(profs), s: cats(svcs) };

  var state = { tab: "p", q: "", cat: "", mode: "", acc: "", sort: "score" };
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function band(v) { for (var i = 0; i < BANDS.length; i++) if (v >= BANDS[i].min) return BANDS[i]; return BANDS[3]; }
  function bandKey(v) { return band(v).cls.slice(2); }
  function fmt(v) { return String(v).replace(".", ","); }
  function cur() { return state.tab === "s" ? svcs : profs; }

  function renderStats() {
    var tasks = 0, total = 0, own = 0, human = 0;
    profs.concat(svcs).forEach(function (p) { p.t.forEach(function (t) { tasks++; total += t[1]; if (t[2] === "own") own++; if (t[2] === "human" || t[2] === "none") human++; }); });
    var cards = [
      [profs.length, "профессий"],
      [svcs.length, "сервисов и инструментов"],
      [tasks, "задач с оценкой"],
      [fmt(Math.round(total / tasks * 10) / 10), "средний балл по всем задачам"],
      [Math.round(own / tasks * 100) + "%", "задач делаю сам, без подключений"],
      [Math.round(human / tasks * 100) + "%", "задач остаются за человеком или закрыты"]
    ];
    $("stats").innerHTML = cards.map(function (c) { return '<div class="stat"><b>' + c[0] + '</b><span>' + c[1] + '</span></div>'; }).join("");
  }

  function renderCats() {
    var list = cur();
    $("cats").innerHTML = CATS[state.tab].map(function (c) {
      var l = list.filter(function (p) { return p.c === c; });
      var a = Math.round(l.reduce(function (s, p) { return s + p.avg; }, 0) / l.length * 10) / 10;
      return '<div class="catrow"><span>' + esc(c) + ' <small>' + l.length + '</small></span><span class="bar"><i style="width:' + a * 10 + '%;background:' + BAR_COLOR[bandKey(a)] + '"></i></span><em>' + fmt(a) + '</em></div>';
    }).join("");
  }

  function renderChips() {
    var items = ['<button class="chip" data-cat="" aria-pressed="' + (state.cat === "") + '">Все</button>'].concat(CATS[state.tab].map(function (c) {
      return '<button class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (state.cat === c) + '">' + esc(c) + '</button>';
    }));
    $("chips").innerHTML = items.join("");
  }

  function haystack(p) {
    return (p.n + " " + p.c + " " + p.d + " " + p.t.map(function (t) { return t[0] + " " + (t[3] || ""); }).join(" ") + " " + (p.pr || []).join(" ") + " " + (p.svc ? p.svc.map(function (s) { return s.n; }).join(" ") : "")).toLowerCase();
  }
  function matchQ(p) { return !state.q || haystack(p).indexOf(state.q) >= 0; }
  function match(p) {
    if (state.cat && p.c !== state.cat) return false;
    if (state.mode && !p.modes[state.mode]) return false;
    if (state.tab === "s" && state.acc && p.a !== state.acc) return false;
    return matchQ(p);
  }

  function mix(p) {
    var n = p.t.length;
    return MODE_ORDER.filter(function (k) { return p.modes[k]; }).map(function (k) {
      return '<i class="' + MODES[k].color + '" style="width:' + (p.modes[k] / n * 100) + '%" title="' + MODES[k].name + ': ' + p.modes[k] + '"></i>';
    }).join("");
  }

  function renderTabs() {
    var qp = profs.filter(matchQ).length, qs = svcs.filter(matchQ).length;
    var q = state.q ? true : false;
    $("tabP").innerHTML = 'Профессии <span>' + (q ? qp + " из " : "") + profs.length + '</span>';
    $("tabS").innerHTML = 'Сервисы <span>' + (q ? qs + " из " : "") + svcs.length + '</span>';
    $("tabC").innerHTML = 'Что подключить в первую очередь';
    [["tabP", "p"], ["tabS", "s"], ["tabC", "c"]].forEach(function (x) { $(x[0]).setAttribute("aria-selected", state.tab === x[1] ? "true" : "false"); });
    $("hintOther").innerHTML = "";
    if (q && state.tab === "p" && qp === 0 && qs > 0) $("hintOther").innerHTML = 'Среди профессий ничего нет, но в сервисах нашлось: ' + qs + '. <button class="link" data-go="s">Показать сервисы</button>';
    if (q && state.tab === "s" && qs === 0 && qp > 0) $("hintOther").innerHTML = 'Среди сервисов ничего нет, но в профессиях нашлось: ' + qp + '. <button class="link" data-go="p">Показать профессии</button>';
  }

  function cardHtml(p) {
    var b = band(p.avg);
    var tags = MODE_ORDER.filter(function (k) { return p.modes[k]; }).map(function (k) {
      return '<span class="tag"><b>' + p.modes[k] + '</b> ' + MODES[k].name.toLowerCase() + '</span>';
    }).join("");
    var sub = p.key[0] === "s"
      ? '<span class="badge ' + ACCESS[p.a].color + '" title="' + esc(ACCESS[p.a].hint) + '">' + ACCESS[p.a].name + '</span> <span class="cat">' + esc(p.c) + '</span>'
      : '<span class="cat">' + esc(p.c) + '</span>';
    var rel = p.key[0] === "s"
      ? (p.prof.length ? '<div class="rel">Нужен профессиям: ' + p.prof.length + '</div>' : '')
      : (p.svc.length ? '<div class="rel">Сервисы: ' + p.svc.slice(0, 3).map(function (s) { return esc(s.n); }).join(", ") + (p.svc.length > 3 ? " и еще " + (p.svc.length - 3) : "") + '</div>' : '');
    return '<button class="card" data-key="' + p.key + '"><div class="head"><div><h3>' + esc(p.n) + '</h3><div class="sub2">' + sub + '</div></div>' +
      '<div class="score ' + b.cls + '"><span>' + fmt(p.avg) + '</span></div></div>' +
      '<p>' + esc(p.d) + '</p><div class="mix">' + mix(p) + '</div><div class="tags">' + tags + '</div>' + rel + '</button>';
  }

  function renderGrid() {
    var list = cur().filter(match);
    if (state.sort === "score") list.sort(function (a, b) { return b.avg - a.avg || a.n.localeCompare(b.n, "ru"); });
    else if (state.sort === "scoreAsc") list.sort(function (a, b) { return a.avg - b.avg || a.n.localeCompare(b.n, "ru"); });
    else list.sort(function (a, b) { return a.n.localeCompare(b.n, "ru"); });
    $("count").textContent = "Показано: " + list.length + " из " + cur().length;
    if (!list.length) { $("grid").innerHTML = '<p class="empty">Ничего не нашли. Попробуйте другое слово или сбросьте фильтры.</p>'; return; }
    $("grid").innerHTML = list.map(cardHtml).join("");
  }

  function renderConnect() {
    var todo = svcs.filter(function (s) { return (s.a === "api" || s.a === "conn") && s.prof.length; });
    todo.sort(function (a, b) { return b.prof.length - a.prof.length || a.n.localeCompare(b.n, "ru"); });
    var max = todo.length ? todo[0].prof.length : 1;
    $("connectList").innerHTML = todo.slice(0, 30).map(function (s, i) {
      return '<button class="crow" data-key="' + s.key + '"><span class="rank">' + (i + 1) + '</span>' +
        '<span class="cname"><b>' + esc(s.n) + '</b><small>' + esc(s.k) + '</small></span>' +
        '<span class="badge ' + ACCESS[s.a].color + '">' + ACCESS[s.a].name + '</span>' +
        '<span class="cbar"><i style="width:' + (s.prof.length / max * 100) + '%"></i></span><span class="cnum">' + s.prof.length + '</span></button>';
    }).join("");
  }

  function setTab(t, keepQ) {
    state.tab = t; state.cat = ""; state.mode = ""; state.acc = "";
    $("mode").value = ""; $("acc").value = "";
    var c = t === "c";
    $("filters").hidden = c; $("cats").hidden = c; $("count").hidden = c; $("grid").hidden = c; $("hintOther").hidden = c;
    $("connect").hidden = !c;
    $("acc").hidden = t !== "s";
    if (!c) { renderChips(); renderCats(); renderGrid(); }
    renderTabs();
  }

  function listHtml(items, label) {
    if (!items.length) return "";
    return '<div class="box"><b>' + label + '</b><div class="links">' + items.map(function (x) {
      return '<button class="lk" data-key="' + x.key + '">' + esc(x.n) + ' <small>' + fmt(x.avg) + '</small></button>';
    }).join("") + '</div></div>';
  }

  function openItem(key, push) {
    var kind = key[0], id = parseInt(key.slice(1), 10);
    var p = (kind === "s" ? svcs : profs).filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var b = band(p.avg);
    var rows = p.t.slice().sort(function (a, c) { return c[1] - a[1]; }).map(function (t) {
      var bk = bandKey(t[1]);
      var m = MODES[t[2]];
      return '<div class="task"><div><div class="tt">' + esc(t[0]) + '</div>' +
        (t[3] ? '<div class="via">' + esc(t[3]) + '</div>' : '') +
        '<span class="badge ' + m.color + '" title="' + esc(m.hint) + '">' + m.name + '</span></div>' +
        '<div class="meter"><div class="mbar"><i style="width:' + t[1] * 10 + '%;background:' + BAR_COLOR[bk] + '"></i></div><span class="num">' + t[1] + '</span></div></div>';
    }).join("");
    var link = location.href.split("#")[0] + "#" + p.key;
    var acc = kind === "s" ? '<span class="badge ' + ACCESS[p.a].color + '" title="' + esc(ACCESS[p.a].hint) + '">' + ACCESS[p.a].name + '</span> ' : "";
    var related = kind === "s" ? listHtml(p.prof, "Профессии, которым это нужно") : listHtml(p.svc, "Сервисы и инструменты для этой профессии");
    $("mBody").innerHTML =
      '<div class="mh"><div class="score ' + b.cls + '"><span>' + fmt(p.avg) + '</span></div><div><h2 id="mTitle">' + esc(p.n) + '</h2><div class="cat" style="color:var(--muted)">' + acc + esc(p.c) + '</div></div></div>' +
      '<p class="desc">' + esc(p.d) + '</p>' + rows +
      '<div class="box"><b>Чего не могу</b>' + esc(p.l) + '</div>' +
      '<div class="box"><b>Что подключить, чтобы стало лучше</b>' + esc(p.k) + '</div>' + related +
      '<p class="share">Ссылка: <a href="' + esc(link) + '">' + esc(link) + '</a></p>';
    $("modal").hidden = false;
    document.body.style.overflow = "hidden";
    $("sheet").scrollTop = 0; $("modal").scrollTop = 0;
    $("close").focus();
    if (push) history.replaceState(null, "", "#" + p.key);
  }

  function closeItem() {
    $("modal").hidden = true;
    document.body.style.overflow = "";
    history.replaceState(null, "", location.pathname + location.search);
  }

  function renderLegend() {
    var box = function (cls, name, text) { return '<div class="lgi"><b><span class="dot ' + cls + '"></span>' + name + '</b>' + esc(text) + '</div>'; };
    $("legend").innerHTML = '<h2>Как читать оценки</h2><div class="lg">' + BANDS.map(function (b) { return box(b.cls, b.name, b.text); }).join("") + '</div>' +
      '<h2 style="margin-top:22px">Способы, которыми я делаю работу</h2><div class="lg">' + MODE_ORDER.map(function (k) { return box(MODES[k].color, MODES[k].name, MODES[k].hint); }).join("") + '</div>' +
      '<h2 style="margin-top:22px">Доступ к сервисам</h2><div class="lg">' + ACCESS_ORDER.map(function (k) { return box(ACCESS[k].color, ACCESS[k].name, ACCESS[k].hint); }).join("") + '</div>' +
      '<div class="box"><b>Про общий балл</b>Это среднее по всем задачам из карточки, включая те, что остаются за человеком. Поэтому профессии с физической работой или личными переговорами получают меньше. Оценка отвечает на вопрос, насколько хорошо я заменю или усилю человека на этом месте. Для сервиса это средняя оценка того, что я могу с ним сделать.</div>';
  }

  function init() {
    $("acc").innerHTML = '<option value="">Любой доступ</option>' + ACCESS_ORDER.map(function (k) { return '<option value="' + k + '">' + ACCESS[k].name + '</option>'; }).join("");
    $("mode").innerHTML = '<option value="">Любой способ</option>' + MODE_ORDER.map(function (k) { return '<option value="' + k + '">' + MODES[k].name + '</option>'; }).join("");
    $("suggest").href = "https://github.com/" + REPO + "/issues/new?title=" + encodeURIComponent("Добавить: ");
    $("tabs").addEventListener("click", function (e) { var b = e.target.closest("[role=tab]"); if (b) setTab(b.getAttribute("data-tab")); });
    $("chips").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      state.cat = b.getAttribute("data-cat"); renderChips(); renderGrid();
    });
    $("q").addEventListener("input", function (e) {
      state.q = e.target.value.trim().toLowerCase();
      if (state.tab === "c") setTab("p");
      renderGrid(); renderTabs();
    });
    $("sort").addEventListener("change", function (e) { state.sort = e.target.value; renderGrid(); });
    $("mode").addEventListener("change", function (e) { state.mode = e.target.value; renderGrid(); });
    $("acc").addEventListener("change", function (e) { state.acc = e.target.value; renderGrid(); });
    $("hintOther").addEventListener("click", function (e) { var b = e.target.closest("[data-go]"); if (b) setTab(b.getAttribute("data-go")); });
    document.addEventListener("click", function (e) {
      var c = e.target.closest("[data-key]");
      if (c) openItem(c.getAttribute("data-key"), true);
    });
    $("close").addEventListener("click", closeItem);
    $("modal").addEventListener("click", function (e) { if (e.target === $("modal")) closeItem(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("modal").hidden) closeItem(); });
    window.addEventListener("hashchange", function () { var k = hashKey(); if (k) openItem(k, false); else if (!$("modal").hidden) { $("modal").hidden = true; document.body.style.overflow = ""; } });
    renderStats(); renderLegend(); renderConnect(); setTab("p");
    var k = hashKey();
    if (k) { if (k[0] === "s") setTab("s"); openItem(k, false); }
  }
  function hashKey() {
    var h = location.hash.slice(1);
    if (/^[ps]\d+$/.test(h)) return h;
    if (/^\d+$/.test(h)) return "p" + h;
    return "";
  }

  init();
})();
