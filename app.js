/* Avon Eagles Football — roster lookup */

(function () {
  "use strict";

  var keypad = document.getElementById("keypad");
  var display = document.getElementById("entry-display");
  var displayValue = document.getElementById("entry-value");
  var results = document.getElementById("results");
  var emptyState = document.getElementById("empty-state");
  var clearBtn = document.getElementById("clear-btn");
  var cardTemplate = document.getElementById("card-template");
  var playerTemplate = document.getElementById("player-template");

  var audioBtn = document.getElementById("audio-btn");

  var roster = null;
  var entry = "";

  var speech = window.speechSynthesis || null;

  // Recorded clips when we have them, the browser voice otherwise. One shared
  // Audio element, because iOS only lets an element play after it has been
  // started once inside a real tap.
  var clips = {};
  var player = new Audio();
  player.preload = "none";

  // One control, three states, cycled by tapping. Off is first so the page
  // never makes noise until someone asks for it.
  var AUDIO_STATES = [
    { name: "off",    rate: 0,   label: "Announcements off. Tap to turn on.",              title: "Announcements off" },
    { name: "normal", rate: 1,   label: "Announcements on, normal speed. Tap for fast.",   title: "Announcements on" },
    { name: "fast",   rate: 1.3, label: "Announcements on, fast. Tap to turn off.",        title: "Announcements on, fast" }
  ];

  var audioIndex = 0;

  /* ---------- Data ---------- */

  fetch("roster.json", { cache: "no-cache" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      roster = data;
      setKeysEnabled(true);
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

  /* ---------- Speaking ---------- */

  function announcement(num, players) {
    // roster.json carries the wording, built by tools/build_roster.py, so the
    // recorded clips and the browser voice always say the same thing.
    if (roster && roster.announce && roster.announce[num]) {
      return roster.announce[num];
    }
    return "Number " + num + ". No player.";
  }

  function audioState() {
    return AUDIO_STATES[audioIndex];
  }

  function stopAudio() {
    if (speech) speech.cancel();
    player.pause();
  }

  // num is optional: pass it to prefer a recorded clip for that jersey.
  function speak(text, num) {
    var state = audioState();
    if (!state.rate) return;

    // A new lookup cuts off the previous announcement rather than queueing.
    stopAudio();

    var clip = num && clips[num];
    if (clip) {
      player.src = clip.file;
      // Same speed control as the browser voice. preservesPitch keeps it from
      // sounding chipmunky at the faster setting.
      player.playbackRate = state.rate;
      player.preservesPitch = true;
      player.webkitPreservesPitch = true;
      var attempt = player.play();
      if (attempt && attempt.catch) {
        // Autoplay refused or the file is missing — say it instead of nothing.
        attempt.catch(function () { browserSpeak(text, state.rate); });
      }
      return;
    }

    browserSpeak(text, state.rate);
  }

  function browserSpeak(text, rate) {
    if (!speech) return;
    speech.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.lang = "en-US";
    speech.speak(utterance);
  }

  function applyAudioState() {
    var state = audioState();
    audioBtn.dataset.state = state.name;
    audioBtn.setAttribute("aria-label", state.label);
    audioBtn.title = state.title;
    if (!state.rate) stopAudio();
    try { localStorage.setItem("avon.audioState", state.name); } catch (e) {}
  }

  function loadClips() {
    // Entirely optional. No manifest, or a bad one, just means every
    // announcement uses the browser voice.
    fetch("audio.json", { cache: "no-cache" })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) { if (data && data.clips) clips = data.clips; })
      .catch(function () {});
  }

  function bindAudio() {
    if (!speech && !window.Audio) {
      // No speech support: hide the control rather than offer a dead button.
      audioBtn.hidden = true;
      return;
    }

    loadClips();

    audioBtn.addEventListener("click", function () {
      audioIndex = (audioIndex + 1) % AUDIO_STATES.length;
      applyAudioState();
      // Confirming out loud doubles as the iOS gesture that unlocks speech,
      // and lets you hear the speed you just picked.
      if (audioState().name === "normal") speak("Announcements on.");
      else if (audioState().name === "fast") speak("Fast.");
    });

    var saved;
    try { saved = localStorage.getItem("avon.audioState"); } catch (e) {}
    for (var i = 0; i < AUDIO_STATES.length; i++) {
      if (AUDIO_STATES[i].name === saved) audioIndex = i;
    }
    applyAudioState();
  }

  /* ---------- Entry ---------- */

  function setKeysEnabled(on) {
    var keys = keypad.querySelectorAll(".key");
    for (var i = 0; i < keys.length; i++) keys[i].disabled = !on;
  }

  function render() {
    displayValue.textContent = entry.length ? entry : "00";
    display.classList.toggle("entry__display--empty", !entry.length);
  }

  function pressDigit(digit) {
    if (!roster || entry.length >= 2) return;
    entry += digit;
    render();

    // Every number on the roster is one or two digits, and 0-9 are all real
    // jersey numbers, so a single digit can't fire on its own — it might be
    // the first half of a two-digit number. Two digits are unambiguous.
    if (entry.length === 2) submit();
  }

  function pressBack() {
    if (!entry.length) return;
    entry = entry.slice(0, -1);
    render();
  }

  function submit() {
    if (!roster || !entry.length) return;

    // "05" and "5" are the same jersey.
    var num = String(parseInt(entry, 10));
    entry = "";
    render();
    addCard(num, roster.numbers[num] || []);
  }

  keypad.addEventListener("click", function (event) {
    var key = event.target.closest(".key");
    if (!key || key.disabled) return;

    if (key.dataset.digit) pressDigit(key.dataset.digit);
    else if (key.dataset.action === "back") pressBack();
    else if (key.dataset.action === "go") submit();
  });

  // A laptop in the press box should still be able to just type.
  document.addEventListener("keydown", function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key >= "0" && event.key <= "9") {
      pressDigit(event.key);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      pressBack();
    } else if (event.key === "Enter") {
      // Let Enter activate a focused button rather than hijacking it.
      if (document.activeElement && document.activeElement.tagName === "BUTTON") return;
      submit();
    } else {
      return;
    }
  });

  clearBtn.addEventListener("click", function () {
    var cards = results.querySelectorAll(".card");
    for (var i = 0; i < cards.length; i++) dropCard(cards[i]);
    entry = "";
    render();
  });

  // The keypad is fixed, so the page has to reserve exactly its height.
  function measureKeypad() {
    document.documentElement.style.setProperty(
      "--keypad-h", keypad.offsetHeight + "px"
    );
  }

  bindAudio();
  render();
  measureKeypad();
  window.addEventListener("resize", measureKeypad);
  window.addEventListener("orientationchange", measureKeypad);

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

    speak(announcement(num, players), num);

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
