# core-js

`core-js` 是 js 的 `polyfill` 标准库。它主要支持了以下特性：

* 最新的 ECMAScript 标准.
* ECMAScript 的 proposals 提议.
* 一些 WHATWG / W3C 标准.

这个 library 是模块化的，开发者可以按需引入实际项目当中所需要的 polyfill.

同时 `core-js` 可以在不污染全局的情况下使用（例如 `'xxx'.includes` 这种需要修改原型上的方法）.

此外这个 library 是和 babel 紧密联系的(`babel`提供了语法转化功能，core-js 主要是提供了 polyfill 的功能).



## 相关文档

* [core-js@3](https://github.com/zloirock/core-js/blob/master/docs/2019-03-19-core-js-3-babel-and-a-look-into-the-future.md)