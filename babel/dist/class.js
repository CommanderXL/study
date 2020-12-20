import _classCallCheck from "@babel/runtime/helpers/classCallCheck";
import _createClass from "@babel/runtime/helpers/createClass";

var A = /*#__PURE__*/function () {
  function A() {
    _classCallCheck(this, A);

    this.a = 1;
  }

  _createClass(A, [{
    key: "go",
    value: function go() {
      console.log(this.a);
    }
  }]);

  return A;
}();

var a = new A();
console.log(a);