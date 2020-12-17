import _findIndexInstanceProperty from "@babel/runtime-corejs3/core-js-stable/instance/find-index";
const arr = [1, 2, 3];

const res = _findIndexInstanceProperty(arr).call(arr, num => num > 2);

console.log(res);