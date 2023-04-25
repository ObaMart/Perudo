const socket = io();
socket.emit("cs-test", "Connection received from client!")
socket.on("sc-test", (message) => {
    console.log(message)
});

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
	console.log(Object.entries(data));
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
if (page == "game.html") {
	lobbyCode = urlParams.get("code")
	const clientName = urlParams.get("playername")
	socket.emit("cs-game-ready", {playerName: clientName, lobbyCode: lobbyCode});
}
// Test if clients are still in socket.io room after game starts (switch html pages)

function game_Dudo() {

}

function game_Calza() {

}

function game_Bid() {
	const lastDiceType = 0;
	const lastBidAmount = 0;
	const chosenBidAmount = document.getElementById("bid-amount-input").value;
	if (
		(chosenDiceType > lastDiceType && chosenBidAmount >= lastBidAmount) // verhoog soort dobbelstenen
		|| (chosenDiceType >= lastDiceType && chosenBidAmount > lastBidAmount && lastDiceType != 12) // verhoog aantal dobbelstenen
		|| (chosenBidAmount > lastBidAmount * 2 && lastDiceType == 12 && chosenDiceType != 12) // switch van pelikanen en verhoog
		|| (chosenBidAmount > Math.floor(lastBidAmount / 2) && lastDiceType != 12 && chosenDiceType == 12) // switch naar pelikanen en verhoog
		|| (chosenDiceType == 12 && lastDiceType == 12 && chosenBidAmount > lastBidAmount)
	) {
		// passed
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

//#endregion in-game

//#region general functions
function randomChoice(arr) {
	return arr[Math.floor(Math.random()*arr.length)];
}
//#endregion general functions