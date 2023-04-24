"use strict"
const fs = require('fs');
const http = require('http');
const express = require('express');
const app = express();
const server = http.Server(app);
const io = require('socket.io')(server);
// const server = http.Server(app);
const PORT = 3000;
let games = {}
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

		//#region lobby
		socket.on("cs-lobby-create", data => {
			const {lobbyCode, playerName} = data;
			games[lobbyCode] = {seats: {1: null, 2: null, 3: null, 4: null, 5: null, 6: null}, joinedPlayers: [playerName], lobbyOwner: playerName}
			socket.join(lobbyCode)
		});
		socket.on("cs-lobby-color-choice", data => {
			const {playerName, color, lobbyCode} = data;
			games[lobbyCode].seats[color] = playerName;
			console.log(games[lobbyCode].seats);
			io.sockets.in(lobbyCode).emit("sc-lobby-player-update", games[lobbyCode].seats);
		});
		socket.on("cs-lobby-join", data => {
			const {lobbyCode, playerName} = data;
			console.log(games[lobbyCode].joinedPlayers)
			if (games[lobbyCode].joinedPlayers.includes(playerName)) {
				socket.emit("sc-lobby-join-error", {playerName: playerName, errorMessage: `Deze naam (${playerName}) is al gekozen. Kies een unieke naam en join opnieuw.`});
			} else {
				games[lobbyCode].joinedPlayers.push(playerName);
				socket.join(lobbyCode);
				io.sockets.in(lobbyCode).emit("sc-lobby-player-update", games[lobbyCode].seats);
			}
		});
		socket.on("cs-lobby-start", data => {
			const {playerName, lobbyCode} = data;
			if (playerName == games[lobbyCode].lobbyOwner) {
				io.sockets.in(lobbyCode).emit("sc-game-start", {lobbyCode: lobbyCode});
			}
		});
		//#endregion lobby
	});

	server.listen(PORT);
	console.log('Server started.');
});