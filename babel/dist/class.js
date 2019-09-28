"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var A =
/*#__PURE__*/
function () {
  function A() {
    (0, _classCallCheck2["default"])(this, A);
    this.a = 1;
  }

  (0, _createClass2["default"])(A, [{
    key: "go",
    value: function go() {
      console.log(this.a);
    }
  }]);
  return A;
}();

var a = new A();
console.log(a);