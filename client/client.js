const socket = io();

/** TODO:
 * Page verification on every socket.on
 * add preselection on amount of dice in bid phase & a +1 button
 * switch from document.getElementById to document.querySelector
 * Rulebook (html/css)
 * ***responsiveness***
 */
const maxDice = 5;
const allColors = ["clr1","clr2","clr3","clr4","clr5","clr6", "clr7", "clr8"];
const nextRoundDelay = 1000; //ms

const urlParams = new URLSearchParams(window.location.search);
const page = window.location.pathname;


//#region home functions
function home_JoinWithCode() {
	const code = document.getElementById("join-code-input").value.toUpperCase();
	const playerName = document.getElementById("player-name-input").value;
	if (playerName == "") {
		alert("Je moet een naam invullen.");
	} else if (!isAlphaNumeric(playerName)) {
		alert("Je naam mag alleen letters en cijfers bevatten.");
	} else if (code.length != 4) {
		alert("Je moet een 4-letterige code invullen.")
	} else {
		window.location = `/lobby.html?code=${code}&b=${brightnessSliderValue}&playername=${playerName}`;
	}
}

function home_CreateLobby() {
	const playerName = document.getElementById("player-name-input").value;
	if (playerName == "") {
		alert("Je moet een naam invullen.");
	} else if (!isAlphaNumeric(playerName)) {
		alert("Je naam mag alleen letters en cijfers bevatten.");
	} else {
		window.location = `/lobby.html?code=newlobby&b=${brightnessSliderValue}&playername=${playerName}`;
	}
}

function home() { // return to home
	if (confirm("Weet je zeker dat je terug naar het homescherm wil?")) {
		const clientName = urlParams.get("playername");
		const lobbyCode = urlParams.get("code");
		socket.emit("cs-disconnect", {playerName: clientName, lobbyCode: lobbyCode})
		window.location = "/";
	}
}
//#endregion home functions

//#region brightness
var brightnessSliderValue = 0.9
const brightnessSlider = document.getElementById("brightness-slider");
const urlParamsBrightness = urlParams.get("b")
if (urlParamsBrightness) {
	brightnessSliderValue = parseFloat(urlParamsBrightness)
}
document.getElementById("dynamic-brightness-overlay").style.backgroundColor = `hsla(0, 0%, 0%, ${0.7 * (1 - brightnessSliderValue)})`
brightnessSlider.value = brightnessSliderValue;
var brightnessSliderVisible = false;
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
    document.getElementById("dynamic-brightness-overlay").style.backgroundColor = `hsla(0, 0%, 0%, ${0.7 * (1 - brightnessSliderValue)})`
}
//#endregion brightness

//#region errors
socket.on("sc-error-fatal", data => {
	const {playerName, errorMessage} = data;
	if (errorMessage) {
		alert(errorMessage);
	} else {
		// default error message
		alert("Er is een probleem opgetreden. Je wordt teruggestuurd naar de homepagina.");
	}
	window.location = "/"
});
socket.on("sc-error", data => {
	const {playerName, errorMessage} = data;
	if (errorMessage) {
		alert(errorMessage);
	} else {
		alert("Er is een probleem opgetreden.")
	}
})
//#endregion

//#region lobby
let selected = false;
let lobbyCode = ""
if (page == "/lobby.html") {
	lobbyCode = urlParams.get("code")
	const clientName = urlParams.get("playername")
	if (lobbyCode == "newlobby") {
		lobbyCode = Array.from({length: 4}, () => randomChoice(Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ"))).join("");
		socket.emit("cs-lobby-create", {lobbyCode: lobbyCode, playerName: clientName});
	} else {
		document.getElementById("start-game-button").style.display = "none";
		document.getElementById("settings-icon").style.display = "none";
		socket.emit("cs-lobby-join", {lobbyCode: lobbyCode, playerName: clientName});
	}
	document.getElementById("lobby-code").innerHTML = lobbyCode
}
socket.on("sc-lobby-player-update", data => {
	const clientName = urlParams.get("playername");
	Object.entries(data).forEach(([colorNum, playerName]) => {
		if (playerName) {
			document.getElementById(`player${colorNum}-name`).innerHTML = playerName;
			document.getElementById(`player${colorNum}`).style.cursor = "auto";
		} else {
			document.getElementById(`player${colorNum}-name`).innerHTML = "Deze kleur is beschikbaar, klik om te kiezen!";
			document.getElementById(`player${colorNum}`).style.cursor = "pointer";
		}
		if (playerName == clientName) selected = true;
	});
});

function lobby_ChooseColor(colorNum) {
	if (selected) {
		alert("Je hebt al een kleur gekozen.")
		return
	}
	const playerName = urlParams.get("playername");
	socket.emit("cs-lobby-color-choice", {playerName: playerName, color: colorNum, lobbyCode: lobbyCode});
}

function lobby_StartGame() {
	if (confirm("Wil je het spel starten?")) {
		const clientName = urlParams.get("playername");
		socket.emit("cs-lobby-start", {playerName: clientName, lobbyCode: lobbyCode});
	}
}

function lobby_OpenSettings() {
	const dialog = document.querySelector("#settings-dialog");
	dialog.showModal();
}

function lobby_CancelSettings() {
	const dialog = document.querySelector("#settings-dialog");
	dialog.close();
}

function lobby_SaveSettings() {
	const dialog = document.querySelector("#settings-dialog");
	dialog.close();
}
//#endregion lobby

//#region in-game

let roundData = {}

socket.on("sc-game-init", data => {
	const {lobbyCode} = data;
	const clientName = urlParams.get("playername");
	window.location = `/game.html?code=${lobbyCode}&b=${brightnessSliderValue}&playername=${clientName}`;
});
if (page == "/game.html") {
	lobbyCode = urlParams.get("code");
	const clientName = urlParams.get("playername");
	socket.emit("cs-game-ready", {playerName: clientName, lobbyCode: lobbyCode});
}

function game_Dudo() {
	const lobbyCode = urlParams.get("code");
	const clientName = urlParams.get("playername");
	socket.emit("cs-game-dudo", {lobbyCode: lobbyCode, playerName: clientName, lastTurn: roundData.lastTurn});
}

function game_Calza() {
	const lobbyCode = urlParams.get("code");
	const clientName = urlParams.get("playername");
	socket.emit("cs-game-calza", {lobbyCode: lobbyCode, playerName: clientName, lastTurn: roundData.lastTurn});
}

function game_Bid() {
	const lobbyCode = urlParams.get("code");
	const clientName = urlParams.get("playername");
	const chosenBidAmount = parseInt(document.getElementById("bid-amount-input").value);
	if (chosenBidAmount > 40) {
		alert("Je kan niet meer dan 40 dobbelstenen bieden, want er kunnen maximaal 40 dobbelstenen in het spel zitten.");
		return;
	} else if (chosenBidAmount > 10) {
		if (!confirm(`Weet je zeker dat je ${chosenBidAmount} dobbelstenen wilt bieden?`)) return;
	}
	if ( // restructure this (1*)
		(
			(chosenDiceType > roundData.lastTurn.type && chosenBidAmount >= roundData.lastTurn.amount) // verhoog soort dobbelstenen
			|| (chosenDiceType >= roundData.lastTurn.type && chosenBidAmount > roundData.lastTurn.amount && roundData.lastTurn.type != 12) // verhoog aantal dobbelstenen
			|| (chosenBidAmount > roundData.lastTurn.amount * 2 && roundData.lastTurn.type == 12 && chosenDiceType != 12) // switch van pelikanen en verhoog
			|| (chosenBidAmount > Math.floor(roundData.lastTurn.amount / 2) && roundData.lastTurn.type != 12 && chosenDiceType == 12) // switch naar pelikanen en verhoog
			|| (chosenDiceType == 12 && roundData.lastTurn.type == 12 && chosenBidAmount > roundData.lastTurn.amount)
		)
		&& (chosenBidAmount > 0 && chosenDiceType > 0)
	) {
		// valid
		if (roundData.lastTurn.playerName && roundData.pacifico && chosenDiceType != roundData.lastTurn.type && roundData.clientDice && roundData.clientDice.length != 1) {
			alert("Jouw bod is ongeldig. Omdat dit een pacifico-ronde (armoederonde) is, moet je dezelfde dobbelsteen kiezen als de vorige persoon, tenzij je maar één dobbelsteen in bezit hebt.");
			return;
		} else {
			console.log(roundData.lastTurn.playerName)
			console.log(roundData.pacifico)
			console.log(chosenDiceType != roundData.lastTurn.type)
			console.log(roundData.clientDice)
		}
		socket.emit("cs-game-bid", {lobbyCode: lobbyCode, playerName: clientName, bid: {amount: chosenBidAmount, type: chosenDiceType}});
	} else {
		alert("Jouw bod is ongeldig. Probeer het opnieuw met een ander bod.");
		return;
	}
}

socket.on("sc-new-turn", data => {
	const {lobbyCode, playersTurn, lastTurn, pacifico, dice} = data;
	document.getElementById("players-dice-container").innerHTML = "";
	roundData.lastTurn = lastTurn;
	roundData.pacifico = pacifico;
	if (pacifico) {
		document.querySelectorAll(".pacifico-label").forEach(el => el.innerHTML = " (Let op: dit is een pacifico-ronde)");
	} else {
		document.querySelectorAll(".pacifico-label").forEach(el => el.innerHTML = "");
	}
	const clientName = urlParams.get("playername");
	let clientDice;
	if (dice) {
		if (clientName in dice) {
			clientDice = dice[clientName];
			roundData.clientDice = dice[clientName];
		} else {
			for (let i = 0; i < maxDice; i++) {
				document.getElementById(`rolled-dice${i+1}-yt`).style.display = "none";
				document.getElementById(`rolled-dice${i+1}-ot`).style.display = "none";
			}
			document.getElementById("your-dice-text").innerHTML = "Je hebt geen dobbelstenen meer, je ligt uit het spel"
		}
	}
	console.log(roundData.clientDice);
	chosenDiceType = 0;
	document.querySelector(".main").classList.remove(...allColors);
	document.querySelector(".main").classList.add(`clr${playersTurn.playerNum}`);
	// document.querySelector(".main").style.backgroundColor = `var(--clr-${playersTurn.playerNum}) !important`;
	if (clientDice) {
		for (let i = 0; i < maxDice; i++) {
			const die = document.getElementById(`rolled-dice${i+1}-yt`);
			const die2 = document.getElementById(`rolled-dice${i+1}-ot`);
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
		document.querySelectorAll(".last-turn").forEach(el => {el.style.display = "none"});
		roundData.lastTurn = {type: 0, amount: 0, playerName: null}
	} else {
		document.querySelectorAll(".last-turn").forEach(el => {el.style.display = "inline"});
		document.querySelectorAll("[last-player-name]").forEach(el => el.innerHTML = lastTurn.playerName);
		document.querySelectorAll("[last-player-bid-amount]").forEach(el => el.innerHTML = lastTurn.amount);
		document.querySelectorAll("[last-player-bid-type]").forEach(el => el.src = `icons/dice/${lastTurn.type}.png`);
	}
	if (playersTurn.playerName == clientName) {
		// Your turn
		for (const x of [2, 3, 4, 5, 6, 12]) {
			document.getElementById(`dice${x}`).classList.add("unchosen");
		}
		document.getElementById("bid-amount-input").value = "";
		showGamePage("your-turn")
		if (lastTurn && lastTurn.playerName) game_Select(lastTurn.type);
		document.getElementById("bid").innerHTML = lastTurn ? "Verhogen" : "Bieden";
		document.getElementById("game-buttons-container").style.display = lastTurn ? "flex" : "none";
	} else {
		// Others turn
		showGamePage("others-turn")
		document.querySelector("[current-player]").innerHTML = playersTurn.playerName;
	}
});

socket.on("sc-round-end", data => {
	const {inflicter, inflicted, dice, nameColors, ownerName, lastTurn, guessedDiceAmount, winner, loser} = data;
	const clientName = urlParams.get("playername");
	showGamePage("reveal-round");
	document.getElementById("next-round-button").style.display = "none";
	document.querySelector(".main").classList.remove(...allColors);
	document.getElementById("inflicter-action").innerHTML = `${inflicter} betwijfelt de gok van ${inflicted}`;
	document.getElementById("guess-amount").innerHTML = lastTurn.amount;
	document.getElementById("guess-type").src = `icons/dice/${lastTurn.type}.png`;
	if (winner && dice[winner].length != maxDice) {
		document.getElementById("winner-loser-action").innerHTML = 
			`${winner} krijgt een dobbelsteen erbij, want er is exact ${guessedDiceAmount} keer een <img src="icons/dice/${lastTurn.type}.png" class="dice small-dice"> in het spel`;
	} else if (winner) {
		document.getElementById("winner-loser-action").innerHTML = 
			`${winner} krijgt niks, want er is exact ${guessedDiceAmount} keer een <img src="icons/dice/${lastTurn.type}.png" class="dice small-dice"> in het spel, maar ${winner} heeft al ${maxDice} dobbelstenen`;
	} else {
		document.getElementById("winner-loser-action").innerHTML = 
			`${loser} moet een dobbelsteen inleveren, want er is ${guessedDiceAmount} keer een <img src="icons/dice/${lastTurn.type}.png" class="dice small-dice"> in het spel`;
	}
	const container = document.getElementById("players-dice-container");
	for (const name in dice) {
		const diceList = dice[name];
		const card = document.createElement("div");
		card.classList.add("player-card", "standard-shadow");
		card.style.backgroundColor = `var(--clr-${nameColors[name]});`;
		const cardName = document.createElement("p");
		cardName.classList.add("player-name", "standard-shadow");
		cardName.innerHTML = name;
		const cardDice = document.createElement("div");
		cardDice.classList.add("card-dice");
		let i = 0;
		for (const die of diceList) {
			const cardDie = document.createElement("img");
			cardDie.src = `icons/dice/${die}.png`;
			cardDie.classList.add("dice", "reveal-dice");
			cardDie.id = `die${name}${i}`
			cardDice.appendChild(cardDie);
			i++;
		}
		if (winner && name == winner && dice[winner].length != maxDice) {
			const cardDie = document.createElement("img");
			cardDie.src = `icons/dice/X.png`;
			cardDie.classList.add("dice", "reveal-dice", "dissolve");
			cardDie.id = `die${name}${i}`
			cardDice.appendChild(cardDie);
			i++;
		}
		card.appendChild(cardName);
		card.appendChild(cardDice);
		container.append(card);
		if (loser && name == loser) {
			(async () => {
				await setTimeout(async () => {
					document.getElementById(`die${name}${i-1}`).classList.add("dissolve");
				}, 2000);
			})();
		} else if (winner &&name == winner && dice[winner].length != maxDice) {
			(async () => {
				await setTimeout(async () => {
					document.getElementById(`die${name}${i-1}`).classList.remove("dissolve");
				}, 2000);
			})();
		}
	}
	if (clientName == ownerName) {
		(async () => {
			await setTimeout(async () => {
				document.getElementById("next-round-button").style.display = "inline";
			}, nextRoundDelay);
		})();
	}
});

function showGamePage(page) {
	switch (page) {
		case "your-turn":
			document.querySelectorAll("#others-turn, #reveal-round").forEach(el => {el.style.display = "none"});
			document.querySelector("#your-turn").style.display = "flex";
			break;

		case "others-turn":
			document.querySelectorAll("#your-turn, #reveal-round").forEach(el => {el.style.display = "none"});
			document.querySelector("#others-turn").style.display = "flex";
			break;

		case "reveal-round":
			document.querySelectorAll("#your-turn, #others-turn").forEach(el => {el.style.display = "none"});
			document.querySelector("#reveal-round").style.display = "flex";
			break;

		default:
			break;
	}
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
		const clientName = urlParams.get("playername");
		const lobbyCode = urlParams.get("code");
		socket.emit("cs-next-round", {playerName: clientName, lobbyCode: lobbyCode});
	}
}

//#endregion in-game

//#region end screen
socket.on("sc-game-end", data => {
	const {lobbyCode, winner, winnerDice} = data;
	(async () => {
		await setTimeout(async () => {
			window.location = `/winner.html?code=${lobbyCode}&b=${brightnessSliderValue}&winnerName=${winner.playerName}&color=${winner.playerNum}&winnerDice=${winnerDice}`;
		}, nextRoundDelay);
	})();
	
})

if (page == "/winner.html") {
	const winnerName = urlParams.get("winnerName");
	const backgroundColor = urlParams.get("color");
	const winnerDice = urlParams.get("winnerDice");
	document.querySelector(".main").classList.remove(...allColors);
	document.querySelector(".main").classList.add(`clr${backgroundColor}`);
	document.getElementById("winner-name").innerHTML = winnerName;
	document.getElementById("winner-dice").innerHTML = winnerDice;
}
//#endregion end screen

//#region general functions
function randomChoice(arr) {
	return arr[Math.floor(Math.random()*arr.length)];
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
  };
//#endregion general functions