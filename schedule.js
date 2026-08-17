/* Avon Eagles Football — 2026 schedule */

(function () {
  "use strict";

  var list = document.getElementById("schedule-list");
  var status = document.getElementById("schedule-status");
  var template = document.getElementById("game-template");

  fetch("schedule.json", { cache: "no-cache" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(render)
    .catch(function (err) {
      status.textContent =
        location.protocol === "file:"
          ? "This page has to be served over http to read schedule.json. From the project folder run: python3 -m http.server 8000"
          : "Could not read schedule.json (" + err.message + ").";
    });

  // Local calendar date as YYYY-MM-DD. Built by hand rather than via
  // toISOString(), which converts to UTC and can report tomorrow after 8pm.
  function todayKey() {
    var now = new Date();
    return now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");
  }

  function render(data) {
    status.remove();

    var today = todayKey();
    // ISO dates compare correctly as plain strings, so no date parsing needed.
    var nextIndex = -1;
    for (var i = 0; i < data.games.length; i++) {
      if (data.games[i].date >= today) { nextIndex = i; break; }
    }

    var frag = document.createDocumentFragment();
    data.games.forEach(function (game, index) {
      frag.appendChild(buildGame(game, index === nextIndex, game.date < today));
    });

    var home = data.games.filter(function (g) { return !g.away; }).length;
    var conf = data.games.filter(function (g) { return g.conference; }).length;

    var tail = document.createElement("p");
    tail.className = "roster-status";
    tail.textContent = data.count + " games · " + home + " home · " +
      (data.count - home) + " away · " + conf + " conference";
    frag.appendChild(tail);

    list.appendChild(frag);
  }

  function buildGame(game, isNext, isPast) {
    var el = template.content.firstElementChild.cloneNode(true);
    if (isNext) el.classList.add("card--next");
    if (isPast) el.classList.add("card--past");

    el.querySelector(".card__date-month").textContent = game.month;
    el.querySelector(".card__date-day").textContent = game.day;

    var opponent = el.querySelector(".game__opponent");
    var prefix = document.createElement("span");
    prefix.className = "game__prefix";
    prefix.textContent = game.away ? "@" : "vs";
    opponent.appendChild(prefix);
    opponent.appendChild(document.createTextNode(game.opponent));

    el.querySelector(".game__site").textContent = game.away ? "Away" : "Home";

    // Result once it exists, otherwise the date and any kickoff time.
    var bits = [game.label];
    if (game.time) bits.push(game.time);
    if (game.conference) bits.push("Conference");
    if (game.result) bits.unshift(game.result);
    if (isNext) bits.unshift("Next game");

    el.querySelector(".game__meta").textContent = bits.join("  ·  ");
    return el;
  }

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
