var socket = io();
var board, test = true;
var canvas = document.getElementById("board");
var ctx = canvas.getContext("2d");
var s = 20;
var uid;

socket.on("execution error", function(err) {
	log(err);
}).on("code suspended", function(runtime) {
	log("code has been suspended (too many errors)");
}).on("game restart", function(data) {
	// console.log(data);
	uid = data.uid;
}).on("unit removed", function(data) {
	// console.log(data);
}).on("board reset", function(data) {
	board = data;
	$(".board").addClass("loaded");
}).on("board update", function(data) {
	if (!board) return;
	$(".timer > div").width((1-(data.i-1)/(data.m-1))*100+"%");
	board = fossilDelta.apply(board, data.d);
	canvas.width = s*board.length;
	canvas.height = s*board[0].length;

	var scores = {}, totalUnits = 0;

	for (var i = 0; i < board.length; i++) {
		for (var j = 0; j < board[i].length; j++) {
			var unit = board[i][j];
			if (!scores.hasOwnProperty(unit.team)) scores[unit.team] = 0;
			scores[unit.team]++;
			totalUnits++;
			ctx.fillStyle = unit.team == "blank" ? "transparent" : unit.team;
			ctx.fillRect(s*i,s*j,s,s);
			if (unit.occupied) {
				if (unit.player == uid) {
					ctx.fillStyle = "white";
					ctx.fillRect(s*i+2,s*j+2,s-4,s-4);
				}
				ctx.fillStyle = "black";
				ctx.beginPath();
				ctx.arc(s*i+s/2,s*j+s/2,s/4,0,2*Math.PI);
				ctx.fill();
			}
		}
	}

	for (var team in scores) {
		if (scores.hasOwnProperty(team)) {
			$(".coverage ."+team).width(scores[team]/totalUnits*100+"%");
		}
	}
});

var editor = CodeMirror.fromTextArea($("#code .editor textarea")[0], {
	mode:  "javascript",
	lineNumbers: true,
	gutters: ["CodeMirror-lint-markers"],
	lint: true
});

if (Storage && localStorage.getItem("code")) editor.setValue(localStorage.getItem("code"));

editor.setOption("extraKeys", {
	"Ctrl-E": function() {
		$(".submit").click();
		return false;
	},
	"Ctrl-Enter": function() {
		$(".run").click();
	}
});

editor.on("change", function() {
	$("#code .save").text("unsaved");
});

// editor.setOption("theme", "blackboard");

$(window).keypress(function(e) {
	if (e.ctrlKey || e.metaKey) {
		if (e.which == 69) {
			$(".submit").click();
			e.preventDefault();
		} else if (e.which == 13) {
			$(".run").click();
			e.preventDefault();
		}
	}
});

$(".submit").click(function() {
	socket.emit("code update", editor.getValue());
	$("#code .save").text("saved");
	localStorage.setItem("code", editor.getValue());
});

$(".run").click(function() {
	try {
		eval(editor.getValue());
		var result = step({
			x: 0,//unit.x,
			y: 0//unit.y
		}, board);
		log(result);
	} catch(e) {
		log(e.message+" on line "+e.lineNumber);
		doc.addLineClass(e.lineNumber, "background", "error");
	}
});

var consoleEl = $("#code .console");
function log(message) {
	if (typeof message == "object") message = JSON.stringify(message, null, 2);
	var latest = consoleEl.children().last();
	console.log(message == latest.find("pre").text());
	if (message == latest.find("pre").text()) {
		var counter = latest.find(".repeat"),
			count = parseInt(counter.text() || 0);
		console.log(count);
		counter.text(count+1);
	} else {
		consoleEl.append($("<div><div class=repeat /><pre>").find("pre").text(message).parent()).scrollTop(9999);
		if (consoleEl.children().length > 30) consoleEl.children().first().remove();
	}
}

log("ready");
