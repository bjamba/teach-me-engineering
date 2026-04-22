/* Leitner flashcard engine — used by flashcards.html.
   Per-deck state in localStorage: ude_cards_<deckId> = { boxes: {cardIdx: box}, stats: {...} }.
   5 boxes; "got it" bumps up one box, "nope" back to box 1. */
(function () {
  function keyFor(deckId) { return "ude_cards_" + deckId; }
  function loadState(deckId) {
    try { return JSON.parse(localStorage.getItem(keyFor(deckId)) || "{}"); } catch(e) { return {}; }
  }
  function saveState(deckId, s) { localStorage.setItem(keyFor(deckId), JSON.stringify(s)); }

  function dueOrder(deckId, cards) {
    var s = loadState(deckId);
    var boxes = s.boxes || {};
    // order: box1 first (most to learn), then 2, 3, 4, 5
    var idx = cards.map(function (_, i) { return i; });
    idx.sort(function (a, b) {
      var ba = boxes[a] || 1;
      var bb = boxes[b] || 1;
      return ba - bb;
    });
    return idx;
  }

  function grade(deckId, cardIdx, gotIt) {
    var s = loadState(deckId); s.boxes = s.boxes || {};
    var cur = s.boxes[cardIdx] || 1;
    s.boxes[cardIdx] = gotIt ? Math.min(5, cur + 1) : 1;
    s.stats = s.stats || { right: 0, wrong: 0 };
    if (gotIt) s.stats.right++; else s.stats.wrong++;
    s.lastStudied = Date.now();
    saveState(deckId, s);
  }

  window.UDE_Cards = {
    renderDeck: function (container, deckId) {
      var deck = window.UDE_DECKS[deckId];
      if (!deck) { container.textContent = "Deck not found."; return; }
      var order = dueOrder(deckId, deck.cards);
      var pos = 0, flipped = false;

      function paintStats() {
        var s = loadState(deckId);
        var boxes = s.boxes || {};
        var boxCounts = [0,0,0,0,0];
        deck.cards.forEach(function(_, i) {
          var b = (boxes[i] || 1) - 1;
          boxCounts[b]++;
        });
        var el = container.querySelector(".deck-stats");
        if (el) {
          el.innerHTML = boxCounts.map(function(n, i){
            return '<div class="stat"><div class="stat-num">'+n+'</div><div class="stat-lbl">Box '+(i+1)+'</div></div>';
          }).join("");
        }
      }

      function paint() {
        var idx = order[pos];
        var card = deck.cards[idx];
        var s = loadState(deckId);
        var box = (s.boxes || {})[idx] || 1;
        container.querySelector(".flashcard-deck").innerHTML =
          '<div class="flashcard" id="current-card">' +
          '<div class="faint" style="position:absolute;top:12px;right:16px;">Card '+(pos+1)+' / '+deck.cards.length+'</div>' +
          '<div class="faint" style="position:absolute;top:12px;left:16px;">Box '+box+'</div>' +
          (flipped
            ? '<div class="flashcard-back">'+escapeHtml(card.back)+'</div>'
            : '<div class="flashcard-front">'+escapeHtml(card.front)+'</div>') +
          '<div class="flashcard-hint">'+(flipped ? "Grade yourself below" : "Tap to reveal")+'</div>' +
          '</div>' +
          (flipped
            ? '<div class="flashcard-actions">' +
                '<button class="btn-outline btn" data-act="nope">Nope</button>' +
                '<button class="btn-ghost btn" data-act="next">Skip</button>' +
                '<button class="btn" data-act="got">Got it</button>' +
              '</div>'
            : '<div style="text-align:center;margin-top:12px;" class="faint">Space / tap to flip · ← prev · → next</div>'
          );
        var cardEl = container.querySelector("#current-card");
        cardEl.addEventListener("click", function () { flipped = !flipped; paint(); });
        var actBtns = container.querySelectorAll("[data-act]");
        Array.prototype.forEach.call(actBtns, function (b) {
          b.addEventListener("click", function (e) {
            e.stopPropagation();
            var act = b.dataset.act;
            if (act === "got") grade(deckId, idx, true);
            if (act === "nope") grade(deckId, idx, false);
            flipped = false;
            pos = (pos + 1) % deck.cards.length;
            order = dueOrder(deckId, deck.cards);
            paint();
            paintStats();
          });
        });
        paintStats();
      }

      container.innerHTML =
        '<h2>' + escapeHtml(deck.title) + ' — ' + deck.cards.length + ' cards</h2>' +
        '<div class="flashcard-deck"></div>' +
        '<div class="stat-row deck-stats" style="grid-template-columns:repeat(5,1fr);margin-top:24px;"></div>' +
        '<div style="margin-top:16px;text-align:center;">' +
          '<button class="btn btn-ghost btn-sm" id="reset-deck">Reset this deck</button>' +
        '</div>';

      container.querySelector("#reset-deck").addEventListener("click", function () {
        if (confirm("Reset progress for this deck?")) {
          localStorage.removeItem(keyFor(deckId));
          order = dueOrder(deckId, deck.cards); pos = 0; flipped = false; paint();
        }
      });

      // Keyboard
      document.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); flipped = !flipped; paint(); }
        else if (e.key === "ArrowRight") { pos = (pos + 1) % deck.cards.length; flipped = false; paint(); }
        else if (e.key === "ArrowLeft") { pos = (pos - 1 + deck.cards.length) % deck.cards.length; flipped = false; paint(); }
        else if (flipped && (e.key === "1" || e.key.toLowerCase() === "n")) { grade(deckId, order[pos], false); flipped=false; pos=(pos+1)%deck.cards.length; order=dueOrder(deckId,deck.cards); paint(); }
        else if (flipped && (e.key === "2" || e.key.toLowerCase() === "y")) { grade(deckId, order[pos], true);  flipped=false; pos=(pos+1)%deck.cards.length; order=dueOrder(deckId,deck.cards); paint(); }
      });

      paint();
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c];
    });
  }
})();
