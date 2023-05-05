const socket = io();

/** TODO:
 * Page verification on every socket.on
 * fix pacifico gamerules (no type change except for brokeboys)
 * add pacifico "notification" on game screen
 * add preselection on amount of dice in bid phase & a +1 button
 * warning when bidding high amount of dice
 * fix "seats" stuff
 * switch from document.getElementById to document.querySelector
 * Rulebook (html/css)
 */
const maxDice = 5;
const allColors = ["clr1","clr2","clr3","clr4","clr5","clr6", "clr7", "clr8"]

const urlParams = new URLSearchParams(window.location.search);
const page = window.location.pathname

//#region home functions
function home_JoinWithCode() {
	const code = document.getElementById("join-code-input").value.toUpperCase();
	const playerName = document.getElementById("player-name-input").value;
	if (playerName == "") {
		alert("Je moet een naam invullen.");
	} else {
		window.location = `/lobby.html?code=${code}&b=${brightnessSliderValue}&playername=${playerName}`;
	}
}

function home_CreateLobby() {
	const playerName = document.getElementById("player-name-input").value;
	if (playerName == "") {
		alert("Je moet een naam invullen.");
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
		alphanum = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
		lobbyCode = randomChoice(alphanum) + randomChoice(alphanum) + randomChoice(alphanum) + randomChoice(alphanum);
		socket.emit("cs-lobby-create", {lobbyCode: lobbyCode, playerName: clientName});
	} else {
		document.getElementById("start-game-button").style.display = "none";
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
			document.getElementById(`player${colorNum}-name`).innerHTML = "Beschikbaar, klik om te kiezen!";
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
//#endregion lobby

//#region in-game
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

let lastTurnGlobal;

function game_Dudo() {
	const lobbyCode = urlParams.get("code");
	const clientName = urlParams.get("playername");
	socket.emit("cs-game-dudo", {lobbyCode: lobbyCode, playerName: clientName, lastTurn: lastTurnGlobal});
}

function game_Calza() {
	const lobbyCode = urlParams.get("code");
	const clientName = urlParams.get("playername");
	socket.emit("cs-game-calza", {lobbyCode: lobbyCode, playerName: clientName, lastTurn: lastTurnGlobal});
}

let lastDiceType = 0;
let lastBidAmount = 0;
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
	if (
		(
			(chosenDiceType > lastDiceType && chosenBidAmount >= lastBidAmount) // verhoog soort dobbelstenen
			|| (chosenDiceType >= lastDiceType && chosenBidAmount > lastBidAmount && lastDiceType != 12) // verhoog aantal dobbelstenen
			|| (chosenBidAmount > lastBidAmount * 2 && lastDiceType == 12 && chosenDiceType != 12) // switch van pelikanen en verhoog
			|| (chosenBidAmount > Math.floor(lastBidAmount / 2) && lastDiceType != 12 && chosenDiceType == 12) // switch naar pelikanen en verhoog
			|| (chosenDiceType == 12 && lastDiceType == 12 && chosenBidAmount > lastBidAmount)
		)
		&& (chosenBidAmount > 0 && chosenDiceType > 0)
	) {
		// valid
		socket.emit("cs-game-bid", {lobbyCode: lobbyCode, playerName: clientName, bid: {amount: chosenBidAmount, type: chosenDiceType}});
	} else {
		alert("Jouw bod is ongeldig. Probeer het opnieuw met een ander bod.");
	}
}

socket.on("sc-new-turn", data => {
	const {lobbyCode, playersTurn, lastTurn, pacifico, dice} = data;
	document.getElementById("players-dice-container").innerHTML = "";
	lastTurnGlobal = lastTurn;
	const clientName = urlParams.get("playername");
	let clientDice;
	if (dice) {
		if (clientName in dice) {
			clientDice = dice[clientName];
		} else {
			for (let i = 0; i < maxDice; i++) {
				document.getElementById(`rolled-dice${i+1}-yt`).style.display = "none";
				document.getElementById(`rolled-dice${i+1}-ot`).style.display = "none";
			}
			document.getElementById("your-dice-text").innerHTML = "Je hebt geen dobbelstenen meer, je ligt uit het spel"
		}
	}
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
		lastDiceType = 0;
		lastBidAmount = 0;
	} else {
		document.querySelectorAll(".last-turn").forEach(el => {el.style.display = "inline"});
		lastDiceType = lastTurn.type;
		lastBidAmount = lastTurn.amount;
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
		if (lastTurn) game_Select(lastTurn.type);
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
			}, 10000);
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
		}, 10000);
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
//#endregion general functions