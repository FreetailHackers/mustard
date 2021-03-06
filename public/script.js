var socket = io();
var board, test = true;
var canvas = document.getElementById("board");
var ctx = canvas.getContext("2d");
var s = 40;
var uid, playerData;
var colors = {
	blue: "#2f52a7",
	green: "#2f9fa7",
	red: "#a72f2f",
	dark: "#263238",
	white: "#e9eded"
};
var paused = false, frozenBoard, runOn = {x:0,y:0};

socket.on("connect", function() {
	log("connected to server, waiting for data");
	$("header .status").text("connected");
	socket.emit("get board");
}).on("disconnect", function() {
	$(".board").addClass("waiting");
	$("header .status").text("disconnected");
	$(".submit").text("Save");
	log("lost connection to server", "error");
}).on("execution error", function(err) {
	log(err, "error");
}).on("code suspended", function(runtime) {
	log("code has been suspended (too many errors)", "error");
}).on("game restart", function(data) {
	playerData = data;
	if (uid != data.uid) log("connected as "+data.uid);
	uid = data.uid;
	$(".coverage > div").removeClass("me");
	$(".coverage ."+data.team).addClass("me");
}).on("unit removed", function(data) {
	// console.log(data);
}).on("board reset", function(data) {
	board = data;
	$(".timer > div").width("100%").addClass("noani")[0].offsetHeight;
	$(".timer > div").removeClass("noani");
	$(".board").removeClass("waiting");
}).on("board update", function(data) {
	if (!board) return;
	$(".timer > div").width((1-(data.i-1)/(data.m-1))*100+"%");
	for (var i = 0; i < data.d.n.length; i++) {
		var item = data.d.n[i];
		board[item.x][item.y].occupied = false;
		board[item.x][item.y].player = "";
	}
	for (var i = 0; i < data.d.o.length; i++) {
		var item = data.d.o[i];
		board[item.x][item.y].occupied = true;
		board[item.x][item.y].player = item.p;
		board[item.x][item.y].team = item.t;
	}

	if (!paused) draw(board);
});

function draw(todraw) {
	canvas.width = s*(todraw.length);
	canvas.height = s*(todraw[0].length);

	var scores = { red: 0, blue: 0, green: 0 }, totalUnits = 0;

	for (var i = 0; i < todraw.length; i++) {
		for (var j = 0; j < todraw[i].length; j++) {
			var unit = todraw[i][j];
			if (!scores.hasOwnProperty(unit.team)) scores[unit.team] = 0;
			scores[unit.team]++;
			totalUnits++;
			ctx.fillStyle = unit.team == "blank" ? "transparent" : colors[unit.team];
			ctx.fillRect(s*i,s*j,s,s);
			ctx.fillStyle = "rgba(38, 50, 56, 0.8)";
			ctx.fillRect(s*i,s*j,s,s);
			if (unit.occupied) {
				// someone is here
				ctx.fillStyle = colors[unit.team];
				ctx.beginPath();
				ctx.arc(s*i+s/2,s*j+s/2,s/3,0,2*Math.PI);
				ctx.fill();
				// it's the player
				if (unit.player == uid) {
					ctx.fillStyle = "rgba(255,255,255,0.6)";
					ctx.beginPath();
					ctx.arc(s*i+s/2,s*j+s/2,s/4-s/10,0,2*Math.PI);
					ctx.fill();
				}
			}
		}
	}

	var percent;
	for (var team in scores) {
		if (scores.hasOwnProperty(team)) {
			percent = scores[team]/totalUnits*100;
			$(".coverage ."+team).width(percent+"%")
				.html(Math.round(percent*10)/10+"%&nbsp;");
		}
	}
}

var arena = $("#board"), unitInfo = $("#state .info");
arena.mousemove(function(e) {
	var shown = paused ? frozenBoard : board;
	var parentOffset = $(this).offset();
	runOn.x = ((e.pageX - parentOffset.left) / arena.outerWidth() * shown.length) | 0;
	runOn.y = ((e.pageY - parentOffset.top) / arena.outerHeight() * shown[0].length) | 0;
	if (shown[runOn.x][runOn.y].occupied) unitInfo.text("click to run code on ["+runOn.x+"]["+runOn.y+"]");
	else unitInfo.text("no unit at ["+runOn.x+"]["+runOn.y+"]");
}).click(function() {
	if (paused && frozenBoard[runOn.x][runOn.y].occupied) $(".run").click();
}).mouseleave(function() {
	unitInfo.text("mouse over the board to view information");
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
	$(".submit").text("Save");
});

editor.setOption("theme", "material");

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
	$(".submit").text("Saved!");
	localStorage.setItem("code", editor.getValue());
});

$(".resume").click(function() {
	draw(board);
	$("#state").removeClass("paused");
	log("board resumed");
	paused = false;
});

$(".run").click(function() {
	if (!paused) {
		frozenBoard = JSON.parse(JSON.stringify(board));
		paused = true;
		log("board frozen");
		draw(frozenBoard);
		$("#state").addClass("paused");
	}
	var oldLog = console.log;
	console.log = function(message) {
		log(message);
		oldLog.apply(console, arguments);
	};
	try {
		eval(editor.getValue());
		var result = step(board, playerData, runOn);
		log("unit ["+runOn.x+"]["+runOn.y+"] would move to "+JSON.stringify(result, null, 2));
	} catch(e) {
		log(e.message+" on line "+e.lineNumber, "error");
		doc.addLineClass(e.lineNumber, "background", "error");
	}
	console.log = oldLog;
});

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

var consoleEl = $("#code .console .content");
function log(message, cl) {
	cl = cl || "";
	if (typeof message == "object") message = JSON.stringify(message, null, 2);
	var latest = consoleEl.children().last();
	if (message == latest.find("pre").text()) {
		var counter = latest.find(".repeat"),
			count = parseInt(counter.text() || 1);
		counter.text(count+1);
	} else {
		consoleEl.append($("<div><div class=repeat /><pre>").find("pre").addClass(cl).text(message).parent()).scrollTop(9999);
		if (consoleEl.children().length > 30) consoleEl.children().first().remove();
	}
}

$("#code .console").resizable({ 
	handleSelector: ".resize",
	resizeWidth: false,
	resizeHeightFrom: "top",
	onDrag: function(e, el, w, height) {
		el.find(".content").height((height-10-7*2)+"px");
	}
});

log("application ready");
