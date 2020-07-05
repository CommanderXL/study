### The remoteEntry of Webpack Federation

`remoteEntry`属于使用`Webpack Federation`特性的应用`bootstrap`代码。在`remoteEntry`当中通过`__webpack_modules__`变量记录了需要被其他应用消费的模块映射关系。

`__webpack_require__`函数还是提供了最核心的根据 moduleId 去寻找 module 执行对应 module 方法，缓存 module 以及获取 module.exports(即 module 所导出的相关接口)

`__webpack_require__`相关拓展：

* `__webpack_require__.r` webpack/runtime/make namespace object

将模块的输出加上`__esModule`标记

```javascript
// define __esModule on exports
__webpack_require__.r = exports => {
  Object.defineProperty(exports, '__esModule', { value: true })
}
```

* `__webpack_require__.o` webpack/runtime/hasOwnProperty

```javascript
__webpack_require__.o = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop)
```

* `__webpack_require__.l` webpack/runtime/load loadScrip function to load a script via script tag

```javascript
;(() => {
  var inProgress = {}
  __webpack_require__.l = (url, done, key) => {
    if (inProgress[url]) {
      inProgress[url].push(done)
      return
    }

    ...
  }
})
```

* `__webpack_require__.f / __webpack_require__.f.consumes / `

* `__webpack_require__.f.j`

内部调用 `__webpack_require__.l` 函数，通过 script 标签异步加载 chunk

```javascript
__webpack_require__.f.j = (chunkId, promises) => {
  
}
```

* `__webpack_require.e`

目前 `__webpack_require__.e` 异步加载 chunk 的函数内部依赖了 `__webpack_require__.f` 来进行实现 

* `__webpack_require__.S` webpack/runtime/sharing