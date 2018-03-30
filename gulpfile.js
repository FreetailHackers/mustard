var gulp = require("gulp");
var concat = require("gulp-concat");
var uglify = require("gulp-uglify");
var less = require("gulp-less");
var cssmin = require("gulp-cssmin");

gulp.task("css", function () {
	return gulp.src("./public/external/*.css")
		.pipe(less())
		.pipe(cssmin())
		.pipe(concat("more.css"))
		.pipe(gulp.dest("./public"));
});

gulp.task("js", function() {
	return gulp.src([
		"./public/external/jquery.min.js",
		"./public/external/jshint.min.js",
		"./public/external/codemirror.js",
		"./public/external/codemirror-*.js",
		"./public/external/jquery*.js",
		"./public/external/prefixfree.min.js"
	])
		.pipe(uglify())
		.pipe(concat("min.js"))
		.pipe(gulp.dest("./public"));
});

gulp.task("default", ["css", "js"]);
