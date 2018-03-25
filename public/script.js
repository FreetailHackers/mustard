var socket = io();
var board, test = true;
var canvas = document.getElementById("board");
var ctx = canvas.getContext("2d");
var s = 20;
var uid;

$(".submit").click(function() {
	console.log("dsdsd");
	socket.emit("code update", editor.getValue());
});

socket.on("execution error", function(err) {
	// console.error(err);
}).on("code suspended", function(runtime) {
	// console.error("code suspended");
}).on("game restart", function(data) {
	// console.log(data);
	uid = data.uid;
}).on("unit removed", function(data) {
	// console.log(data);
}).on("board reset", function(data) {
	board = data;
}).on("board update", function(data) {
	if (!board) return;
	// console.log(data.i+"/"+data.m);
	// if (test) { test = false; console.log(data.d); }
	board = fossilDelta.apply(board, data.d);
	canvas.width = s*board.length;
	canvas.height = s*board[0].length;

	for (var i = 0; i < board.length; i++) {
		for (var j = 0; j < board[i].length; j++) {
			var unit = board[i][j];
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
});

var editor = CodeMirror.fromTextArea($("#code .editor textarea")[0], {
	mode:  "javascript",
	lineNumbers: true
});
