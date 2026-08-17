/* Avon Eagles Football — roster lookup */

(function () {
  "use strict";

  var form = document.getElementById("lookup-form");
  var input = document.getElementById("number-input");
  var goBtn = document.getElementById("go-btn");
  var results = document.getElementById("results");
  var emptyState = document.getElementById("empty-state");
  var clearBtn = document.getElementById("clear-btn");
  var footerCount = document.getElementById("footer-count");
  var cardTemplate = document.getElementById("card-template");
  var playerTemplate = document.getElementById("player-template");

  var roster = null;

  /* ---------- Data ---------- */

  fetch("roster.json", { cache: "no-cache" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      roster = data;
      footerCount.textContent =
        data.team + " · " + data.season + " media roster · " + data.count + " players";
      input.disabled = false;
      goBtn.disabled = false;
      // Desktop gets the cursor placed for them; mobile keyboards should only
      // open on a real tap, so we skip autofocus on touch devices.
      if (!window.matchMedia("(hover: none)").matches) input.focus();
    })
    .catch(function (err) {
      showLoadError(err);
    });

  function showLoadError(err) {
    emptyState.innerHTML = "";

    var lede = document.createElement("p");
    lede.className = "empty__lede";
    lede.textContent = "Roster didn't load.";

    var note = document.createElement("p");
    note.className = "empty__note";
    note.textContent =
      location.protocol === "file:"
        ? "This page has to be served over http to read roster.json. From the project folder run: python3 -m http.server 8000"
        : "Could not read roster.json (" + err.message + ").";

    emptyState.appendChild(lede);
    emptyState.appendChild(note);
  }

  /* ---------- Input ---------- */

  input.addEventListener("input", function () {
    var digits = input.value.replace(/\D/g, "").slice(0, 2);
    if (digits !== input.value) input.value = digits;

    // Every number on the roster is one or two digits, and 0-9 are all real
    // jersey numbers, so a single digit can't fire on its own — it might be
    // the first half of a two-digit number. Two digits are unambiguous.
    if (digits.length === 2) submit();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    submit();
  });

  clearBtn.addEventListener("click", function () {
    var cards = results.querySelectorAll(".card");
    for (var i = 0; i < cards.length; i++) dropCard(cards[i]);
    input.value = "";
    input.focus();
  });

  function submit() {
    if (!roster) return;

    var raw = input.value.replace(/\D/g, "");
    input.value = "";
    if (!raw.length) return;

    // "05" and "5" are the same jersey.
    var num = String(parseInt(raw, 10));
    addCard(num, roster.numbers[num] || []);
  }

  /* ---------- Rendering ---------- */

  // How long a "no player wears this" card stays up before clearing itself.
  var MISSING_LINGER_MS = 2600;
  var MISSING_FADE_MS = 500;

  function addCard(num, players) {
    emptyState.hidden = true;
    clearBtn.hidden = false;

    // Looking the same number up twice moves it back to the top rather than
    // stacking a duplicate.
    var existing = results.querySelector('.card[data-num="' + num + '"]');
    if (existing) dropCard(existing);

    var previous = results.querySelector(".card--latest");
    if (previous) previous.classList.remove("card--latest", "card--entering");

    var card = buildCard(num, players);
    card.classList.add("card--latest", "card--entering");
    // Newest on top; earlier lookups stay below, in the order they were made.
    results.insertBefore(card, emptyState.nextSibling);

    // A fat-fingered number is the common case for a miss, so it cleans up
    // after itself instead of leaving a dead card in the history.
    if (!players.length) scheduleDismiss(card);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scheduleDismiss(card) {
    card._dismissTimer = setTimeout(function () {
      if (!card.isConnected) return;
      card.classList.add("card--dismissing");
      card._dismissTimer = setTimeout(function () {
        dropCard(card);
      }, MISSING_FADE_MS);
    }, MISSING_LINGER_MS);
  }

  // Single exit for every card removal, so a pending fade timer can never fire
  // against a card that is already gone.
  function dropCard(card) {
    if (card._dismissTimer) clearTimeout(card._dismissTimer);
    var wasLatest = card.classList.contains("card--latest");
    card.remove();

    // Promote whatever is now on top so there is always exactly one hero card.
    if (wasLatest) {
      var next = results.querySelector(".card");
      if (next) next.classList.add("card--latest");
    }

    if (!results.querySelector(".card")) {
      emptyState.hidden = false;
      clearBtn.hidden = true;
    }
  }

  function buildCard(num, players) {
    var card = cardTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.num = num;
    card.querySelector(".card__num-value").textContent = num;

    var body = card.querySelector(".card__body");

    if (!players.length) {
      card.classList.add("card--missing");
      body.appendChild(buildMissing(num));
      return card;
    }

    if (players.length > 1) body.classList.add("card__body--pair");

    // roster.json is already sorted: higher grade first, then heavier player,
    // then last name. Rendering in order is all this needs to do.
    for (var i = 0; i < players.length; i++) {
      body.appendChild(buildPlayer(players[i]));
    }

    return card;
  }

  function buildPlayer(player) {
    var el = playerTemplate.content.firstElementChild.cloneNode(true);
    el.querySelector(".player__name").textContent = player.name;

    var meta = el.querySelector(".player__meta");
    var facts = ["Gr. " + player.grade, player.height, player.weight + " lbs"];
    for (var i = 0; i < facts.length; i++) {
      var span = document.createElement("span");
      span.textContent = facts[i];
      meta.appendChild(span);
    }

    var posList = el.querySelector(".player__pos");
    for (var j = 0; j < player.pos.length; j++) {
      var li = document.createElement("li");
      li.textContent = player.pos[j];
      posList.appendChild(li);
    }

    return el;
  }

  function buildMissing(num) {
    var el = playerTemplate.content.firstElementChild.cloneNode(true);
    el.querySelector(".player__name").textContent = "No player wears #" + num;

    var meta = el.querySelector(".player__meta");
    var span = document.createElement("span");
    span.textContent = "Not on the 2026 roster";
    meta.appendChild(span);

    return el;
  }

  /* ---------- Offline ---------- */

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {
        /* Offline support is a bonus; the page works fine without it. */
      });
    });
  }
})();
