var players = require("./players");
var tools = require("./tools");
var shuffle = require("shuffle-array");
var fs = require("fs");

var board = [];
var gameIterations = 0;
var teams = ["blue", "green", "red"];
var whoBeats = {
	"blue": "green",
	"green": "red",
	"red": "blue"
};
var queue = [];

var failureSuspension = process.env.FAILURE_SUSPENSION;

function reset() {
	// remove now-offline players from previous rounds
	players.clean();

	fs.writeFileSync("./codes.txt", "");
	players.each(function(player, uid) {
		if (player.code) fs.appendFileSync("./codes.txt", uid+" "+player.code);
	});

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
	var initUnits = totalSpace*process.env.BOARD_INIT_UTILIZATION;
	var unitsPerUser = initUnits/players.count();
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
		player.playing = true;
		player.tell("game restart", {
			team: player.team,
			uid: player.uid
		});
		count++;
	});
}

function tick(callback) {
	var prevBoard = JSON.parse(JSON.stringify(board));
	var changes = {
		o: [],
		n: [],
	};

	queue = shuffle(queue);
	for (var i = 0; i < queue.length; i++) {
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
			changes.n.push({
				x: move.prev.x,
				y: move.prev.y
			});
			changes.o.push({
				x: move.next.x,
				y: move.next.y,
				p: move.player,
				t: player.team
			});
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
			changes.n.push({
				x: move.prev.x,
				y: move.prev.y
			});
			changes.o.push({
				x: move.next.x,
				y: move.next.y,
				p: move.player,
				t: player.team
			});
		} else {
			// invalid move
			var elimPlayer = players.get(prev.player);
			if (elimPlayer) {
				elimPlayer.units[prev.unit].present = false;
				elimPlayer.tell("unit removed", prev.unit);
			}
			prev.occupied = false;
			changes.n.push({
				x: move.prev.x,
				y: move.prev.y
			});

		}
	}

	function run() {
		new Promise(function(resolve) {
			if (i % 10000 === 0) {
				global.gc();
				console.log(process.memoryUsage());
			}
			i++;
			setImmediate(resolve);
		}).then(run);
	}

	// calculate next round of moves
	queue = [];
	var completed = [], allofthem = [];

	async function processPlayer() {
		// I hate that I wrote this, that this is possible, and JS itself
		var tasks = [], done = false;
		players.each(function(player, uid) {
			if (done || !player.playing || completed.indexOf(uid) > -1) return;
			completed.push(uid);
			done = true;
			for (var i = 0; i < player.units.length; i++) {
				if (!player.units[i].present || !player.code || player.failures > failureSuspension) continue;
				tasks.push(tools.evaluateCode(board, player, i).then(function(result) {
					if (typeof result === "object") {
						queue.push(result);
					} else if (typeof result === "string" && result != "result moves outside of board") {
						player.tell("execution error", result);
						player.failures++;
						if (player.failures >= failureSuspension) {
							player.tell("code suspended");
						}
					}
				}));
			}
		});
		if (done) await Promise.all(tasks).then(processPlayer);
		else await Promise.all(tasks);
	}

	processPlayer().then(function() {
		gameIterations++;
		if (gameIterations >= process.env.GAME_ITERATIONS) {
			reset();
			callback(true, board);
		} else {
			callback(false, {
				i: gameIterations,
				m: process.env.GAME_ITERATIONS,
				d: changes
			});
		}
	});
}

function getCompleteState() {
	return board;
}

module.exports = {
	reset: reset,
	tick: tick,
	get: getCompleteState
}
