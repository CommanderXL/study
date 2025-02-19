### 架构设计

supportsMutation（host component 允许一些 update 等操作） -> false
supportsPersistence -> true


* updateHostText
* updateHostComponent


UIManagerBinding.cpp

* createNode
* appendChild

* [React-native pipline](https://reactnative.dev/architecture/render-pipeline)

* 目前 react-native 使用的 react renderer(`packages/react-native/Libraries/Renderer/shims/ReactFabric.js`) 为 ReactFabric（这部分的代码是提前编译好的 react 代码）

* 基础组件：`packages/react-native/Libraries/Components/**`

例如 `View` 组件：

> 'NativeComponent' is actually string，类似于 web，原生的 dom 节点，都是以字符串的形式。

```javascript
// react-native/Libraries/NativeComponent/NativeComponentRegistry.js
export function get(
  name,
  viewConfigProvider
) {
  ReactNativeViewConfigRegistry.register(name, () => {

  })
}
```


react-native/ReactCommon/react/renderer/dom