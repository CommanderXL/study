'use strict';

require('babel-polyfill');

var arr = [1, 2, 3];

var res = arr.findIndex(function (num) {
  return num > 2;
});

console.log(res);