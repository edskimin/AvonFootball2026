/* Avon Eagles Football — full roster, sortable */

(function () {
  "use strict";

  var list = document.getElementById("roster-list");
  var status = document.getElementById("roster-status");
  var sortbar = document.getElementById("sortbar");
  var jumpRow = document.getElementById("jump-row");
  var jumpSelect = document.getElementById("jump-select");
  var cardTemplate = document.getElementById("card-template");
  var playerTemplate = document.getElementById("player-template");
  var sectionTemplate = document.getElementById("section-template");

  var searchInput = document.getElementById("search-input");
  var searchClear = document.getElementById("search-clear");
  var searchToggle = document.getElementById("search-toggle");
  var searchRow = document.getElementById("search-row");

  var players = [];
  var byNumber = {};
  var sort = "number";
  var query = "";

  // Offense, then defense, then special teams. Order carries the grouping, so
  // the sections don't need their own super-headings.
  var POSITIONS = [
    ["QB", "Quarterbacks"],
    ["RB", "Running Backs"],
    ["WR", "Wide Receivers"],
    ["TE", "Tight Ends"],
    ["OL", "Offensive Line"],
    ["DL", "Defensive Line"],
    ["LB", "Linebackers"],
    ["DB", "Defensive Backs"],
    ["K", "Kickers"],
    ["P", "Punters"],
    ["LS", "Long Snappers"]
  ];

  var GRADES = [
    [12, "Gr. 12", "Seniors"],
    [11, "Gr. 11", "Juniors"],
    [10, "Gr. 10", "Sophomores"]
  ];

  /* ---------- Data ---------- */

  fetch("roster.json", { cache: "no-cache" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(start)
    .catch(function (err) {
      status.textContent =
        location.protocol === "file:"
          ? "This page has to be served over http to read roster.json. From the project folder run: python3 -m http.server 8000"
          : "Could not read roster.json (" + err.message + ").";
    });

  function start(data) {
    byNumber = data.numbers;
    Object.keys(byNumber).forEach(function (num) {
      players = players.concat(byNumber[num]);
    });

    // A sort in the URL makes a view shareable and survives a refresh.
    var wanted = new URLSearchParams(location.search).get("sort");
    if (wanted && document.querySelector('.sort-btn[data-sort="' + wanted + '"]')) {
      sort = wanted;
    }

    status.remove();
    bindControls();
    render();
  }

  function lastName(player) {
    var parts = player.name.trim().split(/\s+/);
    return parts[parts.length - 1].toLowerCase();
  }

  function byJersey(a, b) {
    return a.num - b.num || lastName(a).localeCompare(lastName(b));
  }

  function byName(a, b) {
    return lastName(a).localeCompare(lastName(b)) || a.num - b.num;
  }

  /* ---------- Search ---------- */

  // Punctuation is dropped on both sides so "oreilly" finds O'Reilly and
  // "rjross" finds R.J. Ross.
  function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function matches(player) {
    if (!query) return true;
    return normalize(player.name).indexOf(query) !== -1;
  }

  function visible(list) {
    return list.filter(matches);
  }

  /* ---------- Section building ---------- */

  // Every sort returns the same shape, so render() stays simple: a list of
  // sections, each with an optional heading and the rows beneath it.
  function buildSections() {
    if (sort === "number") {
      return [{
        id: null,
        groups: Object.keys(byNumber)
          .sort(function (a, b) { return Number(a) - Number(b); })
          .map(function (num) { return { num: num, players: visible(byNumber[num]) }; })
          .filter(function (group) { return group.players.length; })
      }];
    }

    if (sort === "alpha") {
      var letters = {};
      visible(players).sort(byName).forEach(function (p) {
        var letter = lastName(p).charAt(0).toUpperCase();
        (letters[letter] = letters[letter] || []).push(p);
      });
      return Object.keys(letters).sort().map(function (letter) {
        return {
          id: "sec-" + letter,
          label: letter,
          count: letters[letter].length,
          groups: letters[letter].map(single)
        };
      });
    }

    if (sort === "grade") {
      return GRADES.map(function (g) {
        var group = visible(players).filter(function (p) { return p.grade === g[0]; }).sort(byJersey);
        return {
          id: "sec-gr" + g[0],
          label: g[1],
          tag: g[2],
          count: group.length,
          groups: group.map(single)
        };
      }).filter(function (s) { return s.count; });
    }

    // Position. A player who plays both ways is listed under each position —
    // you want the whole linebacker group when you look up linebackers.
    return POSITIONS.map(function (pos) {
      var group = visible(players).filter(function (p) {
        return p.pos.indexOf(pos[0]) !== -1;
      }).sort(byJersey);
      return {
        id: "sec-pos" + pos[0],
        label: pos[1],
        tag: pos[0],
        count: group.length,
        groups: group.map(single)
      };
    }).filter(function (s) { return s.count; });
  }

  function single(player) {
    return { num: String(player.num), players: [player] };
  }

  /* ---------- Rendering ---------- */

  function render() {
    var cards = list.querySelectorAll(".card, .section-head, .roster-status");
    for (var i = 0; i < cards.length; i++) cards[i].remove();

    var sections = buildSections();
    var frag = document.createDocumentFragment();

    sections.forEach(function (section) {
      if (section.id) frag.appendChild(buildSectionHead(section));
      section.groups.forEach(function (group) {
        frag.appendChild(buildCard(group.num, group.players));
      });
    });

    // A search that finds nothing needs saying; anything else speaks for itself.
    if (query && !visible(players).length) {
      var empty = document.createElement("p");
      empty.className = "roster-status roster-status--empty";
      empty.textContent = "No player matches “" + searchInput.value.trim() + "”.";
      frag.appendChild(empty);
    }

    list.appendChild(frag);

    // Jumping between sections is meaningless once a search has narrowed the
    // list to a handful of rows.
    buildJump(query ? [] : sections);
  }

  function buildSectionHead(section) {
    var el = sectionTemplate.content.firstElementChild.cloneNode(true);
    el.id = section.id;
    el.querySelector(".section-head__label").textContent = section.label;

    var tag = el.querySelector(".section-head__tag");
    if (section.tag) tag.textContent = section.tag;
    else tag.remove();

    el.querySelector(".section-head__count").textContent = section.count;
    return el;
  }

  function buildCard(num, group) {
    var card = cardTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector(".card__num-value").textContent = num;

    var body = card.querySelector(".card__body");
    for (var i = 0; i < group.length; i++) body.appendChild(buildPlayer(group[i]));
    return card;
  }

  function buildPlayer(player) {
    var el = playerTemplate.content.firstElementChild.cloneNode(true);
    el.querySelector(".player__name").textContent = player.name;
    // Positions sit inline and right-aligned, so each player fits on two lines.
    el.querySelector(".player__pos-inline").textContent = player.pos.join(" / ");
    el.querySelector(".player__meta").textContent =
      "Gr. " + player.grade + "  ·  " + player.height + "  ·  " + player.weight + " lbs";
    return el;
  }

  /* ---------- Controls ---------- */

  function bindControls() {
    var buttons = document.querySelectorAll(".sort-btn[data-sort]");

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (event) {
        var next = event.currentTarget.dataset.sort;
        if (!next || next === sort) return;
        sort = next;
        syncButtons();

        var url = new URL(location.href);
        if (sort === "number") url.searchParams.delete("sort");
        else url.searchParams.set("sort", sort);
        history.replaceState(null, "", url);

        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    searchToggle.addEventListener("click", function () {
      var open = searchRow.hidden;
      searchRow.hidden = !open;
      searchToggle.setAttribute("aria-expanded", String(open));
      searchToggle.setAttribute("aria-pressed", String(open));
      if (open) searchInput.focus();
      else clearSearch(true);
      measureSortbar();
    });

    searchInput.addEventListener("input", function () {
      query = normalize(searchInput.value);
      searchClear.hidden = !searchInput.value.length;
      render();
    });

    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "Escape") clearSearch(false);
    });

    searchClear.addEventListener("click", function () { clearSearch(false); });

    jumpSelect.addEventListener("change", function () {
      var target = document.getElementById(jumpSelect.value);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      jumpSelect.selectedIndex = 0;
    });

    syncButtons();
    measureSortbar();
    window.addEventListener("resize", measureSortbar);
    window.addEventListener("orientationchange", measureSortbar);
  }

  // closing: the field is being hidden, so don't pull focus back into it.
  function clearSearch(closing) {
    searchInput.value = "";
    query = "";
    searchClear.hidden = true;
    render();
    if (!closing) searchInput.focus();
  }

  function syncButtons() {
    var buttons = document.querySelectorAll(".sort-btn[data-sort]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", String(buttons[i].dataset.sort === sort));
    }
  }

  function buildJump(sections) {
    var jumpable = sections.filter(function (s) { return s.id; });
    jumpRow.hidden = !jumpable.length;
    jumpSelect.innerHTML = "";

    if (!jumpable.length) {
      measureSortbar();
      return;
    }

    var placeholder = document.createElement("option");
    placeholder.textContent = "Jump to…";
    placeholder.value = "";
    jumpSelect.appendChild(placeholder);

    jumpable.forEach(function (section) {
      var option = document.createElement("option");
      option.value = section.id;
      option.textContent = section.tag
        ? section.label + " (" + section.count + ")"
        : section.label + " (" + section.count + ")";
      jumpSelect.appendChild(option);
    });

    measureSortbar();
  }

  // The sort bar is sticky, so section headings need a scroll margin equal to
  // its height or "jump to" lands them underneath it.
  function measureSortbar() {
    document.documentElement.style.setProperty(
      "--sortbar-h", sortbar.offsetHeight + "px"
    );
  }

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
