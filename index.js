"use strict"
const fs = require('fs');
const http = require('http');
const express = require('express');
const { start } = require('repl');
const app = express();
const server = http.Server(app);
const io = require('socket.io')(server);
// const server = http.Server(app);
const PORT = 3000;
let games = {};
const minPlayers = 1;
const maxPlayers = 6;
// todo
// Remove stupid functions (cs-test, cs-log, etc.)
// game (entirely lol)

fs.readFile("client/index.html", function(err, html) {
	if (err) throw err;

	app.use("/", express.static(__dirname + "/client"))

	io.on("connection", (socket) => {
		console.log(`Connected to socket [${socket.id}]`)
		socket.on("cs-test", message => {
			console.log(message);
		});
		socket.on("cs-log", message => {
			console.log(message);
			socket.broadcast.emit("sc-test", message);
		});
		socket.emit("sc-test", "Connection received from socket!");

		//#region home
		socket.on("cs-disconnect", data => {
			const {lobbyCode, playerName} = data;
			if (!(lobbyCode in games)) return;
			if (playerName == games[lobbyCode].lobbyOwner) {
				io.sockets.in(lobbyCode).emit("sc-error-fatal", {lobbyCode: lobbyCode, errorMessage: `Het spel is afgelopen omdat lobby-eigenaar ${playerName} het spel heeft verlaten.`});
				delete games[lobbyCode];
				return;
			}
			games[lobbyCode].joinedPlayers.splice(games[lobbyCode].joinedPlayers.indexOf(playerName), 1);
			for (let i = 1; i <= maxPlayers; i++) {
				if (games[lobbyCode].seats[i] == playerName) {
					games[lobbyCode].seats[i] = null;
					break;
				}
			}
			io.sockets.in(lobbyCode).emit("sc-lobby-player-update", games[lobbyCode].seats);
			// console.log(games[lobbyCode])
		})
		//#endregion home

		//#region lobby
		socket.on("cs-lobby-create", data => {
			const {lobbyCode, playerName} = data;
			games[lobbyCode] = {seats: {1: null, 2: null, 3: null, 4: null, 5: null, 6: null}, joinedPlayers: [playerName], lobbyOwner: playerName}
			socket.join(lobbyCode);
		});
		socket.on("cs-lobby-color-choice", data => {
			const {playerName, color, lobbyCode} = data;
			if (!games[lobbyCode].seats[color]) games[lobbyCode].seats[color] = playerName;
			// console.log(games[lobbyCode].seats);
			io.sockets.in(lobbyCode).emit("sc-lobby-player-update", games[lobbyCode].seats);
		});
		socket.on("cs-lobby-join", data => {
			const {lobbyCode, playerName} = data;
			// console.log(games[lobbyCode].joinedPlayers)
			if (!(lobbyCode in games)) {
				socket.emit("sc-error-fatal", {playerName: playerName, errorMessage: `Deze lobbycode (${lobbyCode}) is ongeldig. Probeer het opnieuw.`});
			} else if (games[lobbyCode].joinedPlayers.includes(playerName)) {
				socket.emit("sc-error-fatal", {playerName: playerName, errorMessage: `Deze naam (${playerName}) is al gekozen. Kies een unieke naam en join opnieuw.`});
			} else if (games[lobbyCode].joinedPlayers.length == maxPlayers) {
				socket.emit("sc-error-fatal", {playerName: playerName, errorMessage: `Deze lobby (${lobbyCode}) zit vol. (${maxPlayers} spelers)`});
			} else {
				games[lobbyCode].joinedPlayers.push(playerName);
				socket.join(lobbyCode);
				io.sockets.in(lobbyCode).emit("sc-lobby-player-update", games[lobbyCode].seats);
			}
		});
		socket.on("cs-lobby-start", data => {
			const {playerName, lobbyCode} = data;
			if (playerName == games[lobbyCode].lobbyOwner) {
				let amtChosen = 0;
				for (const playerNum in games[lobbyCode].seats) {
					if (games[lobbyCode].seats[playerNum]) amtChosen++;
				}
				if (games[lobbyCode].joinedPlayers.length < minPlayers) {
					soscket.emit("sc-error", {lobbyCode: lobbyCode, errorMessage: "Het spel kan niet gestart worden, want het minimum aantal deelnemers is nog niet bereikt."})
				} else if (amtChosen != games[lobbyCode].joinedPlayers.length) {
					socket.emit("sc-error", {lobbyCode: lobbyCode, errorMessage: "Het spel kan niet gestart worden, want nog niet iedereen heeft een kleur gekozen."});
					// console.log(amtChosen);
					// console.log(games[lobbyCode].joinedPlayers)
				} else {
					io.sockets.in(lobbyCode).emit("sc-game-init", {lobbyCode: lobbyCode});
					games[lobbyCode].alivePlayers = [];
				}
			}
		});
		//#endregion lobby

		//#region game
		socket.on("cs-game-ready", data => {
			const {playerName, lobbyCode} = data;
			if (!(lobbyCode in games)) return;
			socket.join(lobbyCode);
			games[lobbyCode].alivePlayers.push(playerName);
			// console.log(games[lobbyCode].alivePlayers);
			if (games[lobbyCode].alivePlayers.length == games[lobbyCode].joinedPlayers.length) {
				io.sockets.in(lobbyCode).emit("sc-game-start", {lobbyCode: lobbyCode});
				loopGame(lobbyCode);
			}
		});
		
		socket.on("cs-game-bid", data => {
			const {lobbyCode, playerName, bid} = data;
			const game = games[lobbyCode]
			if (!(playerName == game.playersTurn.playerName)) return;
		})
		//#endregion game
	});

	server.listen(PORT);
	console.log('Server started.');
});

function loopGame(lobbyCode) {
	console.log(`Looping game ${lobbyCode} in 5 seconds...`)
	setTimeout(() => {
		console.log(`looping game ${lobbyCode}!`);
		const game = games[lobbyCode];
		game.participants = {};
		for (const playerNum in game.seats) {
			if (game.seats[playerNum]) game.participants[playerNum] = {playerName: game.seats[playerNum], dice: 5};
		}
		delete game.seats;
		const startingPlayer = randomChoice(Object.keys(game.participants));
		game.playersTurn = {playerNum: startingPlayer, playerName: game.participants[startingPlayer].playerName}
		newRound(lobbyCode, game.playersTurn, false);
	}, 5);
}

function newRound(lobbyCode, startingPlayer, pacifico) {
	// const game = games[lobbyCode] 
	io.sockets.in(lobbyCode).emit("sc-new-turn", {lobbyCode: lobbyCode, playersTurn: startingPlayer, pacifico: pacifico, lastTurn: null});
}

// function newTurn(lobbyCode, playersTurn, lastTurn) {
// }

//#region general functions
function randomChoice(arr) {
	return arr[Math.floor(Math.random()*arr.length)];
}
//#endregion general functions