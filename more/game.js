var players = require("./players");
var tools = require("./tools");
var fossilDelta = require("fossil-delta");
var shuffle = require("shuffle-array");

var board = [];
var gameIterations = 0;
var teams = ["blue", "green", "red"];
var whoBeats = {
	"blue": "green",
	"green": "red",
	"red": "blue"
};
var queue = [];

var failureSuspension = 20;

function reset() {
	// remove now-offline players from previous rounds
	players.clean();

	// clear board
	board = [];
	gameIterations = 0;
	for (var i = 0; i < process.env.BOARD_WIDTH; i++) {
		board[i] = [];
		for (var j = 0; j < process.env.BOARD_HEIGHT; j++) {
			board[i][j] = {
				team: "blank",
				occupied: false
			};
		}
	}

	// seed initial units
	var totalSpace = process.env.BOARD_WIDTH * process.env.BOARD_HEIGHT;
	var initUnits = 3;
	var unitsPerUser = (initUnits/(Math.max(1, players.count())))|0;
	console.log("players.count()", players.count());
	var count = 0;
	players.each(function(player, uid) {
		player.team = teams[count % teams.length];
		player.units = [];
		for (var i = 0; i < unitsPerUser; i++) {
			var x = (Math.random()*(process.env.BOARD_WIDTH-1))|0;
			var y = (Math.random()*(process.env.BOARD_HEIGHT-1))|0;
			// make sure there is nothing there yet
			while (board[x][y].occupied) {
				x = (Math.random()*(process.env.BOARD_WIDTH-1))|0;
				y = (Math.random()*(process.env.BOARD_HEIGHT-1))|0;
			}
			board[x][y].team = player.team;
			board[x][y].occupied = true;
			board[x][y].player = uid;
			board[x][y].unit = i;
			player.units.push({
				present: true,
				x: x,
				y: y
			});
		}
		console.log("length of players array in reset: ", player.units.length);
		player.playing = true;
		player.tell("game restart", {
			team: player.team,
			uid: player.uid,
			units: player.units
		});
		count++;
	});
}

function tick(callback) {
	var prevBoard = JSON.parse(JSON.stringify(board));

	queue = shuffle(queue);
	for (var i = 0; i < queue.length; i++) {
		var taken1 = 0;
		for (var x = 0; x < board.length; x++) {
			for (var j = 0; j < board[i].length; j++) {
				var unit = board[x][j];
				if (unit.occupied) 
					taken1++;
			}
		}
		
		console.log("real # of spots taken before", taken1)

		var move = queue[i];
		var player = players.get(move.player);
		var unit = player.units[move.unit];
		if (!unit) continue;
		var prev = board[move.prev.x][move.prev.y];
		var next = board[move.next.x][move.next.y];

		

		if (!next.occupied) {
			// not used, no conflict, easy
			prev.occupied = false;
			next.occupied = true;
			next.team = player.team;
			next.player = move.player;
			next.unit = move.unit;
			unit.x = move.next.x;
			unit.y = move.next.y;
		} else if (player.team == whoBeats[next.team]) {
			// this one beats the previous, make move
			var elimPlayer = players.get(next.player);
			elimPlayer.units[next.unit].present = false;
			elimPlayer.tell("unit removed", next.unit);
			prev.occupied = false;
			next.occupied = true;
			next.team = player.team;
			next.player = move.player;
			next.unit = move.unit;
			unit.x = move.next.x;
			unit.y = move.next.y;

		} else {
			// invalid move
			console.log(next);
			console.log("unit's information:", players.get(next.player).units[next.unit])
		}

		var taken2 = 0;

		for (var x = 0; x < board.length; x++) {
			for (var j = 0; j < board[i].length; j++) {
				var unit = board[x][j];
				if (unit.occupied) 
					taken2++;
			}
		}
		console.log("real # of spots taken after", taken2)


	}

	// calculate next round of moves

	queue = [];
	players.each(function(player) {
		if (!player.playing) return;
		for (var i = 0; i < player.units.length; i++) {
			if (!player.units[i].present || !player.code) continue;
			var result = tools.evaluateCode(board, player, i);
			if (typeof result === "object") {
				queue.push(result);
			} else if (typeof result === "string") {
				player.tell("execution error", result);
				player.failures++;
				if (player.failures >= failureSuspension) {
					player.tell("code suspended");
				}
			}
		}
		console.log("player units length in tick: ", player.units.length);
	});
	

	gameIterations++;
	console.log(gameIterations);
	if (gameIterations >= process.env.GAME_ITERATIONS) {
		reset();
		callback(true, board);
	} else {
		callback(false, {
			i: gameIterations,
			m: process.env.GAME_ITERATIONS,
			d: fossilDelta.create(prevBoard, board)
		});
	}
	//console.log(JSON.stringify(board));
}

function getCompleteState() {
	return board;
}

module.exports = {
	reset: reset,
	tick: tick,
	get: getCompleteState
}
