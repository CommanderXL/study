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

不过如果你要使用实例方法，例如:

```javascript
'foo'.includes('bar')
```

## Babel-polyfills