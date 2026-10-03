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
  window.PROFESSIONS.forEach(function (p) {
    var r = window.REPORTS && window.REPORTS[p.n];
    if (r) p.t.push([r[0], r[1], r[2], r[3] || window.REPORTS_VIA, "r"]);
  });
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

  var SCORES = [["", "Балл: любой", 0, 11], ["8", "Балл: 8 и выше", 8, 11], ["7", "Балл: 7 и выше", 7, 11], ["6", "Балл: 6 и выше", 6, 11], ["5-7", "Балл: от 5 до 7", 5, 7], ["lt5", "Балл: ниже 5", 0, 5]];
  var caps = window.CAPS.slice();
  var tips = window.TIPS.map(function (x, i) { x.id = i + 1; return x; });
  var CAP_ST = {
    on:   { name: "Работает сейчас", color: "m-own" },
    part: { name: "Частично", color: "m-api" },
    auth: { name: "Нужна авторизация", color: "m-conn" },
    off:  { name: "Не подключилось", color: "m-none" }
  };
  var CAP_ORDER = ["on", "part", "auth", "off"];
  var state = { auto: { p: false, s: false }, capSt: "", tipCat: "", tab: "p", q: "", deep: false, cat: "", mode: "", acc: "", score: "", sort: "score" };
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function band(v) { for (var i = 0; i < BANDS.length; i++) if (v >= BANDS[i].min) return BANDS[i]; return BANDS[3]; }
  function bandKey(v) { return band(v).cls.slice(2); }
  function fmt(v) { return String(v).replace(".", ","); }
  function isSpecial(t) { return t === "c" || t === "k" || t === "t"; }
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
      var all = list.filter(function (p) { return p.c === c; });
      var l = all.filter(matchNoCat);
      var a = l.length ? Math.round(l.reduce(function (s, p) { return s + p.avg; }, 0) / l.length * 10) / 10 : 0;
      var num = l.length === all.length ? String(all.length) : l.length + " из " + all.length;
      return '<button class="catrow' + (l.length ? "" : " empty0") + '" data-catgo="' + esc(c) + '" title="Открыть список"><span>' + esc(c) + ' <small>' + num + '</small></span><span class="bar"><i style="width:' + a * 10 + '%;background:' + (l.length ? BAR_COLOR[bandKey(a)] : "transparent") + '"></i></span><em>' + (l.length ? fmt(a) : "нет") + '</em></button>';
    }).join("");
  }

  function catHeadHtml() {
    var all = cur().filter(function (p) { return p.c === state.cat; });
    var l = all.filter(matchNoCat);
    var a = l.length ? Math.round(l.reduce(function (s, p) { return s + p.avg; }, 0) / l.length * 10) / 10 : 0;
    var noun = state.tab === "s" ? "сервисов" : "профессий";
    var num = l.length === all.length ? l.length + " " + noun : "подходит " + l.length + " из " + all.length + " " + noun;
    var reset = (filtersOn() && l.length !== all.length) ? ' <button class="link" data-reset="1">Сбросить фильтры</button>' : "";
    return '<button class="back" data-catgo="">← Все направления</button><div><h2>' + esc(state.cat) + '</h2><span>' + num + (l.length ? ', средний балл ' + fmt(a) : "") + '.' + reset + '</span></div>';
  }
  function applyCatView() {
    var inCat = !isSpecial(state.tab) && !!state.cat;
    $("cats").hidden = isSpecial(state.tab) || inCat;
    $("catHead").hidden = !inCat;
    if (inCat) $("catHead").innerHTML = catHeadHtml();
  }
  function selectCat(c, scroll) {
    state.cat = c || "";
    renderChips(); applyCatView(); renderGrid();
    if (scroll) { var el = c ? $("catHead") : $("cats"); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  function renderChips() {
    var items = ['<button class="chip" data-cat="" aria-pressed="' + (state.cat === "") + '">Все</button>'].concat(CATS[state.tab].map(function (c) {
      return '<button class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (state.cat === c) + '">' + esc(c) + '</button>';
    }));
    $("chips").innerHTML = items.join("");
  }

  function hayMain(p) {
    return (p.n + " " + p.c + " " + (p.pr || []).join(" ")).toLowerCase();
  }
  function svcExact(p, t) {
    return !!p.svc && p.svc.some(function (s) { return s.prof.length <= 30 && s.n.toLowerCase().split(/[^a-zа-я0-9]+/).indexOf(t) >= 0; });
  }
  function hayDeep(p) {
    return (p.d + " " + p.t.map(function (t) { return t[0] + " " + (t[3] || ""); }).join(" ")).toLowerCase();
  }
  function stem(w) {
    var s = w.replace(/(ами|ями|ов|ев|ей|ом|ем|ам|ям|ах|ях|ы|и|а|я|у|ю|е|о|ь|й)$/, "");
    return s.length >= 4 ? s : w;
  }
  var SYN = [
    ["telegram", "телеграм", "телега", "tg", "тг"], ["youtube", "ютуб", "ютьюб"], ["whatsapp", "ватсап", "вотсап", "вацап"],
    ["instagram", "инстаграм", "инста"], ["facebook", "фейсбук", "фб"], ["viber", "вайбер"], ["tiktok", "тикток"],
    ["ozon", "озон"], ["wildberries", "вайлдберриз", "вб", "wb"], ["google", "гугл"], ["yandex", "яндекс"], ["avito", "авито"],
    ["1с", "1c", "ванэс"], ["эцп", "электронная подпись", "электронной подписи", "криптопро", "подпись"], ["vk", "вк", "вконтакте"],
    ["bitrix", "битрикс"], ["amocrm", "амо", "амосрм"], ["excel", "эксель"], ["word", "ворд"], ["chatgpt", "чатгпт", "gpt", "гпт"],
    ["deepseek", "дипсик"], ["midjourney", "миджорни"], ["whisper", "виспер"], ["github", "гитхаб"], ["slack", "слак"],
    ["zoom", "зум"], ["notion", "ноушн"], ["figma", "фигма"], ["canva", "канва"], ["wordpress", "вордпресс"], ["tilda", "тильда"],
    ["seo", "сео"], ["crm", "црм"], ["api", "апи"], ["mcp", "мсп"], ["gmail", "джимейл", "гмейл"], ["x (twitter)", "твиттер", "twitter"], ["smm", "смм", "соцсети"], ["email", "имейл", "емейл"], ["excel", "эксель", "таблицы"]
  ];
  function terms(q) {
    var r = [q];
    var sq = stem(q);
    if (sq !== q) r.push(sq);
    if (q.length >= 8 && /(ия|ие|ии|ию)$/.test(q)) r.push(q.slice(0, q.length - 2));
    SYN.forEach(function (g) {
      if (g.some(function (m) { return m === q || (q.length >= 3 && m.indexOf(q) === 0); })) g.forEach(function (m) { if (r.indexOf(m) < 0) r.push(m); });
    });
    return r;
  }
  function hit(hay, t) {
    if (t.length > 3) return hay.indexOf(t) >= 0;
    var c = t.replace(/[^a-zа-я0-9]/g, "");
    if (!c) return false;
    return new RegExp("(^|[^a-zа-я0-9])" + c).test(hay);
  }
  function words() { return state.q.split(/\s+/).filter(Boolean); }
  function qMain(p) {
    return words().every(function (w) { return terms(w).some(function (t) { return hit(hayMain(p), t) || svcExact(p, t); }); });
  }
  function qDeep(p) {
    return words().every(function (w) { return terms(w).some(function (t) { return hit(hayMain(p), t) || svcExact(p, t) || hit(hayDeep(p), t); }); });
  }
  function matchQ(p) {
    if (!state.q) return true;
    return qMain(p) || ((state.deep || state.auto[p.key[0]]) && qDeep(p));
  }
  function matchNoCat(p) {
    if (state.mode && !p.modes[state.mode]) return false;
    if (state.tab === "s" && state.acc && p.a !== state.acc) return false;
    if (state.score) {
      var sf = SCORES.filter(function (x) { return x[0] === state.score; })[0];
      if (p.avg < sf[2] || p.avg >= sf[3]) return false;
    }
    return matchQ(p);
  }
  function match(p) { return (!state.cat || p.c === state.cat) && matchNoCat(p); }
  function computeAuto() {
    [["p", profs], ["s", svcs]].forEach(function (x) {
      var on = false;
      if (state.q && !state.deep) {
        on = !x[1].some(qMain) && x[1].some(qDeep);
      }
      state.auto[x[0]] = on;
    });
  }
  function filtersOn() { return !!(state.q || state.mode || state.acc || state.score); }
  function extraCount() {
    if (!state.q || state.deep || state.auto[state.tab]) return 0;
    return cur().filter(function (p) {
      var save = state.deep; state.deep = true;
      var ok = (!state.cat || p.c === state.cat) && matchNoCat(p);
      state.deep = save;
      return ok && !qMain(p);
    }).length;
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
    $("tabK").innerHTML = 'Мои возможности <span>' + caps.length + '</span>';
    $("tabT").innerHTML = 'Советы <span>' + tips.length + '</span>';
    [["tabP", "p"], ["tabS", "s"], ["tabC", "c"], ["tabK", "k"], ["tabT", "t"]].forEach(function (x) { $(x[0]).setAttribute("aria-selected", state.tab === x[1] ? "true" : "false"); });
    $("hintOther").innerHTML = "";
    if (q && state.tab === "p" && qp === 0 && qs > 0) $("hintOther").innerHTML = 'Среди профессий ничего нет, но в сервисах нашлось: ' + qs + '. <button class="link" data-go="s">Показать сервисы</button>';
    if (q && state.tab === "s" && qs === 0 && qp > 0) $("hintOther").innerHTML = 'Среди сервисов ничего нет, но в профессиях нашлось: ' + qp + '. <button class="link" data-go="p">Показать профессии</button>';
  }

  function cardHtml(p) {
    var b = band(p.avg);
    var tags = MODE_ORDER.filter(function (k) { return p.modes[k]; }).map(function (k) {
      return '<span class="tag"><b>' + p.modes[k] + '</b> ' + MODES[k].name.toLowerCase() + '</span>';
    }).join("");
    var catLink = '<span class="cat catlink" role="link" tabindex="0" data-catgo="' + esc(p.c) + '" data-tab="' + p.key[0] + '">' + esc(p.c) + '</span>';
    var sub = p.key[0] === "s"
      ? '<span class="badge ' + ACCESS[p.a].color + '" title="' + esc(ACCESS[p.a].hint) + '">' + ACCESS[p.a].name + '</span> ' + catLink
      : catLink;
    var rel = p.key[0] === "s"
      ? (p.prof.length ? '<div class="rel">Нужен профессиям: ' + p.prof.length + '</div>' : '')
      : (p.svc.length ? '<div class="rel">Сервисы: ' + p.svc.slice(0, 3).map(function (s) { return esc(s.n); }).join(", ") + (p.svc.length > 3 ? " и еще " + (p.svc.length - 3) : "") + '</div>' : '');
    var rt = p.t.filter(function (t) { return t[4] === "r"; })[0];
    var repLine = rt ? '<div class="repline">Отчеты и дашборды: <b>' + rt[1] + '</b> из 10</div>' : "";
    return '<button class="card" data-key="' + p.key + '"><div class="head"><div><h3>' + esc(p.n) + '</h3><div class="sub2">' + sub + '</div></div>' +
      '<div class="score ' + b.cls + '"><span>' + fmt(p.avg) + '</span></div></div>' +
      '<p>' + esc(p.d) + '</p><div class="mix">' + mix(p) + '</div><div class="tags">' + tags + '</div>' + repLine + rel + '</button>';
  }

  function renderGrid() {
    var list = cur().filter(match);
    if (state.sort === "score") list.sort(function (a, b) { return b.avg - a.avg || a.n.localeCompare(b.n, "ru"); });
    else if (state.sort === "scoreAsc") list.sort(function (a, b) { return a.avg - b.avg || a.n.localeCompare(b.n, "ru"); });
    else list.sort(function (a, b) { return a.n.localeCompare(b.n, "ru"); });
    var total = state.cat ? cur().filter(function (p) { return p.c === state.cat; }).length : cur().length;
    var ex = extraCount();
    var note = ex ? ' <button class="link" data-deep="1">Еще ' + ex + ', где слово упоминается в описаниях и задачах. Показать</button>' : (state.q && state.deep ? ' <button class="link" data-deep="0">Показаны и упоминания в описаниях. Скрыть</button>' : (state.auto[state.tab] ? " В названиях совпадений нет, показаны упоминания в описаниях и задачах." : ""));
    var rst = (filtersOn() && !state.cat) ? ' <button class="link" data-reset="1">Сбросить фильтры</button>' : "";
    $("count").innerHTML = "Показано: " + list.length + " из " + total + note + rst;
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

  function textMatch(hay) {
    if (!state.q) return true;
    hay = hay.toLowerCase();
    return words().every(function (w) { return terms(w).some(function (t) { return hit(hay, t); }); });
  }

  function renderCaps() {
    $("capsNote").textContent = window.CAPS_NOTE;
    var base = caps.filter(function (c) { return textMatch(c.n + " " + c.d + " " + c.ex + " " + c.g + " " + c.k); });
    var chips = ['<button class="chip" data-capst="" aria-pressed="' + (state.capSt === "") + '">Все ' + base.length + '</button>'].concat(CAP_ORDER.map(function (k) {
      var n = base.filter(function (c) { return c.st === k; }).length;
      return '<button class="chip" data-capst="' + k + '" aria-pressed="' + (state.capSt === k) + '">' + CAP_ST[k].name + ' ' + n + '</button>';
    }));
    $("capChips").innerHTML = chips.join("");
    var list = base.filter(function (c) { return !state.capSt || c.st === state.capSt; });
    $("capCount").textContent = "Показано: " + list.length + " из " + caps.length;
    if (!list.length) { $("capList").innerHTML = '<p class="empty">Ничего не нашли. Попробуйте другое слово.</p>'; return; }
    var groups = [];
    list.forEach(function (c) { if (groups.indexOf(c.g) < 0) groups.push(c.g); });
    $("capList").innerHTML = groups.map(function (g) {
      var items = list.filter(function (c) { return c.g === g; });
      return '<h3 class="gh">' + esc(g) + ' <small>' + items.length + '</small></h3><div class="cgrid">' + items.map(function (c) {
        return '<div class="capcard"><div class="caphead"><b>' + esc(c.n) + '</b><span class="badge ' + CAP_ST[c.st].color + '">' + CAP_ST[c.st].name + '</span></div>' +
          '<div class="kind">' + esc(c.k) + '</div><p>' + esc(c.d) + '</p>' + (c.ex ? '<div class="rel">Пригодится: ' + esc(c.ex) + '</div>' : '') + '</div>';
      }).join("") + '</div>';
    }).join("");
  }

  function renderTips() {
    var TC = [];
    tips.forEach(function (x) { if (TC.indexOf(x.c) < 0) TC.push(x.c); });
    var base = tips.filter(function (x) { return textMatch(x.t + " " + x.d + " " + (x.p || "") + " " + x.c); });
    var topN = base.filter(function (x) { return x.i === 3; }).length;
    var chips = ['<button class="chip" data-tipcat="" aria-pressed="' + (state.tipCat === "") + '">Все ' + base.length + '</button>',
      '<button class="chip" data-tipcat="__top" aria-pressed="' + (state.tipCat === "__top") + '">Важные ' + topN + '</button>'].concat(TC.map(function (c) {
      var n = base.filter(function (x) { return x.c === c; }).length;
      return '<button class="chip" data-tipcat="' + esc(c) + '" aria-pressed="' + (state.tipCat === c) + '">' + esc(c) + ' ' + n + '</button>';
    }));
    $("tipChips").innerHTML = chips.join("");
    var list = base.filter(function (x) { return state.tipCat === "" || (state.tipCat === "__top" ? x.i === 3 : x.c === state.tipCat); });
    $("tipCount").textContent = "Показано: " + list.length + " из " + tips.length;
    if (!list.length) { $("tipList").innerHTML = '<p class="empty">Ничего не нашли. Попробуйте другое слово.</p>'; return; }
    $("tipList").innerHTML = list.map(function (x) {
      return '<article class="tip' + (x.i === 3 ? " tip-top" : "") + '"><div class="tipmeta"><span>' + esc(x.c) + '</span>' + (x.i === 3 ? '<span class="badge m-own">Важно</span>' : "") + '</div>' +
        '<h3>' + esc(x.t) + '</h3><p>' + esc(x.d) + '</p>' +
        (x.p ? '<div class="phrase"><span>' + esc(x.p) + '</span><button type="button" class="copy" data-copy="' + x.id + '">Скопировать</button></div>' : "") + '</article>';
    }).join("");
  }

  function copyText(text, btn) {
    function done() { btn.textContent = "Скопировано"; setTimeout(function () { btn.textContent = "Скопировать"; }, 1500); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { btn.textContent = "Выделите вручную"; }
      document.body.removeChild(ta);
    }
  }

  function refresh() {
    if (state.tab === "k") { renderCaps(); renderTabs(); return; }
    if (state.tab === "t") { renderTips(); renderTabs(); return; }
    computeAuto();
    renderCats(); applyCatView(); renderGrid(); renderTabs();
  }
  function resetFilters() {
    state.q = ""; state.deep = false; state.mode = ""; state.acc = ""; state.score = "";
    $("q").value = "";
    ["mode", "score", "acc"].forEach(function (id) { $(id).value = ""; $(id)._dd.sync(); });
    refresh();
  }

  function setTab(t, keepQ) {
    computeAuto();
    state.tab = t; state.cat = ""; state.mode = ""; state.acc = ""; state.score = "";
    $("mode").value = ""; $("acc").value = ""; $("score").value = "";
    var c = isSpecial(t);
    $("filters").hidden = c; $("count").hidden = c; $("grid").hidden = c; $("hintOther").hidden = c;
    $("connect").hidden = t !== "c"; $("caps").hidden = t !== "k"; $("tips").hidden = t !== "t";
    if (t === "k") { state.capSt = ""; renderCaps(); }
    if (t === "t") { state.tipCat = ""; renderTips(); }
    $("acc")._dd.wrap.hidden = t !== "s";
    ["mode", "score", "acc"].forEach(function (id) { $(id)._dd.sync(); });
    applyCatView();
    if (!c) { renderChips(); renderCats(); renderGrid(); }
    renderTabs();
  }

  function listHtml(items, label) {
    if (!items.length) return "";
    return '<div class="box"><b>' + label + '</b><div class="links">' + items.map(function (x) {
      return '<button class="lk" data-key="' + x.key + '">' + esc(x.n) + ' <small>' + fmt(x.avg) + '</small></button>';
    }).join("") + '</div></div>';
  }

  var lastFocus = null;
  function openItem(key, push) {
    var kind = key[0], id = parseInt(key.slice(1), 10);
    var p = (kind === "s" ? svcs : profs).filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var b = band(p.avg);
    var rows = p.t.slice().sort(function (a, c) { return ((c[4] === "r") - (a[4] === "r")) || (c[1] - a[1]); }).map(function (t) {
      var bk = bandKey(t[1]);
      var m = MODES[t[2]];
      return '<div class="task' + (t[4] === "r" ? " rep" : "") + '"><div><div class="tt">' + esc(t[0]) + '</div>' +
        (t[3] ? '<div class="via">' + esc(t[3]) + '</div>' : '') +
        '<span class="badge ' + m.color + '" title="' + esc(m.hint) + '">' + m.name + '</span>' + (t[4] === "r" ? ' <span class="badge m-rep">Отчеты и дашборды</span>' : "") + '</div>' +
        '<div class="meter"><div class="mbar"><i style="width:' + t[1] * 10 + '%;background:' + BAR_COLOR[bk] + '"></i></div><span class="num">' + t[1] + '</span></div></div>';
    }).join("");
    var link = location.href.split("#")[0] + "#" + p.key;
    var acc = kind === "s" ? '<span class="badge ' + ACCESS[p.a].color + '" title="' + esc(ACCESS[p.a].hint) + '">' + ACCESS[p.a].name + '</span> ' : "";
    var related = kind === "s" ? listHtml(p.prof, "Профессии, которым это нужно") : listHtml(p.svc, "Сервисы и инструменты для этой профессии");
    $("mBody").innerHTML =
      '<div class="mh"><div class="score ' + b.cls + '"><span>' + fmt(p.avg) + '</span></div><div><h2 id="mTitle">' + esc(p.n) + '</h2><div class="cat" style="color:var(--muted)">' + acc + '<span class="catlink" role="link" tabindex="0" data-catgo="' + esc(p.c) + '" data-tab="' + kind + '">' + esc(p.c) + '</span></div></div></div>' +
      '<p class="desc">' + esc(p.d) + '</p>' + rows +
      '<div class="box"><b>Чего не могу</b>' + esc(p.l) + '</div>' +
      '<div class="box"><b>Что подключить, чтобы стало лучше</b>' + esc(p.k) + '</div>' + related +
      '<p class="share">Ссылка: <a href="' + esc(link) + '">' + esc(link) + '</a></p>';
    if ($("modal").hidden) lastFocus = document.activeElement;
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
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
  }

  function renderLegend() {
    var box = function (cls, name, text) { return '<div class="lgi"><b><span class="dot ' + cls + '"></span>' + name + '</b>' + esc(text) + '</div>'; };
    $("legend").innerHTML = '<h2>Как читать оценки</h2><div class="lg">' + BANDS.map(function (b) { return box(b.cls, b.name, b.text); }).join("") + '</div>' +
      '<h2 style="margin-top:22px">Способы, которыми я делаю работу</h2><div class="lg">' + MODE_ORDER.map(function (k) { return box(MODES[k].color, MODES[k].name, MODES[k].hint); }).join("") + '</div>' +
      '<h2 style="margin-top:22px">Доступ к сервисам</h2><div class="lg">' + ACCESS_ORDER.map(function (k) { return box(ACCESS[k].color, ACCESS[k].name, ACCESS[k].hint); }).join("") + '</div>' +
      '<div class="box"><b>Про общий балл</b>Это среднее по всем задачам из карточки, включая те, что остаются за человеком. Поэтому профессии с физической работой или личными переговорами получают меньше. Оценка отвечает на вопрос, насколько хорошо я заменю или усилю человека на этом месте. Для сервиса это средняя оценка того, что я могу с ним сделать.</div>';
  }

  function enhance(sel) {
    var wrap = document.createElement("div"); wrap.className = "dd";
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "dd-btn";
    btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", sel.getAttribute("aria-label") || "");
    var list = document.createElement("ul"); list.className = "dd-list"; list.setAttribute("role", "listbox"); list.hidden = true;
    var active = -1;
    function items() { return [].slice.call(list.children); }
    function sync() {
      list.innerHTML = [].map.call(sel.options, function (o) {
        return '<li role="option" data-v="' + esc(o.value) + '" aria-selected="' + (o.value === sel.value) + '">' + esc(o.text) + '</li>';
      }).join("");
      btn.textContent = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : "";
    }
    function setActive(i) {
      var it = items(); if (!it.length) return;
      active = Math.max(0, Math.min(it.length - 1, i));
      it.forEach(function (x, k) { x.classList.toggle("active", k === active); });
      if (it[active].scrollIntoView) it[active].scrollIntoView({ block: "nearest" });
    }
    function open() {
      document.querySelectorAll(".dd-list").forEach(function (l) { if (l !== list) l.hidden = true; });
      list.hidden = false; btn.setAttribute("aria-expanded", "true");
      var cur = items().map(function (x) { return x.getAttribute("data-v"); }).indexOf(sel.value);
      setActive(cur < 0 ? 0 : cur);
    }
    function close() { list.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    function choose(i) {
      var it = items()[i]; if (!it) return;
      sel.value = it.getAttribute("data-v");
      sel.dispatchEvent(new Event("change"));
      sync(); close(); btn.focus();
    }
    btn.addEventListener("click", function () { list.hidden ? open() : close(); });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (list.hidden) open(); else setActive(active + (e.key === "ArrowDown" ? 1 : -1)); }
      else if (e.key === "Home" && !list.hidden) { e.preventDefault(); setActive(0); }
      else if (e.key === "End" && !list.hidden) { e.preventDefault(); setActive(items().length - 1); }
      else if ((e.key === "Enter" || e.key === " ") && !list.hidden) { e.preventDefault(); choose(active); }
      else if (e.key === "Escape" && !list.hidden) { e.stopPropagation(); close(); }
      else if (e.key === "Tab") close();
    });
    list.addEventListener("click", function (e) { var li = e.target.closest("li"); if (li) choose(items().indexOf(li)); });
    list.addEventListener("mousemove", function (e) { var li = e.target.closest("li"); if (li) setActive(items().indexOf(li)); });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) close(); });
    wrap.appendChild(btn); wrap.appendChild(list);
    sel.style.display = "none";
    sel.parentNode.insertBefore(wrap, sel);
    sel._dd = { wrap: wrap, sync: sync };
    sync();
  }

  function init() {
    $("acc").innerHTML = '<option value="">Любой доступ</option>' + ACCESS_ORDER.map(function (k) { return '<option value="' + k + '">' + ACCESS[k].name + '</option>'; }).join("");
    $("score").innerHTML = SCORES.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join("");
    $("score").addEventListener("change", function (e) { state.score = e.target.value; refresh(); });
    $("mode").innerHTML = '<option value="">Любой способ</option>' + MODE_ORDER.map(function (k) { return '<option value="' + k + '">' + MODES[k].name + '</option>'; }).join("");
    ["sort", "score", "mode", "acc"].forEach(function (id) { enhance($(id)); });
    $("suggest").href = "https://github.com/" + REPO + "/issues/new?title=" + encodeURIComponent("Добавить: ");
    $("tabs").addEventListener("click", function (e) { var b = e.target.closest("[role=tab]"); if (b) setTab(b.getAttribute("data-tab")); });
    $("chips").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      selectCat(b.getAttribute("data-cat"), false);
    });
    $("q").addEventListener("input", function (e) {
      state.q = e.target.value.trim().toLowerCase(); state.deep = false;
      if (state.tab === "c") setTab("p");
      refresh();
    });
    $("sort").addEventListener("change", function (e) { state.sort = e.target.value; renderGrid(); });
    $("mode").addEventListener("change", function (e) { state.mode = e.target.value; refresh(); });
    $("acc").addEventListener("change", function (e) { state.acc = e.target.value; refresh(); });
    $("hintOther").addEventListener("click", function (e) { var b = e.target.closest("[data-go]"); if (b) setTab(b.getAttribute("data-go")); });
    document.addEventListener("click", function (e) {
      var cs = e.target.closest("[data-capst]");
      if (cs) { state.capSt = cs.getAttribute("data-capst"); renderCaps(); return; }
      var tc = e.target.closest("[data-tipcat]");
      if (tc) { state.tipCat = tc.getAttribute("data-tipcat"); renderTips(); return; }
      var cp = e.target.closest("[data-copy]");
      if (cp) { var tp = tips.filter(function (x) { return x.id === +cp.getAttribute("data-copy"); })[0]; if (tp) copyText(tp.p, cp); return; }
      var rs = e.target.closest("[data-reset]");
      if (rs) { resetFilters(); return; }
      var dp = e.target.closest("[data-deep]");
      if (dp) { state.deep = dp.getAttribute("data-deep") === "1"; refresh(); return; }
      var g = e.target.closest("[data-catgo]");
      if (g) {
        e.preventDefault(); e.stopPropagation();
        var tab = g.getAttribute("data-tab");
        if (!$("modal").hidden) { $("modal").hidden = true; document.body.style.overflow = ""; history.replaceState(null, "", location.pathname + location.search); }
        if (tab && tab !== state.tab) setTab(tab);
        selectCat(g.getAttribute("data-catgo"), true);
        return;
      }
      var c = e.target.closest("[data-key]");
      if (c) openItem(c.getAttribute("data-key"), true);
    });
    $("close").addEventListener("click", closeItem);
    $("modal").addEventListener("click", function (e) { if (e.target === $("modal")) closeItem(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("modal").hidden) closeItem();
      if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("catlink")) { e.preventDefault(); e.target.click(); }
    });
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
