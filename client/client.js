const socket = io();
socket.emit("cs-test", "Connection received from client!")
socket.on("sc-test", (message) => {
    console.log(message)
});

const amountDice = 5;

const urlParams = new URLSearchParams(window.location.search);
const page = window.location.pathname

function send() {
    const message = document.getElementById("inp-test").value;
    socket.emit("cs-log", message);
}

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
	// console.log(data)
	// console.log(Object.entries(data));
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
	// console.log({playerName: playerName, color: colorNum, lobbyCode: lobbyCode})
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
// Test if clients are still in socket.io room after game starts (switch html pages)


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
		console.log(`Chosen dice type: ${chosenDiceType}, chosen bid amount: ${chosenBidAmount}`);
		console.log(`Last dice type: ${lastDiceType}, last bid amount: ${lastBidAmount}`);
		console.log(chosenDiceType >= lastDiceType)
		console.log(chosenBidAmount > lastBidAmount)
		console.log(lastDiceType != 12);
		console.log(chosenDiceType >= lastDiceType && chosenBidAmount > lastBidAmount && lastDiceType != 12)
	}
}

socket.on("sc-new-turn", data => {
	const {lobbyCode, playersTurn, lastTurn, pacifico, dice} = data;
	document.getElementById("players-dice-container").innerHTML = "";
	console.log(`Pacifico: ${pacifico}`);
	lastTurnGlobal = lastTurn;
	const clientName = urlParams.get("playername");
	let clientDice;
	if (dice) {
		if (clientName in dice) {
			clientDice = dice[clientName];
		} else {
			for (let i = 0; i < 5; i++) {
				document.getElementById(`rolled-dice${i+1}-yt`).style.display = "none";
				document.getElementById(`rolled-dice${i+1}-ot`).style.display = "none";
			}
			document.getElementById("your-dice-text").innerHTML = "Je hebt geen dobbelstenen meer, je ligt uit het spel"
		}
	}
	chosenDiceType = 0;
	document.getElementById("main").classList.remove("clr1","clr2","clr3","clr4","clr5","clr6");
	document.getElementById("main").classList.add(`clr${playersTurn.playerNum}`);
	// document.getElementById("main").style.backgroundColor = `var(--clr-${playersTurn.playerNum}) !important`;
	if (clientDice) {
		for (let i = 0; i < 5; i++) {
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
	if (playersTurn.playerName == clientName) {
		// Your turn
		for (const x of [2, 3, 4, 5, 6, 12]) {
			document.getElementById(`dice${x}`).classList.add("unchosen");
		}
		document.getElementById("bid-amount-input").value = "";
		document.getElementById("your-turn").style.display = "flex";
		document.getElementById("others-turn").style.display = "none";
		document.getElementById("reveal-round").style.display = "none";
		if (!lastTurn) {
			document.getElementById("bid").innerHTML = "Bieden";
			document.getElementById("game-buttons-container").style.display = "none";
			document.getElementById("last-turn-yt").style.display = "none";
			lastDiceType = 0;
			lastBidAmount = 0;
		} else {
			document.getElementById("bid").innerHTML = "Verhogen";
			document.getElementById("game-buttons-container").style.display = "flex";
			document.getElementById("last-turn-yt").style.display = "inline"; // CHECK THIS
			lastDiceType = lastTurn.type;
			lastBidAmount = lastTurn.amount;
			document.getElementById("last-player-yt").innerHTML = lastTurn.playerName;
			document.getElementById("last-player-bid-amount-yt").innerHTML = lastTurn.amount;
			document.getElementById("last-player-bid-type-yt").src = `icons/dice/${lastTurn.type}.png`;
		}
	} else {
		// Others turn
		document.getElementById("your-turn").style.display = "none";
		document.getElementById("others-turn").style.display = "flex";
		document.getElementById("reveal-round").style.display = "none";
		if (!lastTurn) {
			document.getElementById("last-turn-ot").style.display = "none";
		} else {
			document.getElementById("last-player-ot").innerHTML = lastTurn.playerName;
			document.getElementById("last-player-bid-amount-ot").innerHTML = lastTurn.amount;
			document.getElementById("last-player-bid-type-ot").src = `icons/dice/${lastTurn.type}.png`;
		}
		document.getElementById("current-player-ot").innerHTML = playersTurn.playerName;
	}
});

socket.on("sc-dudo-round-end", data => {
	document.getElementById("next-round-button").style.display = "none";
	const {inflicter, inflicted, loser, dice, nameColors, ownerName, lastTurn, guessedDiceAmount} = data;
	const clientName = urlParams.get("playername");
	document.getElementById("main").classList.remove("clr1","clr2","clr3","clr4","clr5","clr6");
	document.getElementById("inflicter-action").innerHTML = `${inflicter} neemt de gok van ${inflicted} in twijfel`;
	document.getElementById("guess-amount").innerHTML = lastTurn.amount;
	document.getElementById("guess-type").src = `icons/dice/${lastTurn.type}.png`;
	document.getElementById("winner-loser-action").innerHTML = 
		`${loser} moet een dobbelsteen inleveren, want er is ${guessedDiceAmount} keer een <img src="icons/dice/${lastTurn.type}.png" class="dice small-dice"> in het spel`;
	document.getElementById("your-turn").style.display = "none";
	document.getElementById("others-turn").style.display = "none";
	document.getElementById("reveal-round").style.display = "flex";
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
		cardDice.classList.add("card-dice")
		let i = 0;
		for (const die of diceList) {
			const cardDie = document.createElement("img");
			cardDie.src = `icons/dice/${die}.png`;
			cardDie.classList.add("dice", "reveal-dice");
			cardDie.id = `die${name}${i}`
			cardDice.appendChild(cardDie);
			i++;
		}
		card.appendChild(cardName);
		card.appendChild(cardDice);
		container.append(card);
		if (name == loser) {
			(async () => {
				await setTimeout(async () => {
					document.getElementById(`die${name}${i-1}`).classList.add("dissolve");
				}, 2000)
			})();
		}
	}
	if (clientName == ownerName) {
		(async () => {
			await setTimeout(async () => {
				document.getElementById("next-round-button").style.display = "inline";
			}, 10000)
		})();
	}
});

socket.on("sc-calza-round-end", data => {
	document.getElementById("next-round-button").style.display = "none";
	const {inflicter, inflicted, winner, loser, dice, nameColors, ownerName, lastTurn, guessedDiceAmount} = data;
	const clientName = urlParams.get("playername");
	document.getElementById("main").classList.remove("clr1","clr2","clr3","clr4","clr5","clr6");
	document.getElementById("inflicter-action").innerHTML = `${inflicter} denkt dat de gok van ${inflicted} exact klopt`;
	document.getElementById("guess-amount").innerHTML = lastTurn.amount;
	document.getElementById("guess-type").src = `icons/dice/${lastTurn.type}.png`;
	if (winner && dice[winner].length != amountDice) {
		document.getElementById("winner-loser-action").innerHTML = 
			`${winner} krijgt een dobbelsteen erbij, want er is exact ${guessedDiceAmount} keer een <img src="icons/dice/${lastTurn.type}.png" class="dice small-dice"> in het spel`;
	} else if (winner) {
		document.getElementById("winner-loser-action").innerHTML = 
			`${winner} krijgt niks, want er is exact ${guessedDiceAmount} keer een <img src="icons/dice/${lastTurn.type}.png" class="dice small-dice"> in het spel, maar ${winner} heeft al ${amountDice} dobbelstenen`;
	} else {
		document.getElementById("winner-loser-action").innerHTML = 
			`${loser} moet een dobbelsteen inleveren, want er is ${guessedDiceAmount} keer een <img src="icons/dice/${lastTurn.type}.png" class="dice small-dice"> in het spel`;
	}
	document.getElementById("your-turn").style.display = "none";
	document.getElementById("others-turn").style.display = "none";
	document.getElementById("reveal-round").style.display = "flex";
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
		cardDice.classList.add("card-dice")
		let i = 0;
		for (const die of diceList) {
			const cardDie = document.createElement("img");
			cardDie.src = `icons/dice/${die}.png`;
			cardDie.classList.add("dice", "reveal-dice");
			cardDie.id = `die${name}${i}`
			cardDice.appendChild(cardDie);
			i++;
		}
		if (name == winner && dice[winner].length != amountDice) {
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
		if (name == loser) {
			(async () => {
				await setTimeout(async () => {
					document.getElementById(`die${name}${i-1}`).classList.add("dissolve");
				}, 2000);
			})();
		} else if (name == winner && dice[winner].length != amountDice) {
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
			}, 5000);
		})();
	}
});

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
		// console.log("Requested next round");
	}
}

//#endregion in-game

//#region general functions
function randomChoice(arr) {
	return arr[Math.floor(Math.random()*arr.length)];
}
//#endregion general functions