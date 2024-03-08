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
 * add log function + useful logs (done?)
 * name verification (done?)
 * general socket.on verification (check if person has permission) (done?)
 * t// auto-end when second-to-last person leaves (done?)
 */

fs.readFile("client/index.html", function(err, html) {
	if (err) throw err;

	app.use("/", express.static(__dirname + "/client"))

	io.on("connection", (socket) => {
		socket.emit("sc-test", "Connected to server");

		//#region home
		socket.on("cs-disconnect", ({lobbyCode, player}) => {
			if (!(lobbyCode in games)) return;
			const game = games[lobbyCode];
			
			if (game.seats) {
				game.joinedPlayers.splice(game.joinedPlayers.indexOf(player.playerName), 1);
				for (const i in game.seats) {
					if (game.seats[i] == player.playerName) {
						game.seats[i] = null;
						break;
					}
				}
				log(lobbyCode, 0, `Player ${player.playerName} left the lobby.`);
				if (game.seats) io.sockets.in(lobbyCode).emit("sc-lobby-player-update", game.seats);
				if (player.playerName == game.lobbyOwner.playerName) {
					game.lobbyOwner = {playerName: randomChoice(game.joinedPlayers), playerNum: null};
					io.sockets.in(lobbyCode).emit("sc-lobby-new-owner", game.lobbyOwner);
					log(lobbyCode, 2, `Player ${player.playerName} was the owner of the lobby, ownership has been transferred to ${game.lobbyOwner.playerName}`);
					return;
				}
			} else if (game.participants) {
				for (const [index, participant] of game.participants.entries()) {
					if (participant.player.playerName == player.playerName) {
						game.participants.splice(index, 1);
						try {delete game.dice[player.playerNum]} catch {console.error(`Did not get playerNum from ${player.playerName}`)}
						break;
					}
				}
				log(lobbyCode, 0, `Player ${player.playerName} left the game.`);
				if (game.participants.length == 1) {
					endGame(lobbyCode);
					return;
				}
				if (player.playerName == game.lobbyOwner.playerName) {
					game.lobbyOwner = randomChoice(game.participants).player;
					log(lobbyCode, 2, `Player ${player.playerName} was the owner of the lobby, ownership has been transferred to ${game.lobbyOwner.playerName}`);
					return;
				}
			}
		})
		//#endregion home

		//#region lobby
		socket.on("cs-lobby-create", ({lobbyCode, playerName}) => {
			if (lobbyCode in games) {
				socket.emit("sc-error-fatal", {});
				return;
			}
			games[lobbyCode] = {seats: {1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null}, joinedPlayers: [playerName], lobbyOwner: {playerNum: null, playerName: playerName}}
			socket.join(lobbyCode);
			log(lobbyCode, 0, "Created lobby!");
			io.sockets.in(lobbyCode).emit("sc-joined-players-no-color", [playerName]);
		});

		socket.on("cs-lobby-join", ({lobbyCode, playerName}) => {
			if (!(lobbyCode in games)) {
				socket.emit("sc-error-fatal", {errorMessage: `Deze lobbycode (${lobbyCode}) is ongeldig. Probeer het opnieuw.`});
				return;
			} else if (games[lobbyCode].joinedPlayers.includes(playerName)) {
				socket.emit("sc-error-fatal", {errorMessage: `Deze naam (${playerName}) is al gekozen. Kies een unieke naam en join opnieuw.`});
				return;
			} else if (games[lobbyCode].joinedPlayers.length == maxPlayers) {
				socket.emit("sc-error-fatal", {errorMessage: `Deze lobby (${lobbyCode}) zit vol. (${maxPlayers} spelers)`});
				return;
			}
			const game = games[lobbyCode];

			game.joinedPlayers.push(playerName);
			socket.join(lobbyCode);
			io.sockets.in(lobbyCode).emit("sc-lobby-player-update", game.seats);
			// const nonChosenPlayers = [];
			// for (const playerName of game.joinedPlayers) {
			// 	if (!(playerName in Object.values(game.seats))) nonChosenPlayers.push()
			// }
			io.sockets.in(lobbyCode).emit("sc-joined-players-no-color", game.joinedPlayers.filter(playerName => !Object.values(game.seats).includes(playerName)));
		});

		socket.on("cs-lobby-color-choice", ({lobbyCode, playerName, color}) => {
			if (!(lobbyCode in games)) return;
			const game = games[lobbyCode];

			if (!game.seats[color]) game.seats[color] = playerName;
			io.sockets.in(lobbyCode).emit("sc-lobby-player-update", game.seats);
			io.sockets.in(lobbyCode).emit("sc-joined-players-no-color", game.joinedPlayers.filter(playerName => !Object.values(game.seats).includes(playerName)));
		});

		socket.on("cs-lobby-start", ({lobbyCode, playerName}) => {
			if (!(lobbyCode in games)) return;
			const game = games[lobbyCode];

			if (playerName == game.lobbyOwner.playerName) {
				let amtChosen = 0;
				for (const playerNum in game.seats) {
					if (game.seats[playerNum]) amtChosen++;
				}
				if (game.joinedPlayers.length < minPlayers) {
					socket.emit("sc-error", {errorMessage: "Het spel kan niet gestart worden, want het minimum aantal deelnemers is nog niet bereikt."});
				} else if (amtChosen != game.joinedPlayers.length) {
					socket.emit("sc-error", {errorMessage: "Het spel kan niet gestart worden, want nog niet iedereen heeft een kleur gekozen."});
				} else {
					io.sockets.in(lobbyCode).emit("sc-game-init", {lobbyCode: lobbyCode});
					game.readyPlayers = [];
				}
			}
		});
		//#endregion lobby

		//#region game
		socket.on("cs-game-ready", ({lobbyCode, player}) => {
			if (!(lobbyCode in games)) return;
			const game = games[lobbyCode];
			if (!('readyPlayers' in game)) return;

			socket.join(lobbyCode);
			game.readyPlayers.push(player.playerName);
			if (game.readyPlayers.length != game.joinedPlayers.length) return;

			// Loop game
			io.sockets.in(lobbyCode).emit("sc-game-start", {lobbyCode: lobbyCode});
			log(lobbyCode, 0, "Game is starting...")
			game.participants = [];
			game.pacifico = false;
			for (const playerNum in game.seats) {
				if (game.seats[playerNum]) {
					game.participants.push({player: {playerNum: playerNum, playerName: game.seats[playerNum]}, dice: maxDice, beenPacifico: false});
				}
			}
			delete game.seats;
			delete game.readyPlayers;
			delete game.joinedPlayers;
			game.playersTurn = randomChoice(game.participants).player;
			newRound(lobbyCode, false);
		});
		
		socket.on("cs-game-bid", ({lobbyCode, player, bid}) => {
			if (!(lobbyCode in games)) return;
			const game = games[lobbyCode];
			if (player.playerName != game.playersTurn.playerName) {
				socket.emit("sc-error", {errorMessage: "Wacht tot je aan de beurt bent om een bod te doen."});
				return;
			}
			const lastTurn = game.lastTurn;
			// bid verification
			if ( // restructure this
				!(
					(bid.type > lastTurn.bid.type && bid.amount >= lastTurn.bid.amount) // verhoog soort dobbelstenen
					|| (bid.type >= lastTurn.bid.type && bid.amount > lastTurn.bid.amount && lastTurn.bid.type != 12) // verhoog aantal dobbelstenen
					|| (bid.amount > lastTurn.bid.amount * 2 && lastTurn.bid.type == 12 && bid.type != 12) // switch van jokers en verhoog
					|| (bid.amount > Math.floor(lastTurn.bid.amount / 2) && lastTurn.bid.type != 12 && bid.type == 12) // switch naar jokers en verhoog
					|| (bid.type == 12 && lastTurn.bid.type == 12 && bid.amount > lastTurn.bid.amount) // verhoog met jokers
				) // || !(bid.amount > 0 && bid.type > 0)
			) {
				socket.emit("sc-error", {errorMessage: "Jouw bod is ongeldig. Probeer het opnieuw met een ander bod."});
				return;
			} else if (
				lastTurn.player && game.pacifico
				&& bid.type != lastTurn.bid.type
				&& player.playerNum in game.dice
				&& game.dice[player.playerNum].length != 1
			) {
				socket.emit("sc-error", {errorMessage: "Jouw bod is ongeldig. Omdat dit een pacifico-ronde (armoederonde) is, moet je dezelfde dobbelsteen kiezen als de vorige persoon, tenzij je maar één dobbelsteen in bezit hebt."});
				return;
			}

			if (player.playerName != game.playersTurn.playerName) return;
			game.playersTurn = next(lobbyCode, player);
			game.lastTurn = {bid: bid, player: player}
			io.sockets.in(lobbyCode).emit("sc-new-turn", {
				lobbyCode: lobbyCode,
				playersTurn: game.playersTurn,
				lastTurn: game.lastTurn,
				pacifico: game.pacifico
			});
		});

		socket.on("cs-game-dudo", ({lobbyCode, player, lastTurn}) => {
			if (!(lobbyCode in games)) return;
			const game = games[lobbyCode];

			const jokerValue = (game.pacifico || lastTurn.bid.type == 12) ? 0 : game.diceCounts[12];
			const guessedDiceAmount = game.diceCounts[lastTurn.bid.type] + jokerValue;
			let loser;
			if (lastTurn.bid.amount > (guessedDiceAmount)) { // last player's guess was incorrect -> dudo was correct
				loser = lastTurn.player;
			} else { // last player's guess was correct -> dudo was incorrect
				loser = player;
			}
			io.sockets.in(lobbyCode).emit("sc-round-end", {
				loser: loser,
				dice: game.dice,
				inflicter: player,
				lastTurn: lastTurn,
				ownerName: game.lobbyOwner.playerName,
				guessedDiceAmount: guessedDiceAmount,
				type: "dudo"
			});
			const loserParticipant = findParticipant(lobbyCode, loser.playerNum)
			loserParticipant.dice -= 1;
			game.playersTurn = loser;
			if (loserParticipant.dice == 0) {
				game.participants.splice(game.participants.indexOf(loserParticipant), 1);
				delete game.dice[loser.playerNum];
				game.playersTurn = randomChoice(game.participants).player;
				game.pacifico = false;
			} else if (loserParticipant.dice == 1 && loserParticipant.beenPacifico == false) {
				loserParticipant.beenPacifico = true;
				game.pacifico = true;
			} else {
				game.pacifico = false;
			}
			if (game.participants.length == 1) {
				endGame(lobbyCode);
			}
		});

		socket.on("cs-game-calza", ({lobbyCode, player, lastTurn}) => {
			if (!(lobbyCode in games)) return;
			const game = games[lobbyCode];

			const jokerValue = (game.pacifico || lastTurn.bid.type == 12) ? 0 : game.diceCounts[12];
			const guessedDiceAmount = game.diceCounts[lastTurn.bid.type] + jokerValue;
			if (lastTurn.bid.amount == (guessedDiceAmount)) { // calza is correct
				io.sockets.in(lobbyCode).emit("sc-round-end", {
					winner: player,
					dice: game.dice,
					inflicter: player,
					lastTurn: lastTurn,
					ownerName: game.lobbyOwner.playerName,
					guessedDiceAmount: guessedDiceAmount,
					type: "calza"
				});
				const winnerParticipant = findParticipant(lobbyCode, player.playerNum)
				if (winnerParticipant.dice != maxDice) winnerParticipant.dice += 1;
				game.playersTurn = player;
				game.pacifico = false;
			} else { // calza is incorrect
				io.sockets.in(lobbyCode).emit("sc-round-end", {
					loser: player,
					dice: game.dice,
					inflicter: player,
					inflicted: lastTurn.player,
					ownerName: game.lobbyOwner.playerName,
					lastTurn: lastTurn,
					guessedDiceAmount: guessedDiceAmount,
					type: "calza"
				});
				const loserParticipant = findParticipant(lobbyCode, player.playerNum)
				loserParticipant.dice -= 1;
				game.playersTurn = player;
				if (loserParticipant.dice == 0) {
					game.participants.splice(game.participants.indexOf(loserParticipant), 1);
					delete game.dice[loser.playerNum];
					game.playersTurn = randomChoice(game.participants).player;
					game.pacifico = false;
				} else if (loserParticipant.dice == 1 && loserParticipant.beenPacifico == false) {
					loserParticipant.beenPacifico = true;
					game.pacifico = true;
				} else {
					game.pacifico = false;
				}
				if (game.participants.length == 1) {
					endGame(lobbyCode)
				}
			}
			
		});

		socket.on("cs-next-round", ({lobbyCode, player}) => {
			if (!(lobbyCode in games)) return;
			const game = games[lobbyCode];

			if (player.playerName != game.lobbyOwner.playerName) return;
			newRound(lobbyCode, game.pacifico)
		});
		//#endregion game
	});

	server.listen(PORT);
	console.log('Server started.');
});

function newRound(lobbyCode, pacifico) {
	const game = games[lobbyCode]
	const dice = {}
	for (const participant of game.participants) {
		dice[participant.player.playerNum] = Array.from({length: participant.dice}, () => randomChoice([2, 3, 4, 5, 6, 12]))
	}
	const allDice = [].concat(...Object.values(dice))
	const diceCounts = {"2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "12": 0};

	for (const num of allDice) {
		diceCounts[num] += 1;
	}
	game.diceCounts = diceCounts;
	game.dice = dice;
	game.lastTurn = {bid: {type: 0, amount: 0}};
	
	io.sockets.in(lobbyCode).emit("sc-new-turn", {
		lobbyCode: lobbyCode,
		playersTurn: game.playersTurn,
		pacifico: pacifico,
		lastTurn: null,
		dice: dice
	});
}

function endGame(lobbyCode) {
	if (!(lobbyCode in games)) return;
	const game = games[lobbyCode];
	const winner = game.participants[0];
	log(lobbyCode, 1, `Game ends with winner ${winner.player.playerName}`);
	io.sockets.in(lobbyCode).emit("sc-game-end", {winner: winner});
	delete games[lobbyCode];
}

//#region general functions
function randomChoice(arr) {
	return arr[Math.floor(Math.random()*arr.length)];
}

function next(lobbyCode, player) {
	if (!(lobbyCode in games)) return;
	const game = games[lobbyCode];
	const index = game.participants.findIndex(participant => participant.player.playerName == player.playerName);
	if (index == game.participants.length - 1) return game.participants[0].player;
	return game.participants[index + 1].player;
}

function previous(lobbyCode, player) {
	if (!(lobbyCode in games)) return;
	const game = games[lobbyCode];
	const index = game.participants.findIndex(participant => participant.player.playerName == player.playerName);
	if (index == 0) return last(game.participants).player;
	return game.participants[index - 1].player;
}

function last(array) {
    return array[array.length - 1];
}

function flip(obj) {
	return Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]));
}

function findParticipant(lobbyCode, playerNum) {
	return games[lobbyCode].participants.find(participant => participant.player.playerNum == playerNum);
}

function objEqual(x, y) {
	const ok = Object.keys, tx = typeof x, ty = typeof y;
	return x && y && tx === 'object' && tx === ty ? (
	  ok(x).length === ok(y).length &&
		ok(x).every(key => objEqual(x[key], y[key]))
	) : (x === y);
}

function log(lobbyCode, level, message) {
	let prefix;
	switch (level) {
		case 0:
			prefix = "i";
			break;

		case 1:
			prefix = "√";
			break;

		case 2: 
			prefix = "!";
			break;

		case 3:
			prefix = "X";
			break;
	}
	console.log(`[${lobbyCode}] (${prefix}) ${message}`);
}
//#endregion general functions
