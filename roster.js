/* Avon Eagles Football — full roster, in jersey number order */

(function () {
  "use strict";

  var list = document.getElementById("roster-list");
  var status = document.getElementById("roster-status");
  var cardTemplate = document.getElementById("card-template");
  var playerTemplate = document.getElementById("player-template");

  fetch("roster.json", { cache: "no-cache" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(render)
    .catch(function (err) {
      status.textContent =
        location.protocol === "file:"
          ? "This page has to be served over http to read roster.json. From the project folder run: python3 -m http.server 8000"
          : "Could not read roster.json (" + err.message + ").";
    });

  function render(data) {
    status.remove();

    // roster.json keys are strings, so sort numerically rather than
    // lexically or #10 would land between #1 and #2.
    var numbers = Object.keys(data.numbers).sort(function (a, b) {
      return Number(a) - Number(b);
    });

    var frag = document.createDocumentFragment();
    for (var i = 0; i < numbers.length; i++) {
      frag.appendChild(buildCard(numbers[i], data.numbers[numbers[i]]));
    }
    list.appendChild(frag);

    var count = document.createElement("p");
    count.className = "roster-status";
    count.textContent = data.count + " players · " + numbers.length + " numbers";
    list.appendChild(count);
  }

  function buildCard(num, players) {
    var card = cardTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector(".card__num-value").textContent = num;

    var body = card.querySelector(".card__body");
    for (var i = 0; i < players.length; i++) {
      body.appendChild(buildPlayer(players[i]));
    }
    return card;
  }

  function buildPlayer(player) {
    var el = playerTemplate.content.firstElementChild.cloneNode(true);
    el.querySelector(".player__name").textContent = player.name;
    // Positions sit inline and right-aligned here, so the whole player fits
    // on two lines rather than the lookup page's three.
    el.querySelector(".player__pos-inline").textContent = player.pos.join(" / ");
    el.querySelector(".player__meta").textContent =
      "Gr. " + player.grade + "  ·  " + player.height + "  ·  " + player.weight + " lbs";
    return el;
  }

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
