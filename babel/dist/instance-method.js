"use strict";

require("core-js/modules/es6.array.find-index");

var arr = [1, 2, 3];
var res = arr.findIndex(function (num) {
  return num > 2;
});
console.log(res);