# core-js

`core-js` 是 js 的 `polyfill` 标准库。它主要支持了以下特性：

* 最新的 ECMAScript 标准.
* ECMAScript 的 proposals 提议.
* 一些 WHATWG / W3C 标准.

这个 library 是模块化的，开发者可以按需引入实际项目当中所需要的 polyfill.

同时 `core-js` 可以在不污染全局的情况下使用（例如 `'xxx'.includes` 这种需要修改原型上的方法）.

此外这个 library 是和 babel 紧密联系的(`babel`提供了语法转化功能，core-js 主要是提供了 polyfill 的功能).

### Packages, entry points and modules names

`core-js` 提供了全局的 `polyfills`；

`core-js-pure` 提供的 `polyfills` 不会污染全局，它等价于 `core-js@2` 版本当中的 `core-js/library` 当中的内容；

`core-js-bundle` 提供了一个 bundle 版本的全局 `polyfills`；

相较于 `core-js@2`，`core-js@3` 版本提供了更多的入口文件的引入方式，最大限度的提供了灵活性，使得开发者去按需引入自己所需要添加的 `polyfills`：

```javascript
// polyfill all `core-js` features:
import "core-js";
// polyfill only stable `core-js` features - ES and web standards:
import "core-js/stable";
// polyfill only stable ES features:
import "core-js/es";

// if you want to polyfill `Set`:
// all `Set`-related features, with ES proposals:
import "core-js/features/set";
// stable required for `Set` ES features and features from web standards
// (DOM collections iterator in this case):
import "core-js/stable/set";
// only stable ES features required for `Set`:
import "core-js/es/set";
// the same without global namespace pollution:
import Set from "core-js-pure/features/set";
import Set from "core-js-pure/stable/set";
import Set from "core-js-pure/es/set";

// if you want to polyfill just required methods:
import "core-js/features/set/intersection";
import "core-js/stable/queue-microtask";
import "core-js/es/array/from";

// polyfill reflect metadata proposal:
import "core-js/proposals/reflect-metadata";
// polyfill all stage 2+ proposals:
import "core-js/stage/2";
```

## 相关文档

* [core-js@3](https://github.com/zloirock/core-js/blob/master/docs/2019-03-19-core-js-3-babel-and-a-look-into-the-future.md)