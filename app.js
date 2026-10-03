(function () {
  var REPO = "denimarkus62/ai-capabilities";
  var MODES = {
    own:   { name: "Сам", color: "m-own", hint: "Делаю в чате и в файлах без внешних подключений" },
    tool:  { name: "Инструменты", color: "m-tool", hint: "Браузер, терминал, SSH, скрипты и планировщик на вашем компьютере" },
    api:   { name: "Через API", color: "m-api", hint: "Нужен токен или ключ сервиса. Без него готовлю материал, но не вижу данные" },
    conn:  { name: "Коннектор", color: "m-conn", hint: "Готовый коннектор из каталога Claude, нужна авторизация владельцем аккаунта" },
    mcp:   { name: "MCP", color: "m-mcp", hint: "MCP-сервер, уже подключенный здесь или написанный под вашу задачу" },
    human: { name: "Нужен человек", color: "m-human", hint: "Физическое действие, подпись, звонок, ответственность или решение" }
  };
  var MODE_ORDER = ["own", "tool", "api", "conn", "mcp", "human"];
  var BANDS = [
    { min: 8.5, cls: "s-g", name: "9 и 10", text: "Делаю сам на уровне сильного специалиста. Вам остается проверить результат." },
    { min: 7, cls: "s-b", name: "7 и 8", text: "Делаю хорошо. Нужна проверка человеком или одно подключение." },
    { min: 5, cls: "s-a", name: "5 и 6", text: "Помогаю частично. Нужны подключения, доступы или ваша экспертиза." },
    { min: 0, cls: "s-r", name: "0 до 4", text: "Только подсказки. Основную работу делает человек." }
  ];
  var BAR_COLOR = { g: "var(--g)", b: "var(--b)", a: "var(--a)", r: "var(--r)" };

  var data = window.PROFESSIONS.map(function (p, i) {
    var sum = 0;
    p.t.forEach(function (t) { sum += t[1]; });
    p.id = i + 1;
    p.avg = Math.round((sum / p.t.length) * 10) / 10;
    p.modes = {};
    p.t.forEach(function (t) { p.modes[t[2]] = (p.modes[t[2]] || 0) + 1; });
    return p;
  });

  var cats = [];
  data.forEach(function (p) { if (cats.indexOf(p.c) < 0) cats.push(p.c); });

  var state = { q: "", cat: "", mode: "", sort: "score" };
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function band(v) { for (var i = 0; i < BANDS.length; i++) if (v >= BANDS[i].min) return BANDS[i]; return BANDS[3]; }
  function bandKey(v) { var c = band(v).cls; return c.slice(2); }
  function fmt(v) { return String(v).replace(".", ","); }

  function renderStats() {
    var tasks = 0, own = 0, human = 0, total = 0;
    data.forEach(function (p) { p.t.forEach(function (t) { tasks++; total += t[1]; if (t[2] === "own") own++; if (t[2] === "human") human++; }); });
    var cards = [
      [data.length, "профессий в базе"],
      [tasks, "задач с оценкой"],
      [fmt(Math.round(total / tasks * 10) / 10), "средний балл по всем задачам"],
      [Math.round(own / tasks * 100) + "%", "задач делаю сам, без подключений"],
      [Math.round(human / tasks * 100) + "%", "задач остаются за человеком"]
    ];
    $("stats").innerHTML = cards.map(function (c) { return '<div class="stat"><b>' + c[0] + '</b><span>' + c[1] + '</span></div>'; }).join("");
  }

  function renderCats() {
    $("cats").innerHTML = cats.map(function (c) {
      var list = data.filter(function (p) { return p.c === c; });
      var a = Math.round(list.reduce(function (s, p) { return s + p.avg; }, 0) / list.length * 10) / 10;
      return '<div class="catrow"><span>' + esc(c) + '</span><span class="bar"><i style="width:' + a * 10 + '%;background:' + BAR_COLOR[bandKey(a)] + '"></i></span><em>' + fmt(a) + '</em></div>';
    }).join("");
  }

  function renderFilters() {
    var chips = ['<button class="chip" data-cat="" aria-pressed="true">Все</button>'].concat(cats.map(function (c) {
      return '<button class="chip" data-cat="' + esc(c) + '" aria-pressed="false">' + esc(c) + '</button>';
    }));
    $("chips").innerHTML = chips.join("");
    $("chips").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      state.cat = b.getAttribute("data-cat");
      [].forEach.call($("chips").children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      renderGrid();
    });
    $("mode").innerHTML = '<option value="">Любой способ</option>' + MODE_ORDER.map(function (k) { return '<option value="' + k + '">' + MODES[k].name + '</option>'; }).join("");
    $("q").addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); renderGrid(); });
    $("sort").addEventListener("change", function (e) { state.sort = e.target.value; renderGrid(); });
    $("mode").addEventListener("change", function (e) { state.mode = e.target.value; renderGrid(); });
  }

  function match(p) {
    if (state.cat && p.c !== state.cat) return false;
    if (state.mode && !p.modes[state.mode]) return false;
    if (state.q) {
      var hay = (p.n + " " + p.c + " " + p.d + " " + p.t.map(function (t) { return t[0] + " " + (t[3] || ""); }).join(" ")).toLowerCase();
      if (hay.indexOf(state.q) < 0) return false;
    }
    return true;
  }

  function mix(p) {
    var n = p.t.length;
    return MODE_ORDER.filter(function (k) { return p.modes[k]; }).map(function (k) {
      return '<i class="' + MODES[k].color + '" style="width:' + (p.modes[k] / n * 100) + '%" title="' + MODES[k].name + ': ' + p.modes[k] + '"></i>';
    }).join("");
  }

  function renderGrid() {
    var list = data.filter(match);
    if (state.sort === "score") list.sort(function (a, b) { return b.avg - a.avg || a.n.localeCompare(b.n, "ru"); });
    else if (state.sort === "scoreAsc") list.sort(function (a, b) { return a.avg - b.avg || a.n.localeCompare(b.n, "ru"); });
    else list.sort(function (a, b) { return a.n.localeCompare(b.n, "ru"); });
    $("count").textContent = "Показано: " + list.length + " из " + data.length;
    if (!list.length) { $("grid").innerHTML = '<p class="empty">Ничего не нашли. Попробуйте другое слово или сбросьте фильтры.</p>'; return; }
    $("grid").innerHTML = list.map(function (p) {
      var b = band(p.avg);
      var tags = MODE_ORDER.filter(function (k) { return p.modes[k]; }).map(function (k) {
        return '<span class="tag"><b>' + p.modes[k] + '</b> ' + MODES[k].name.toLowerCase() + '</span>';
      }).join("");
      return '<button class="card" data-id="' + p.id + '"><div class="head"><div><h3>' + esc(p.n) + '</h3><div class="cat">' + esc(p.c) + '</div></div>' +
        '<div class="score ' + b.cls + '"><span>' + fmt(p.avg) + '</span></div></div>' +
        '<p>' + esc(p.d) + '</p><div class="mix">' + mix(p) + '</div><div class="tags">' + tags + '</div></button>';
    }).join("");
  }

  function openProf(id, push) {
    var p = data.filter(function (x) { return x.id === id; })[0];
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
    var link = location.href.split("#")[0] + "#" + p.id;
    $("mBody").innerHTML =
      '<div class="mh"><div class="score ' + b.cls + '"><span>' + fmt(p.avg) + '</span></div><div><h2 id="mTitle">' + esc(p.n) + '</h2><div class="cat" style="color:var(--muted)">' + esc(p.c) + '</div></div></div>' +
      '<p class="desc">' + esc(p.d) + '</p>' + rows +
      '<div class="box"><b>Чего не могу</b>' + esc(p.l) + '</div>' +
      '<div class="box"><b>Что подключить, чтобы стало лучше</b>' + esc(p.k) + '</div>' +
      '<p class="share">Ссылка на эту профессию: <a href="' + esc(link) + '">' + esc(link) + '</a></p>';
    $("modal").hidden = false;
    document.body.style.overflow = "hidden";
    $("close").focus();
    if (push) history.replaceState(null, "", "#" + p.id);
  }

  function closeProf() {
    $("modal").hidden = true;
    document.body.style.overflow = "";
    history.replaceState(null, "", location.pathname + location.search);
  }

  function renderLegend() {
    var scale = BANDS.map(function (b) {
      return '<div class="lgi"><b><span class="dot ' + b.cls + '"></span>' + b.name + '</b>' + esc(b.text) + '</div>';
    }).join("");
    var modes = MODE_ORDER.map(function (k) {
      return '<div class="lgi"><b><span class="dot ' + MODES[k].color + '"></span>' + MODES[k].name + '</b>' + esc(MODES[k].hint) + '</div>';
    }).join("");
    $("legend").innerHTML = '<h2>Как читать оценки</h2><div class="lg">' + scale + '</div>' +
      '<h2 style="margin-top:22px">Способы, которыми я делаю работу</h2><div class="lg">' + modes + '</div>' +
      '<div class="box"><b>Про общий балл профессии</b>Это среднее по всем задачам из карточки, включая те, что остаются за человеком. Поэтому профессии, где много физической работы или личных переговоров, получают меньше. Оценка отвечает на вопрос, насколько хорошо я заменю или усилю человека на этом месте, а не только на тексте и анализе.</div>';
  }

  $("suggest").href = "https://github.com/" + REPO + "/issues/new?title=" + encodeURIComponent("Профессия: ");
  $("grid").addEventListener("click", function (e) {
    var c = e.target.closest(".card"); if (c) openProf(+c.getAttribute("data-id"), true);
  });
  $("close").addEventListener("click", closeProf);
  $("modal").addEventListener("click", function (e) { if (e.target === $("modal")) closeProf(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("modal").hidden) closeProf(); });
  window.addEventListener("hashchange", function () {
    var id = parseInt(location.hash.slice(1), 10);
    if (id) openProf(id, false); else if (!$("modal").hidden) { $("modal").hidden = true; document.body.style.overflow = ""; }
  });

  renderStats(); renderCats(); renderFilters(); renderLegend(); renderGrid();
  var first = parseInt(location.hash.slice(1), 10);
  if (first) openProf(first, false);
})();
