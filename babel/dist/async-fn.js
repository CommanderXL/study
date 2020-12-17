import _setTimeout from "@babel/runtime-corejs3/core-js-stable/set-timeout";
import _Promise from "@babel/runtime-corejs3/core-js-stable/promise";

async function a() {
  await new _Promise(resolve => {
    _setTimeout(resolve, 3000);
  });
}