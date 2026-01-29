(function () {
  const $ = (id) => document.getElementById(id);
  const coinsEl = $("coins");
  const refillHint = $("refill-hint");
  const btnStart = $("btn-start");
  const lobby = $("lobby");
  const gameSection = $("game");
  const headerPot = $("header-pot");
  const potEl = $("pot");
  const playerOpen = $("player-open");
  const playerHidden = $("player-hidden");
  const aiOpen = $("ai-open");
  const aiHidden = $("ai-hidden");
  const actionsEl = $("actions");
  const messageEl = $("message");
  const playerBestHandEl = $("player-best-hand");
  const playerActionEl = $("player-action");
  const aiActionEl = $("ai-action");
  const bettingEl = document.querySelector(".betting");
  const actionLogEl = document.querySelector(".action-log");

  let gameActive = false;

  function formatActionText(action, amount) {
    if (action === "check") return "Check";
    if (action === "fold") return "Fold";
    if (action === "bet") return "Bet " + (amount ?? 3);
    if (action === "call") return amount != null ? "Call " + amount : "Call";
    if (action === "raise") return "Raise " + (amount ?? 3);
    return action;
  }

  function showLobby() {
    lobby.classList.remove("hidden");
    gameSection.classList.add("hidden");
    if (headerPot) headerPot.classList.add("hidden");
    gameActive = false;
  }

  function showGame() {
    lobby.classList.add("hidden");
    gameSection.classList.remove("hidden");
    if (headerPot) headerPot.classList.remove("hidden");
    gameActive = true;
  }

  function setMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = "message " + (type || "");
  }

  async function refreshCoins() {
    const { chips, nextRefillMs } = await ensureCoins();
    coinsEl.textContent = chips;
    refillHint.textContent = nextRefillMs != null ? formatNextRefill(nextRefillMs) : "";
    btnStart.disabled = chips < ANTE;
  }

  function renderHands() {
    const g = getState();
    if (!g) return;
    const phase = g.phase;
    const aiFolded = g.winner === "player" && g.reason === "fold";
    const showAiHidden = phase === "showdown" && !aiFolded;

    renderCards(playerOpenCards(), false, playerOpen);
    renderCards(playerHiddenCards(), false, playerHidden);

    renderCards(aiOpenCards(), false, aiOpen);
    renderCards(aiHiddenCards(), !showAiHidden, aiHidden);

    if (playerBestHandEl && g.player.hand && g.player.hand.length === 7) {
      const eval7 = bestOf7(g.player.hand);
      playerBestHandEl.textContent = " · " + formatHandSummary(eval7);
    } else if (playerBestHandEl) {
      playerBestHandEl.textContent = "";
    }
  }

  function updatePot() {
    const g = getState();
    potEl.textContent = g ? g.pot : 0;
  }

  function updateCoinsDisplay() {
    const g = getState();
    if (gameActive && g) coinsEl.textContent = g.player.chips;
  }

  function buildBettingButtons() {
    actionsEl.innerHTML = "";
    const g = getState();
    if (!g || g.phase !== "betting" || g.turn !== "player" || g.player.folded) return;

    if (canCheck()) {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "Check";
      btn.onclick = () => act("check");
      actionsEl.appendChild(btn);
    }
    if (canBet()) {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "Bet 3";
      btn.onclick = () => act("bet", 3);
      actionsEl.appendChild(btn);
    }
    if (canCall()) {
      const amt = callAmount();
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "Call " + amt;
      btn.onclick = () => act("call");
      actionsEl.appendChild(btn);
    }
    if (canRaise()) {
      const to = minRaiseAmount();
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "Raise " + to;
      btn.onclick = () => act("raise", to);
      actionsEl.appendChild(btn);
    }
    const foldBtn = document.createElement("button");
    foldBtn.className = "btn";
    foldBtn.textContent = "Fold";
    foldBtn.onclick = () => act("fold");
    actionsEl.appendChild(foldBtn);
  }

  function act(action, amount) {
    const displayAmt = action === "call" ? callAmount() : amount;
    const r = applyPlayerAction(action, amount);
    if (!r) return;
    if (playerActionEl) playerActionEl.textContent = formatActionText(action, displayAmt);
    updatePot();
    updateCoinsDisplay();
    renderHands();
    buildBettingButtons();

    if (r.done && r.showdown) {
      finishHand();
      return;
    }
    if (r.done && r.winner) {
      finishHand();
      return;
    }
    if (r.runAi) {
      setTimeout(runAi, 400);
    }
  }

  function runAi() {
    const g = getState();
    if (!g || g.turn !== "ai" || g.ai.folded) return;
    const choice = aiDecide(g);
    if (!choice) return;
    const aiCallAmt = choice.action === "call" ? (g.currentBet - g.ai.betThisRound) : choice.amount;
    const r = applyAiAction(choice.action, choice.amount);
    if (!r) return;
    if (aiActionEl) aiActionEl.textContent = formatActionText(choice.action, aiCallAmt);
    updatePot();
    updateCoinsDisplay();
    renderHands();
    buildBettingButtons();

    if (r.done && r.showdown) {
      finishHand();
      return;
    }
    if (r.done && r.winner) {
      finishHand();
      return;
    }
    if (!r.done) {
      buildBettingButtons();
    }
  }

  function finishHand() {
    const g = getState();
    if (!g) return;
    const result = runShowdown();
    settleCoins();
    const winner = result?.winner ?? g.winner;
    const reason = result?.reason ?? g.reason ?? "hand";

    g.phase = "showdown";
    // 결과 화면에서는 베팅 영역과 행동 로그를 숨겨서 카드와 결과만 보이게 함
    if (bettingEl) bettingEl.classList.add("hidden");
    if (actionLogEl) actionLogEl.classList.add("hidden");
    renderHands();

    const pEval = bestOf7(g.player.hand);
    const aEval = bestOf7(g.ai.hand);
    const pText = formatHandSummary(pEval);
    const aText = formatHandSummary(aEval);

    const nl = "\n";
    const clickToContinue = nl + nl + "(Click to return to lobby)";

    const lostAmount = (g.playerTotalPutIn != null ? g.playerTotalPutIn : 0);

    if (reason === "fold") {
      if (winner === "player") {
        setMessage("You win (AI folded)." + nl + "+" + g.pot + " coins" + clickToContinue, "win");
      } else {
        setMessage("You folded. AI wins." + nl + "-" + lostAmount + " coins" + clickToContinue, "lose");
      }
    } else if (winner === "tie") {
      setMessage(`'${pText}'  VS  '${aText}' Tie. (Ante & bets refunded)` + clickToContinue, "tie");
    } else if (winner === "player") {
      setMessage(`'${pText}'  VS  '${aText}' You win.${nl}+${g.pot} coins` + clickToContinue, "win");
    } else {
      setMessage(`'${pText}'  VS  '${aText}' AI wins.${nl}-${lostAmount} coins` + clickToContinue, "lose");
    }

    (async () => {
      await setChips(g.player.chips);
      await refreshCoins();
    })();

    endGame();

    function goToLobbyOnClick() {
      gameSection.removeEventListener("click", goToLobbyOnClick);
      showLobby();
      setMessage("", "");
    }
    setTimeout(function () {
      gameSection.addEventListener("click", goToLobbyOnClick);
    }, 0);
  }

  function forfeit() {
    if (!gameActive) return;
    const g = getState();
    if (!g) return;
    g.player.folded = true;
    g.winner = "ai";
    g.settled = true;
    g.ai.chips += g.pot;
    (async () => {
      await setChips(g.player.chips);
      await refreshCoins();
    })();
    endGame();
    gameActive = false;
    showLobby();
  }

  btnStart.addEventListener("click", async () => {
    const chips = await getChips();
    if (chips < ANTE) return;
    createGame(chips, 100);
    showGame();
    updatePot();
    renderHands();
    buildBettingButtons();
    setMessage("", "");
    coinsEl.textContent = getState().player.chips;
    if (playerActionEl) playerActionEl.textContent = "—";
    if (aiActionEl) aiActionEl.textContent = "—";
    if (bettingEl) bettingEl.classList.remove("hidden");
    if (actionLogEl) actionLogEl.classList.remove("hidden");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") forfeit();
  });

  (async function init() {
    await refreshCoins();
    showLobby();
    // 팝업이 열려 있는 동안 1초마다 코인/리필 표시 갱신 (시간이 흐르도록)
    setInterval(refreshCoins, 1000);
  })();
})();
