var game = require("./game");
var players = require("./players");
var tools = require("./tools");

var io = false;
var stepSize = process.env.STEP_SIZE_MS;

function userConnected(socket) {
	var uid = players.add(socket);
	console.log("a user connected", uid);
	socket.on("disconnect", function() {
		console.log("user disconnected");
		players.remove(uid);
	}).on("code update", function(code) {
		players.updateCode(uid, code);
	});
}

module.exports = function(mio) {
	io = mio;
	mio.on("connection", userConnected);
	game.reset();
	var end, start = new Date().getTime();
	game.tick(eachTick);
	function eachTick(newGame, change) {
		if (newGame) io.emit("board reset", change);
		else io.emit("board update", change);
		end = new Date().getTime();
		setTimeout(function() {
			game.tick(eachTick);
		}, stepSize - Math.min(stepSize, end - start));
		start = end;
	}
};
