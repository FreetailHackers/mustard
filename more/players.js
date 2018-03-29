var game = require("./game");
var fs = require("fs");
var crypto = require("crypto");
const {VM} = require("vm2");

var codeTemplate = fs.readFileSync("./more/sandboxed.js", "utf8");
var players = {};
var failureSuspension = 20;

function add(socket) {
	var uid = crypto.randomBytes(64).toString("hex").substr(0, 6);
	if (uid in players) return add(socket);

	players[uid] = {
		uid: uid,
		tell: function(type, data) {
			// console.log(type, data);
			socket.emit(type, data);
		},
		units: [],
		failures: 0,
		playing: false,
		connected: true,
		vm: newVM()
	}
	return uid;
}

function remove(uid) {
	players[uid].playing = false;
	players[uid].connected = false;
}

function newVM() {
	return new VM({
		timeout: 40, // ms
		console: "redirect",
		sandbox: {}
	});
}

function clean() {
	each(function(player, uid) {
		if (!player.connected) delete players[uid];
	});
}

function updateCode(uid, code) {
	var player = get(uid);
	player.vm = newVM();
	player.code = code+"\n/**/\n"+codeTemplate; // combats against commenting out the rest
	// in case there are suspensions, give another chance
	if (player.failures > failureSuspension) player.failures--;
}

function reset() {
	each(function(player) {
		player.playing = false;
	});
}

function each(fn) {
	for (var uid in players) {
		if (players.hasOwnProperty(uid)) {
			fn(players[uid], uid);
		}
	}
}

function count() {
	return Object.keys(players).length;
}

function get(uid) {
	if (players.hasOwnProperty(uid)) return players[uid];
	return false;
}

function getAll() {
	return players;
}

module.exports = {
	add: add,
	remove: remove,
	clean: clean,
	updateCode: updateCode,
	reset: reset,
	each: each,
	count: count,
	getAll: getAll,
	get: get
}
