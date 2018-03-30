async function evaluateCode(board, player, index) {
	var unit = player.units[index];
	try {
		var code = player.code.replace("PAYLOAD", JSON.stringify({
			player: {
				x: unit.x,
				y: unit.y
			},
			board: board
		}));
		var result = await (new Promise(function(resolve, reject) {
			var timer = setTimeout(function() {
				resolve({}); // should be reject
			}, 50);
			var result = player.vm.run(code);
			clearTimeout(timer);
			resolve(result);
		}));
		var resultErr = validateMove(result, unit);
		if (resultErr === false) {
			// reset failure count, code worked
			player.failures = 0;
			return {
				player: player.uid,
				unit: index,
				prev: {
					x: unit.x,
					y: unit.y
				},
				next: {
					x: result.x,
					y: result.y
				}
			};
		} else {
			// something wrong with the returned result
			throw "result "+resultErr;
		}
	} catch (err) {
		return err+"";
	}
}

function validateMove(move, unit) {
	if (!move) return "invalid";
	if (typeof move !== "object") return "not an object";
	if (move === null) return "is null";
	if ((typeof move.x == "undefined") || (typeof move.y == "undefined")) return "does not have x and y";
	if (move.x !== parseInt(move.x, 10) || move.x !== parseInt(move.x, 10)) return "x and y are not integers";
	if (Math.abs(move.x - unit.x) > 1 || Math.abs(move.y - unit.y) > 1) return "tries to move too far";
	if (move.x >= process.env.BOARD_WIDTH || move.y >= process.env.BOARD_HEIGHT) return "moves outside of board";
	if (move.x < 0 || move.y < 0) return "moves outside of board";
	return false;
}

module.exports = {
	evaluateCode: evaluateCode
}
