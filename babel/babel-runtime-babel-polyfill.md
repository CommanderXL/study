## Babel-core

`Babel-core`是`babel`核心的编译器。它所做的主要的工作是`code -> code`，即将你`esNext`语法转化为`es5`等部分低浏览器暂不支持的语法。

注意`Babel-core`只做语法层面的转化工作。例如：

```javascript
// 转化前
const fn = () => {
  console.log('Before compile')
}

// 转化后
"use strict";

var fn = function fn() {
  console.log(123);
};
```

`Babel-core`不做`API`层面的转化工作，如果要借助`babel`来使用一些新的`esNext`的`API`，例如：`Promise`，`async/await`等，那么还需要使用其他的`Babel`所提供的`plugins`。

## Babel-runtime

内部包含了`core-js`和`regenerator-runtime`2个核心的依赖。

* `core-js`

`core-js`官方介绍就是：

> Modular standard library for JavaScript. Includes polyfills for ECMAScript 5, ECMAScript 6: promises, symbols, collections, iterators, typed arrays, ECMAScript 7+ proposals, setImmediate, etc.

即提供了`es5`，`es6`的`polyfills`，这里面的polyfill不包含`generators/yield`。

* `regenerator-runtime`

`regenerator-runtime`提供了`generators/yield`的`polyfill`。

## Babel-plugin-transform-runtime

`Babel-plugin-transform-runtime`这个插件将`Babel-runtime`作为其依赖。因此如果你要使用`Babel-runtime`来提供`polyfills`的话，那么仅仅只需要安装这一个插件，而`Babel-runtime`不需要另行的安装。

这个插件主要做的工作是：

1. 如果你的模块文件里面使用了`generators/async`函数，那么会在你的模块文件当中自动引入`babel-runtime/regenerator`；
2. 如果你的模块文件里面使用了`ES6`中的静态方法或者是`builtIns`，那么这个插件会将你所使用的这些方法做一层映射，即引入对应`core-js`中提供的`polyfills`；
3. 移除`babel`内联的`helpers`，而使用`babel-runtime/helpers`提供的`helpers`，避免代码的冗余。


这个插件的作用就是在`Babel`编译代码的环节，将原始`code`转化为`AST`后，遍历`AST`的节点去完成`polyfill`的引入工作，引入的`polyfill`实际上都是`babel-core`和`regenerator`这2个包提供的，`babel-plugin-transform-runtime`提供了这些方法的映射名，具体的实现请参见`Babel-plugin-transform-runtime`的源码中关于`definitions.js`中的定义。

例如：你使用了`Object`上的静态方法`const vals = Object.values({key: 'val'})`:

最后代码将会编译成：

```javascript
'use strict';

var _values = require('babel-runtime/core-js/object/values');

var _values2 = _interopRequireDefault(_values);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var vals = (0, _values2.default)({ key: 'val' });
```


不过如果你要使用部分**实例方法**，例如:

```javascript
'foo'.includes('bar')
```

这个时候使用`Babel-runtime`是无法工作的，因为它并没有提供实例方法的`polyfill`，即`Babel-runtime`并未提供原型链上的`polyfill`，这也是官方说的`babel-runtime`没有全局污染，官方推荐如果要用实例上的这些方法请使用`babel-polyfill`。

## Babel-polyfill

`Babel-polyfill`官方的介绍就是模拟一个完整`es2015环境`，它也将`babel-core`和`regenerator`作为了它的依赖。除了提供了`BuiltIns`，`Static Method`以及`generator functions`的`polyfill`外，它还通过修改原型链上的方法提供了实例方法的`polyfill`，因此你可以放心的使用：

```javascript
'foo'.includes('bar')
```

在使用过程当中，如果你打算使用`Babel-polyfill`的话，那么在你的入口文件直接引入即可，这个时候你便不再需要`Babel-plugin-transform-runtime`这个插件了。

## Babel-preset-env

> A Babel preset that compiles ES2015+ down to ES5 by automatically determining the Babel plugins and polyfills you need based on your targeted browser or runtime environments

通过`babel`的配置项，在`babel`编译你的代码的时候来决定是否需要`polyfill`以及`plugin`。

几个经常用到的配置:

* target

即配置你的代码需要运行的环境。`babel`会根据你的配置来决定需要引入哪些`polyfill`及相关的`plugin`。

```javascript
  // .babelrc

  {
    "presets": [
      ["env", {
        "target": {
          "node": "current"
        }
      }]
    ]
  }

  {
    "presets": [
      ["env", {
        "target": {
          "browsers": ["last 2 versions", "safari >= 7"]
        }
      }]
    ]
  }
```

* useBuiltIns

usage | entry | false

是否使用`polyfill`。`babel`在编译你的代码过程中会根据你的`target`配置项来决定是否需要引入相关的`polyfill`。

如果设为`usage`或`true`时：

a.js

```javascript
var a = new Promise();
```


b.js
```javascript
var b = new Map();
```

Out (if environment doesn't support it)

```javascript
import "core-js/modules/es6.promise";
var a = new Promise();
import "core-js/modules/es6.map";
var b = new Map();
```
Out (if environment supports it)
```javascript
var a = new Promise();
var b = new Map();
```

如果设为`false`，那么编译后的代码里面不会单独引入相关的`polyfill`。