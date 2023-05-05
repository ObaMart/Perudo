"use strict"
const fs = require('fs');
const http = require('http');
const express = require('express');
const app = express();
const server = http.Server(app);
const io = require('socket.io')(server);
// const server = http.Server(app);
const PORT = 3000;
let games = {};
const minPlayers = 2;
const maxPlayers = 8;
const maxDice = 5;
/** TODO:
 * Rulesets (pacifico rules, amount of dice, etc.)
 * add log function + useful logs
 * name verification
 * bid verification (check if person is allowed to bid + if bid is valid)
 * general socket.on verification (check if person has permission)
 */

fs.readFile("client/index.html", function(err, html) {
	if (err) throw err;

	app.use("/", express.static(__dirname + "/client"))

	io.on("connection", (socket) => {
		socket.emit("sc-test", "Connected to server");

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
				if (games[lobbyCode].seats && games[lobbyCode].seats[i] == playerName) {
					games[lobbyCode].seats[i] = null;
					break;
				} else if (games[lobbyCode].participants[i].playerName == playerName) {
					delete games[lobbyCode].participants[i];
					delete games[lobbyCode].dice[playerName];
				}
			}
			if (games[lobbyCode].seats) io.sockets.in(lobbyCode).emit("sc-lobby-player-update", games[lobbyCode].seats);
		})
		//#endregion home

		//#region lobby
		socket.on("cs-lobby-create", data => {
			const {lobbyCode, playerName} = data;
			if (lobbyCode in games) {
				socket.emit("sc-error-fatal", {lobbyCode: lobbyCode});
				return;
			}
			games[lobbyCode] = {seats: {1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null}, joinedPlayers: [playerName], lobbyOwner: playerName}
			socket.join(lobbyCode);
		});
		socket.on("cs-lobby-color-choice", data => {
			const {playerName, color, lobbyCode} = data;
			if (!games[lobbyCode].seats[color]) games[lobbyCode].seats[color] = playerName;
			io.sockets.in(lobbyCode).emit("sc-lobby-player-update", games[lobbyCode].seats);
		});
		socket.on("cs-lobby-join", data => {
			const {lobbyCode, playerName} = data;
			if (!(lobbyCode in games)) {
				socket.emit("sc-error-fatal", {playerName: playerName, errorMessage: `Deze lobbycode (${lobbyCode}) is ongeldig. Probeer het opnieuw.`});
				return;
			} else if (games[lobbyCode].joinedPlayers.includes(playerName)) {
				socket.emit("sc-error-fatal", {playerName: playerName, errorMessage: `Deze naam (${playerName}) is al gekozen. Kies een unieke naam en join opnieuw.`});
				return;
			} else if (games[lobbyCode].joinedPlayers.length == maxPlayers) {
				socket.emit("sc-error-fatal", {playerName: playerName, errorMessage: `Deze lobby (${lobbyCode}) zit vol. (${maxPlayers} spelers)`});
				return;
			}
			games[lobbyCode].joinedPlayers.push(playerName);
			socket.join(lobbyCode);
			io.sockets.in(lobbyCode).emit("sc-lobby-player-update", games[lobbyCode].seats);
		});
		socket.on("cs-lobby-start", data => {
			const {playerName, lobbyCode} = data;
			if (playerName == games[lobbyCode].lobbyOwner) {
				let amtChosen = 0;
				for (const playerNum in games[lobbyCode].seats) {
					if (games[lobbyCode].seats[playerNum]) amtChosen++;
				}
				if (games[lobbyCode].joinedPlayers.length < minPlayers) {
					socket.emit("sc-error", {lobbyCode: lobbyCode, errorMessage: "Het spel kan niet gestart worden, want het minimum aantal deelnemers is nog niet bereikt."})
				} else if (amtChosen != games[lobbyCode].joinedPlayers.length) {
					socket.emit("sc-error", {lobbyCode: lobbyCode, errorMessage: "Het spel kan niet gestart worden, want nog niet iedereen heeft een kleur gekozen."});
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
			if (games[lobbyCode].alivePlayers.length == games[lobbyCode].joinedPlayers.length) {
				io.sockets.in(lobbyCode).emit("sc-game-start", {lobbyCode: lobbyCode});
				loopGame(lobbyCode);
			}
		});
		
		socket.on("cs-game-bid", data => {
			const {lobbyCode, playerName, bid} = data;
			if (!(lobbyCode in games)) return;
			const game = games[lobbyCode];
			if (!(game.playersTurn.playerName == playerName)) return;
			const nextPlayersTurn = {playerNum: next(lobbyCode, game.playersTurn.playerNum), playerName: game.participants[next(lobbyCode, game.playersTurn.playerNum)].playerName}
			io.sockets.in(lobbyCode).emit("sc-new-turn", {
				lobbyCode: lobbyCode,
				playersTurn: nextPlayersTurn,
				lastTurn: {...bid, playerName: playerName},
				pacifico: game.pacifico
				// lastPlayerName: playerName,
			});
			game.playersTurn = nextPlayersTurn;
		});

		socket.on("cs-game-dudo", data => {
			const {lobbyCode, playerName, lastTurn} = data;
			const game = games[lobbyCode];
			let jokersCount = (game.pacifico || lastTurn.type == 12) ? 0 : game.diceCounts[12];
			// if (!jokersCount) jokersCount = 0;
			let loser = {};
			let guessedDiceAmount = game.diceCounts[lastTurn.type] + jokersCount;
			if (lastTurn.amount > (guessedDiceAmount)) { // guess was incorrect -> dudo was correct
				loser = {playerNum: game.nameColors[lastTurn.playerName], playerName: lastTurn.playerName}
			} else { // guess was correct -> dudo was incorrect
				loser = {playerNum: game.nameColors[playerName], playerName: playerName}
			}
			io.sockets.in(lobbyCode).emit("sc-round-end", {
				loser: loser.playerName,
				dice: game.dice,
				inflicter: playerName,
				inflicted: lastTurn.playerName,
				nameColors: game.nameColors,
				ownerName: game.lobbyOwner,
				lastTurn: lastTurn,
				guessedDiceAmount: guessedDiceAmount
			});
			game.participants[loser.playerNum].dice -= 1;
			game.playersTurn = {playerNum: loser.playerNum, playerName: loser.playerName}
			if (game.participants[loser.playerNum].dice == 0) {
				delete game.participants[loser.playerNum];
				delete game.dice[loser.playerName];
				const randomNewTurnNumber = randomChoice(Object.keys(game.participants))
				game.playersTurn = {playerNum: randomNewTurnNumber, playerName: game.participants[randomNewTurnNumber].playerName}
				game.pacifico = false;
			} else if (game.participants[loser.playerNum].dice == 1 && game.participants[loser.playerNum].beenPacifico == false) {
				game.participants[loser.playerNum].beenPacifico = true;
				game.pacifico = true;
			} else {
				game.pacifico = false;
			}
			if (Object.keys(game.participants).length == 1) {
				endGame(lobbyCode);
			}
		});

		socket.on("cs-game-calza", data => {
			const {lobbyCode, playerName, lastTurn} = data;
			const game = games[lobbyCode];
			let jokersCount = (game.pacifico || lastTurn.type == 12) ? 0 : game.diceCounts[12];
			// if (!jokersCount) jokersCount = 0;
			let guessedDiceAmount = game.diceCounts[lastTurn.type] + jokersCount;
			if (lastTurn.amount == (guessedDiceAmount)) { // calza is correct
				io.sockets.in(lobbyCode).emit("sc-round-end", {
					winner: playerName,
					dice: game.dice,
					inflicter: playerName,
					inflicted: lastTurn.playerName,
					nameColors: game.nameColors,
					ownerName: game.lobbyOwner,
					lastTurn: lastTurn,
					guessedDiceAmount: guessedDiceAmount,
				});
				const winner = {playerNum: game.nameColors[playerName], playerName: playerName}
				if (game.participants[winner.playerNum].dice != maxDice) game.participants[winner.playerNum].dice += 1;
				game.playersTurn = {playerNum: winner.playerNum, playerName: winner.playerName}
				game.pacifico = false;
			} else { // calza is incorrect
				io.sockets.in(lobbyCode).emit("sc-round-end", {
					loser: playerName,
					dice: game.dice,
					inflicter: playerName,
					inflicted: lastTurn.playerName,
					nameColors: game.nameColors,
					ownerName: game.lobbyOwner,
					lastTurn: lastTurn,
					guessedDiceAmount: guessedDiceAmount
				});
				const loser = {playerNum: game.nameColors[playerName], playerName: playerName}
				game.participants[loser.playerNum].dice -= 1;
				game.playersTurn = {playerNum: loser.playerNum, playerName: loser.playerName}
				if (game.participants[loser.playerNum].dice == 0) {
					delete game.participants[loser.playerNum];
					delete game.dice[loser.playerName];
					const randomNewTurnNumber = randomChoice(Object.keys(game.participants))
					game.playersTurn = {playerNum: randomNewTurnNumber, playerName: game.participants[randomNewTurnNumber]}
					game.pacifico = false;
				} else if (game.participants[loser.playerNum].dice == 1 && game.participants[loser.playerNum].beenPacifico == false) {
					game.participants[loser.playerNum].beenPacifico = true;
					game.pacifico = true;
				} else {
					game.pacifico = false;
				}
				if (Object.keys(game.participants).length == 1) {
					endGame(lobbyCode)
				}
			}
			
		});

		socket.on("cs-next-round", data => {
			const {playerName, lobbyCode} = data;
			if (playerName != games[lobbyCode].lobbyOwner) return;
			newRound(lobbyCode, games[lobbyCode].playersTurn, games[lobbyCode].pacifico)
		})
		//#endregion game
	});

	server.listen(PORT);
	console.log('Server started.');
});

function loopGame(lobbyCode) {
	console.log(`Looping game ${lobbyCode} in 1 second...`);
	setTimeout(() => {
		console.log(`looping game ${lobbyCode}!`);
		const game = games[lobbyCode];
		game.participants = {};
		game.nameColors = {};
		game.pacifico = false;
		for (const playerNum in game.seats) {
			if (game.seats[playerNum]) {
				game.participants[playerNum] = {playerName: game.seats[playerNum], dice: maxDice, beenPacifico: false};
				game.nameColors[game.seats[playerNum]] = playerNum;
			}
		}
		delete game.seats;
		const startingPlayer = randomChoice(Object.keys(game.participants));
		game.playersTurn = {playerNum: startingPlayer, playerName: game.participants[startingPlayer].playerName}
		newRound(lobbyCode, game.playersTurn, false);
	}, 1000);
}

function newRound(lobbyCode, startingPlayer, pacifico) {
	// const game = games[lobbyCode] 
	const dice = {}
	for (const playerNum in games[lobbyCode].participants) {
		dice[games[lobbyCode].participants[playerNum].playerName] = Array.from({length: games[lobbyCode].participants[playerNum].dice}, () => randomChoice([2, 3, 4, 5, 6, 12]))
	}
	const allDice = [].concat(...Object.values(dice))
	const diceCounts = {"2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "12": 0};

	for (const num of allDice) {
		diceCounts[num] += 1;
	}
	games[lobbyCode].diceCounts = diceCounts;
	games[lobbyCode].dice = dice;
	
	io.sockets.in(lobbyCode).emit("sc-new-turn", {
		lobbyCode: lobbyCode,
		playersTurn: startingPlayer,
		pacifico: pacifico,
		lastTurn: null,
		dice: dice,
		lastPlayerName: null
	});
}

function endGame(lobbyCode) {
	const game = games[lobbyCode];
	const winner = {playerNum: Object.keys(game.participants)[0], playerName: Object.values(game.participants)[0].playerName};
	console.log(`Game ends with winner ${winner.playerName}`)
	io.sockets.in(lobbyCode).emit("sc-game-end", {lobbyCode: lobbyCode, winner: winner, winnerDice: Object.values(game.participants)[0].dice})
	delete games[lobbyCode];
}

//#region general functions
function randomChoice(arr) {
	return arr[Math.floor(Math.random()*arr.length)];
}

function next(lobbyCode, previous) {
	if (!(lobbyCode in games)) return;
	let lastNum = 0;
	for (const playerNum in games[lobbyCode].participants) {
		if (lastNum == previous) {
			return playerNum;
		}
		lastNum = playerNum;
	}
	return Object.keys(games[lobbyCode].participants)[0];
}
//#endregion general functions