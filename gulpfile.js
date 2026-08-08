const { src, dest, parallel } = require('gulp');
const htmlmin = require('gulp-htmlmin');
const cleanCSS = require('gulp-clean-css');
const terser = require('gulp-terser');

const pub = 'public';

function minifyHtml() {
  return src(`${pub}/**/*.html`)
    .pipe(htmlmin({
      collapseWhitespace: true,
      conservativeCollapse: true,
      removeComments: true,
      minifyJS: false,
      minifyCSS: false
    }))
    .pipe(dest(pub));
}

function minifyCss() {
  return src(`${pub}/**/*.css`)
    .pipe(cleanCSS())
    .pipe(dest(pub));
}

function minifyJs() {
  return src(`${pub}/**/*.js`)
    .pipe(terser())
    .pipe(dest(pub));
}

exports.min = parallel(minifyHtml, minifyCss, minifyJs);
