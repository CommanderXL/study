### 架构设计

supportsMutation（host component 允许一些 update 等操作） -> false
supportsPersistence -> true

* [React-native pipline](https://reactnative.dev/architecture/render-pipeline)

* 目前 react-native 使用的 react renderer(`packages/react-native/Libraries/Renderer/shims/ReactFabric.js`) 为 ReactFabric

* 基础组件：`packages/react-native/Libraries/Components/**`