
react 提供了 react-fresh package 用以实现 fastFresh 的功能：

* react-fresh/babel (被 react-native 使用，作为 babel 插件注入)
* react-fresh/runtime (被 react-native 使用，注入到运行时代码当中)： `react-native/Libraries/Core/setUpReactRefresh.js`



* metro-runtime/src/polyfills/require.js

在开发环境下会给每个 module 都部署一个 hot api：

```javascript
function define (
  factory: FactoryFn,
  moduleId: number,
  dependencyMap?: DependencyMap
) {
  if (module.has(moduleId)) {
    if (__DEV__) {
      const inverseDependencies = arguments[4]

      // If the module has already been defined and the define method has been
      // called with inverseDependencies, we can hot reload it
      if (inverseDependencies) {
        global.__accept(moduleId, factory, dependencyMap, inverseDependencies)
      }
    }
  }

  if (__DEV__) {
    mod.hot = createHotReloadingObject()
  }
}


if (__DEV__) {
  var createHotReloadingObject = function () {
    const hot = {
      _acceptCallback: null,
      _disposeCallback: null,
      _didAccept: false,
      accept: (callback) => {
        hot._didAccept = true
        hot._acceptCallback = callback
      },
      dispose: (callback) => {
        hot._disposeCallback = callback
      }
    }
    return hot
  }

  let reactRefreshTimeout = null
}
```


* metro/src/HmrServer.js

hmr server 实现


----

在纯 drn 场景下，每个 module 发生变化都会单独编译构建出来这个变化后的 module 代码，然后再由 HmrServer 将代码通过 websocket 传递到 HmrClient 当中。HmrClient 接收到了代码后会根据类型来决定如何进行更新：

```javascript
{
  type: 'update',
  body: {
    revisionId: 'fab2dc7a5a9f3700',
    isInitialUpdate: false,
    added: [],
    modified: [
      {
        module: [
          815,
          '__d(function (global, _$$_REQUIRE, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {\n  var _interopRequireDefault = _$$_REQUIRE(_dependencyMap[0], "@babel/runtime/helpers/interopRequireDefault");\n  Object.defineProperty(exports, "__esModule", {\n    value: true\n  });\n  exports.default = void 0;\n  var _slicedToArray2 = _interopRequireDefault(_$$_REQUIRE(_dependencyMap[1], "@babel/runtime/helpers/slicedToArray"));\n  var _reactNative = _$$_REQUIRE(_dependencyMap[2], "react-native");\n  var _NavigationState = _interopRequireDefault(_$$_REQUIRE(_dependencyMap[3], "@/components/NavigationState"));\n  var _RouteInfo = _interopRequireDefault(_$$_REQUIRE(_dependencyMap[4], "@/components/RouteInfo"));\n  var _Actions = _interopRequireDefault(_$$_REQUIRE(_dependencyMap[5], "@/components/Actions"));\n  var _react = _$$_REQUIRE(_dependencyMap[6], "react");\n  var _jsxRuntime = _$$_REQUIRE(_dependencyMap[7], "react/jsx-runtime");\n  var _this = this,\n    _jsxFileName = "/Users/didi/demo/drn-fast-refresh/src/pages/PageB.tsx",\n    _s = $RefreshSig$();\n  var PageB = function PageB() {\n    _s();\n    var _useState = (0, _react.useState)(0),\n      _useState2 = (0, _slicedToArray2.default)(_useState, 2),\n      result = _useState2[0],\n      setResult = _useState2[1];\n    var handleAdd = function handleAdd() {\n      var res1 = (0, _$$_REQUIRE(_dependencyMap[8], "@/components/a").add)(1, 2);\n      setResult(function (preV) {\n        return preV === null ? 0 : preV + 1;\n      });\n    };\n    var d = (0, _react.useRef)(null);\n    return /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNative.View, {\n      style: {\n        flex: 1\n      },\n      pointerEvents: "box-none",\n      children: /*#__PURE__*/(0, _jsxRuntime.jsxs)(_reactNative.View, {\n        style: _$$_REQUIRE(_dependencyMap[9], "@/styles").styles.innerContainer,\n        children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNative.Text, {\n          style: _$$_REQUIRE(_dependencyMap[9], "@/styles").styles.headerText,\n          children: "Page Beeededede"\n        }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNative.Text, {\n          children: (0, _$$_REQUIRE(_dependencyMap[8], "@/components/a").add)(1, 2)\n        }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNative.Text, {\n          onPress: handleAdd,\n          children: "Add 1 + 2"\n        }), result !== null && /*#__PURE__*/(0, _jsxRuntime.jsxs)(_reactNative.Text, {\n          children: ["Result: ", result]\n        }), /*#__PURE__*/(0, _jsxRuntime.jsxs)(_reactNative.ScrollView, {\n          children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_NavigationState.default, {}), /*#__PURE__*/(0, _jsxRuntime.jsx)(_RouteInfo.default, {}), /*#__PURE__*/(0, _jsxRuntime.jsx)(_Actions.default, {})]\n        })]\n      })\n    });\n  };\n  _s(PageB, "RxYHvzQ2qliCsG9kjr3MrjTwsSM=");\n  _c = PageB;\n  var _default = exports.default = PageB;\n  var _c;\n  $RefreshReg$(_c, "PageB");\n},815,[1,41,3,592,812,813,55,105,816,811],"src/pages/PageB.tsx",{"0":[],"590":[0],"815":[590]});\n'
        ],
        sourceMappingURL: '',
        sourceURL: ''
      }
    ],
    deleted: []
  }
}
```

inverseDependencies 反向的依赖关系：

当源码当中某个模块的内容发生了变化，metro hmr server 会将变化的 module 推送到 hmr client 侧，那么在推送的代码字符串当中就包含了这个发生变化的模块的反向依赖关系，也就是哪些模块依赖了这个变化的模块，以及这些模块的其他依赖关系。那么实际在执行这段字符串代码的时候就能依据这些模块间的依赖关系来：

1. 模块的重新加载执行，获取其暴露的内容；
2. 整个应用的 fresh 的组件边界；

module 加载的流程：

```javascript
metroRequire(id)
```

fiber tree 更新的流程；