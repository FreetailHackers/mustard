var socket = io();
var board, test = true;
var canvas = document.getElementById("board");
var ctx = canvas.getContext("2d");
var s = 40;
var uid;
var colors = {
	blue: "#2f52a7",
	green: "#2f9fa7",
	red: "#a72f2f",
	dark: "#263238",
	white: "#e9eded"
};
var paused = false, frozenBoard;

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
	// console.log(data);
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
	canvas.width = s*(todraw.length-1);
	canvas.height = s*(todraw[0].length-1);

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
		frozenBoard = board;
		paused = true;
		log("board frozen");
		$("#state").addClass("paused");
	}
	var oldLog = console.log;
    console.log = function(message) {
		log(message);
        oldLog.apply(console, arguments);
    };
	try {
		eval(editor.getValue());
		var result = step({
			x: 0,//unit.x,
			y: 0//unit.y
		}, board);
		log(result);
	} catch(e) {
		log(e.message+" on line "+e.lineNumber, "error");
		doc.addLineClass(e.lineNumber, "background", "error");
	}
	console.log = oldLog;
});

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
