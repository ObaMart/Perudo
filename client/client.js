const socket = io();

/** TODO:
 * Page verification on every socket.on
 * add preselection on amount of dice in bid phase & a +1 button
 * fix querySelectors for conciseness
 * Rulebook (html/css)
 * *rework brightness slider to dialog (modal)*
 * *****get jsdoc types working properly*****
 * Display credits on bottom left at home screen
 * Autofocus on inputs (every page)
 */

/**
 * Enclosing type for players
 * @typedef {object} Player
 * @property {string} playerName (unique) name of player
 * @property {(number|string|null)} playerNum color number / identifier for player
 */

/**
 * Enclosing type for bids
 * @typedef {object} Bid
 * @property {number} amount amount of dice player bids
 * @property {2 | 3 | 4 | 5 | 6 | 12} type type of dice player bids ([])
 */

/**
 * Enclosing type for turns
 * @typedef {object} Turn
 * @property {Player} player player object of turn
 * @property {Bid} bid bid object of turn
 */

const maxDice = 5;
const allColors = ["clr1", "clr2", "clr3", "clr4", "clr5", "clr6", "clr7", "clr8"];
const nextRoundDelay = 1000; //ms
const gameEndDelay = 20000;

// const urlParams = new URLSearchParams(window.location.search);
const clientName = sessionStorage.getItem("clientName");
const clientNum = sessionStorage.getItem("clientNum");
const client = { playerName: clientName, playerNum: clientNum };

let lobbyCode = sessionStorage.getItem("lobbyCode");
const page = window.location.pathname;

let playerNames = sessionStorage.getItem("playerNames");
if (playerNames) playerNames = JSON.parse(playerNames);
else playerNames = {};

//#region home functions
function home_ToggleDialog(show) {
  if (show) {
    const playerName = document.querySelector("#player-name-input").value;
    if (playerName == "") {
      alert("Je moet een naam invullen.");
      return;
    } else if (!isAlphaNumeric(playerName)) {
      alert("Je naam mag alleen letters en cijfers bevatten.");
      return;
    }
    document.querySelector("#join-code-dialog").showModal();
    return;
  } else {
    document.querySelector("#join-code-dialog").close();
  }
}

function home_JoinWithCode() {
  const code = document.querySelector("#join-code-input").value.toUpperCase();
  const playerName = document.querySelector("#player-name-input").value;
  if (code.length != 4) {
    alert("Je moet een 4-letterige code invullen.");
    return;
  }
  sessionStorage.setItem("clientName", playerName);
  sessionStorage.setItem("lobbyCode", code);
  sessionStorage.setItem("brightness", brightnessSliderValue);
  window.location = "/lobby.html";
}

function home_CreateLobby() {
  const playerName = document.querySelector("#player-name-input").value;
  if (playerName == "") {
    alert("Je moet een naam invullen.");
    return;
  } else if (!isAlphaNumeric(playerName)) {
    alert("Je naam mag alleen letters en cijfers bevatten.");
    return;
  }
  sessionStorage.setItem("clientName", playerName);
  sessionStorage.setItem("lobbyCode", "newlobby");
  sessionStorage.setItem("brightness", brightnessSliderValue);
  window.location = "/lobby.html";
}

function home() { // return to home
  if (confirm("Weet je zeker dat je terug naar het homescherm wil?")) {
    socket.emit("cs-disconnect", { player: client, lobbyCode: lobbyCode })
    sessionStorage.clear();
    window.location = "/";
  }
}
//#endregion home functions

//#region brightness
let brightnessSliderValue = 0.9
const brightnessSlider = document.querySelector("#brightness-slider");
const b = sessionStorage.getItem("brightness");
if (b) {
  brightnessSliderValue = parseFloat(b);
}
document.querySelector("#dynamic-brightness-overlay").style.backgroundColor = `hsla(0, 0%, 0%, ${0.7 * (1 - brightnessSliderValue)})`
brightnessSlider.value = brightnessSliderValue;
let brightnessSliderVisible = false;
function toggleBrightnessSlider() {
  if (brightnessSliderVisible) {
    brightnessSlider.style.opacity = 0;
    brightnessSliderVisible = false;
  } else {
    brightnessSlider.style.opacity = 1;
    brightnessSliderVisible = true;
  }
}

brightnessSlider.oninput = function() {
  brightnessSliderValue = brightnessSlider.value
  document.querySelector("#dynamic-brightness-overlay").style.backgroundColor = `hsla(0, 0%, 0%, ${0.7 * (1 - brightnessSliderValue)})`
}
//#endregion brightness

//#region errors
socket.on("sc-error-fatal", data => {
  const { errorMessage } = data;
  if (errorMessage) {
    alert(errorMessage);
  } else {
    // default error message
    alert("Er is een probleem opgetreden. Je wordt teruggestuurd naar de homepagina.");
  }
  sessionStorage.clear();
  window.location = "/"
});
socket.on("sc-error", data => {
  const { errorMessage } = data;
  if (errorMessage) {
    alert(errorMessage);
  } else {
    alert("Er is een probleem opgetreden.")
  }
})
//#endregion

//#region lobby
let selected = false;
if (page == "/lobby.html") {
  if (lobbyCode == "newlobby") {
    lobbyCode = Array.from({ length: 4 }, () => randomChoice(Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ"))).join("");
    sessionStorage.setItem("lobbyCode", lobbyCode);
    socket.emit("cs-lobby-create", { lobbyCode: lobbyCode, playerName: clientName });
  } else {
    document.querySelector("#start-game-button").style.display = "none";
    document.querySelector("#settings-icon").style.display = "none";
    socket.emit("cs-lobby-join", { lobbyCode: lobbyCode, playerName: clientName });
  }
  document.querySelector("#lobby-code").innerHTML = lobbyCode
}
socket.on("sc-lobby-player-update", data => {
  Object.entries(data).forEach(([colorNum, playerName]) => {
    if (playerName) {
      document.getElementById(`player${colorNum}-name`).innerHTML = playerName;
      document.getElementById(`player${colorNum}`).style.cursor = "auto";
      playerNames[colorNum] = playerName;
    } else {
      document.getElementById(`player${colorNum}-name`).innerHTML = "Deze kleur is beschikbaar, klik om te kiezen!";
      document.getElementById(`player${colorNum}`).style.cursor = "pointer";
    }
    if (playerName == clientName) {
      selected = true;
      client.playerNum = colorNum;
      sessionStorage.setItem("clientNum", colorNum);
    }
  });
});

socket.on("sc-joined-players-no-color", players => {
  const container = document.querySelector(".players-without-color")
  container.innerHTML = "";
  if (players.length > 0) players.unshift("Wachten op:")
  for (const playerName of players) {
    const el = document.createElement("p");
    el.innerHTML = playerName;
    container.appendChild(el);
  }
});

socket.on("sc-lobby-new-owner", ({ playerName }) => {
  if (playerName == client.playerName) {
    document.querySelector("#start-game-button").style.display = "inline";
    document.querySelector("#settings-icon").style.display = "inline";
  }
})
function lobby_ChooseColor(colorNum) {
  if (selected) {
    alert("Je hebt al een kleur gekozen.")
    return
  }
  const playerName = sessionStorage.getItem("clientName");
  socket.emit("cs-lobby-color-choice", { playerName: playerName, color: colorNum, lobbyCode: lobbyCode });
}

function lobby_StartGame() {
  if (confirm("Wil je het spel starten?")) {
    socket.emit("cs-lobby-start", { playerName: clientName, lobbyCode: lobbyCode });
  }
}

function lobby_OpenSettings() {
  document.querySelector("#settings-dialog").showModal();
}

function lobby_CancelSettings() {
  document.querySelector("#settings-dialog").close();
}

function lobby_SaveSettings() {
  const dialog = document.querySelector("#settings-dialog");
  dialog.close();
}
//#endregion lobby

//#region in-game

let roundData = {}

socket.on("sc-game-init", data => {
  // const {lobbyCode} = data;
  sessionStorage.setItem("playerNames", JSON.stringify(playerNames));
  window.location = "/game.html";
});
if (page == "/game.html") {
  socket.emit("cs-game-ready", { player: client, lobbyCode: lobbyCode });
}

function game_Dudo() {
  socket.emit("cs-game-dudo", { lobbyCode: lobbyCode, player: client, lastTurn: roundData.lastTurn });
}

function game_Calza() {
  socket.emit("cs-game-calza", { lobbyCode: lobbyCode, player: client, lastTurn: roundData.lastTurn });
}

function game_Bid() {
  const chosenBidAmount = parseInt(document.querySelector("#bid-amount-input").value);
  if (chosenBidAmount > 40) {
    alert("Je kan niet meer dan 40 dobbelstenen bieden, want er kunnen maximaal 40 dobbelstenen in het spel zitten.");
    return;
  } else if (chosenBidAmount > 10) {
    if (!confirm(`Weet je zeker dat je ${chosenBidAmount} dobbelstenen wilt bieden?`)) return;
  }
  if ( // restructure this
    !(
      (chosenDiceType > roundData.lastTurn.bid.type && chosenBidAmount >= roundData.lastTurn.bid.amount) // verhoog soort dobbelstenen
      || (chosenDiceType >= roundData.lastTurn.bid.type && chosenBidAmount > roundData.lastTurn.bid.amount && roundData.lastTurn.bid.type != 12) // verhoog aantal dobbelstenen
      || (chosenBidAmount > roundData.lastTurn.bid.amount * 2 && roundData.lastTurn.bid.type == 12 && chosenDiceType != 12) // switch van jokers en verhoog
      || (chosenBidAmount > Math.floor(roundData.lastTurn.bid.amount / 2) && roundData.lastTurn.bid.type != 12 && chosenDiceType == 12) // switch naar jokers en verhoog
      || (chosenDiceType == 12 && roundData.lastTurn.bid.type == 12 && chosenBidAmount > roundData.lastTurn.bid.amount) // verhoog jokers
    ) || !(chosenBidAmount > 0 && chosenDiceType > 0)
  ) {
    alert("Jouw bod is ongeldig. Probeer het opnieuw met een ander bod.");
    return;
  } else if (
    roundData.lastTurn.player.playerName && roundData.pacifico
    && chosenDiceType != roundData.lastTurn.bid.type
    && roundData.clientDice && roundData.clientDice.length != 1
  ) {
    alert("Jouw bod is ongeldig. Omdat dit een pacifico-ronde (armoederonde) is, moet je dezelfde dobbelsteen kiezen als de vorige persoon, tenzij je maar één dobbelsteen in bezit hebt.");
    return;
  }
  socket.emit("cs-game-bid", { lobbyCode: lobbyCode, player: client, bid: { amount: chosenBidAmount, type: chosenDiceType } });
}

socket.on("sc-new-turn", data => {
  const { lobbyCode, playersTurn, lastTurn, pacifico, dice } = data;
  document.querySelector("#players-dice-container").innerHTML = "";
  roundData.lastTurn = lastTurn;
  roundData.pacifico = pacifico;
  if (pacifico) {
    document.querySelectorAll(".pacifico-label").forEach(el => el.innerHTML = " (Let op: dit is een pacifico-ronde)");
  } else {
    document.querySelectorAll(".pacifico-label").forEach(el => el.innerHTML = "");
  }
  let clientDice;
  if (dice) {
    if (client.playerNum in dice) {
      clientDice = dice[client.playerNum];
      roundData.clientDice = clientDice;
    } else {
      for (let i = 0; i < maxDice; i++) {
        document.getElementById(`rolled-dice${i + 1}-yt`).style.display = "none";
        document.getElementById(`rolled-dice${i + 1}-ot`).style.display = "none";
      }
      document.querySelector("#your-dice-text").innerHTML = "Je hebt geen dobbelstenen meer, je ligt uit het spel"
    }
  }
  chosenDiceType = 0;
  document.querySelector(".main-color-overlay").style.backgroundColor = `var(--clr-${playersTurn.playerNum})`;
  if (clientDice) {
    for (let i = 0; i < maxDice; i++) {
      const die = document.getElementById(`rolled-dice${i + 1}-yt`);
      const die2 = document.getElementById(`rolled-dice${i + 1}-ot`);
      if (clientDice[i]) {
        die.src = `icons/dice/${clientDice[i]}.png`;
        die.style.display = "inline";
        die2.src = `icons/dice/${clientDice[i]}.png`;
        die2.style.display = "inline";
      } else {
        die.style.display = "none";
        die2.style.display = "none";
      }
    }
  }
  if (!lastTurn) {
    document.querySelectorAll(".last-turn").forEach(el => { el.style.display = "none" });
    roundData.lastTurn = { bid: { type: 0, amount: 0 }, player: { playerName: null, playerNum: null } }
  } else {
    document.querySelectorAll(".last-turn").forEach(el => { el.style.display = "inline" });
    document.querySelectorAll("[last-player-name]").forEach(el => el.innerHTML = lastTurn.player.playerName);
    document.querySelectorAll("[last-player-bid-amount]").forEach(el => el.innerHTML = lastTurn.bid.amount);
    document.querySelectorAll("[last-player-bid-type]").forEach(el => el.src = `icons/dice/${lastTurn.bid.type}.png`);
  }
  if (playersTurn.playerName == client.playerName) {
    // Your turn
    for (const x of [2, 3, 4, 5, 6, 12]) {
      document.getElementById(`dice${x}`).classList.add("unchosen");
    }
    document.querySelector("#bid-amount-input").value = "";
    showGamePage("your-turn");
    if (lastTurn && lastTurn.player.playerName) game_Select(lastTurn.bid.type);
    document.querySelector("#bid").innerHTML = lastTurn ? "Verhogen" : "Bieden";
    document.querySelector("#game-buttons-container").style.display = lastTurn ? "flex" : "none";
  } else {
    // Others turn
    showGamePage("others-turn");
    document.querySelector("[current-player]").innerHTML = playersTurn.playerName;
  }
});

socket.on("sc-round-end", data => {
  const { inflicter, lastTurn, dice, ownerName, guessedDiceAmount, winner, loser, type } = data;
  const inflicted = lastTurn.player
  showGamePage("reveal-round");
  document.querySelector("#next-round-button").style.display = "none";
  document.querySelector(".main-color-overlay").style.backgroundColor = `var(--clr-0)`;
  if (type == "dudo") document.querySelector("#inflicter-action").innerHTML = `${inflicter.playerName} betwijfelt de gok van ${inflicted.playerName}`;
  else document.querySelector("#inflicter-action").innerHTML = `${inflicter.playerName} denkt dat de gok van ${inflicted.playerName} exact klopt`;
  document.querySelector("#guess-amount").innerHTML = lastTurn.bid.amount;
  document.querySelector("#guess-type").src = `icons/dice/${lastTurn.bid.type}.png`;
  // v
  if (winner && dice[winner.playerNum].length != maxDice) {
    document.querySelector("#winner-loser-action").innerHTML =
      `${winner.playerName} krijgt een dobbelsteen erbij, want er is exact ${guessedDiceAmount} keer een <img src="icons/dice/${lastTurn.bid.type}.png" class="dice small-dice"> in het spel`;
  } else if (winner) {
    document.querySelector("#winner-loser-action").innerHTML =
      `${winner.playerName} krijgt niks, want er is exact ${guessedDiceAmount} keer een <img src="icons/dice/${lastTurn.bid.type}.png" class="dice small-dice"> in het spel, maar ${winner.playerName} heeft al ${maxDice} dobbelstenen`;
  } else {
    document.querySelector("#winner-loser-action").innerHTML =
      `${loser.playerName} moet een dobbelsteen inleveren, want er is ${guessedDiceAmount} keer een <img src="icons/dice/${lastTurn.bid.type}.png" class="dice small-dice"> in het spel`;
  }
  // ^ move this stuff to index.js (send string instead of game.dice) (unnecessary client-side logic)
  const container = document.querySelector("#players-dice-container");
  let diceList, card, cardName, cardDice, cardDie
  for (const playerNum in dice) {
    diceList = dice[playerNum];
    card = document.createElement("div");
    card.classList.add("player-card", "standard-shadow");
    card.style.backgroundColor = `var(--clr-${playerNum});`;
    cardName = document.createElement("p");
    cardName.classList.add("player-name", "standard-shadow");
    cardName.innerHTML = playerNames[playerNum];
    cardDice = document.createElement("div");
    cardDice.classList.add("card-dice");
    if (winner && winner.playerNum == playerNum && diceList.length != maxDice) diceList.push("P");
    let i = 1;
    for (const die of diceList) {
      cardDie = document.createElement("img");
      cardDie.src = `icons/dice/${die}.png`;
      cardDie.classList.add("dice", "reveal-dice");
      if (loser && loser.playerNum == playerNum && i == diceList.length) cardDie.classList.add("dissolved");
      cardDice.appendChild(cardDie);
      i++;
    }
    card.appendChild(cardName);
    card.appendChild(cardDice);
    container.append(card);
  }
  if (client.playerName == ownerName) {
    (async () => {
      await setTimeout(async () => {
        document.querySelector("#next-round-button").style.display = "flex";
      }, nextRoundDelay);
    })();
  }
});

function showGamePage(page) {
  switch (page) {
    case "your-turn":
      document.querySelectorAll("#others-turn, #reveal-round").forEach(el => { el.style.display = "none" });
      document.querySelector("#your-turn").style.display = "flex";
      break;

    case "others-turn":
      document.querySelectorAll("#your-turn, #reveal-round").forEach(el => { el.style.display = "none" });
      document.querySelector("#others-turn").style.display = "flex";
      break;

    case "reveal-round":
      document.querySelectorAll("#your-turn, #others-turn").forEach(el => { el.style.display = "none" });
      document.querySelector("#reveal-round").style.display = "flex";
      break;

    default:
      break;
  }
  return;
}

let chosenDiceType = 0;
function game_Select(diceNumber) {
  document.getElementById(`dice${diceNumber}`).classList.remove("unchosen");
  chosenDiceType = diceNumber;
  for (const x of [2, 3, 4, 5, 6, 12]) {
    if (x != diceNumber) document.getElementById(`dice${x}`).classList.add("unchosen");
  }
}

function game_NextRound() {
  if (confirm("Weet je zeker dat je de volgende ronde wil starten?")) {
    socket.emit("cs-next-round", { player: client, lobbyCode: lobbyCode });
  }
}

//#endregion in-game

//#region end screen
socket.on("sc-game-end", data => {
  const { winner } = data;
  document.querySelector("#next-round-button").remove();
  (async () => {
    await setTimeout(async () => {
      sessionStorage.setItem("winnerName", winner.player.playerName);
      sessionStorage.setItem("winnerColor", winner.player.playerNum);
      sessionStorage.setItem("winnerDice", winner.dice);
      window.location = "/winner.html";
    }, gameEndDelay);
  })();

})

if (page == "/winner.html") {
  const winnerName = sessionStorage.getItem("winnerName");
  const backgroundColor = sessionStorage.getItem("winnerColor");
  const winnerDice = sessionStorage.getItem("winnerDice");
  document.querySelector(".main-color-overlay").style.backgroundColor = `var(--clr-${backgroundColor})`;
  document.querySelector("#winner-name").innerHTML = winnerName;
  document.querySelector("#winner-dice").innerHTML = winnerDice;
}
//#endregion end screen

//#region general functions
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isAlphaNumeric(str) {
  var code, i, len;

  for (i = 0, len = str.length; i < len; i++) {
    code = str.charCodeAt(i);
    if (!(code > 47 && code < 58) && // numeric (0-9)
      !(code > 64 && code < 91) && // upper alpha (A-Z)
      !(code > 96 && code < 123)) { // lower alpha (a-z)
      return false;
    }
  }
  return true;
}

function last(array) {
  return array[array.length - 1];
}

function flip(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));
}
//#endregion general functions