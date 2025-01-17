# React Render

通过一个简单的例子来深入了解下 react 的渲染流程：

```javascript
// index.js
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app.js'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(App)

// app.js
import { createElement, useState } from 'react'
import componentA from './component-a.js'
function app() {
  const [count, setCount] = useState(1)
  return createElement('div', null, createElement(componentA, { count }))
}

export default app

// component-a.js
function componentA(props) {
  return (
    <>
      <p>{props.count}</p>
    <>
  )
}
export default componentA
```


react-dom/client 对外暴露的 createRoot 方法用以创建宿主环境的真实根节点容器，实际上这个方法依赖的是 react-reconciler 当中暴露的 createContainer，最终会创建一个 FiberRoot 节点（这个节点和 Fiber 节点并不是同一种数据结构类型）。

```javascript
// react-dom/src/client/ReactDOMRoot.js
function createRoot(container, options) {
  ...
  const root = createContainer(container, ...args) // 创建一个 FiberRootNode 节点，并和 dom element 进行关联 
  return new ReactDOMRoot(root)  // 返回一个 ReactDOMRoot 节点示例，暴露了 render 方法，可以接受 function component 进行渲染
}

```

同时这里会创建第一个 Fiber 节点，并建立 FiberRoot 和 Fiber 节点的联系（FiberRoot.current = Fiber/Fiber.stateNode = FiberRoot），**初始化 Fiber 节点的内部状态（memorizedState）以及 `updateQueue`**

```javascript

// react-reconciler/src/ReactFiberRoot.js
function createContainer() {
  const root = new FiberRootNode(...)
  ...
  const uninitializedFiber = createHostRootFiber(tag, isStrictMode)
  root.current = uninitializedFiber // 创建第一个 Fiber 节点，并和 FiberRoot 节点建立起联系
  uninitializedFiber.stateNode = root

  ...
  const initialState = {
    element: initialChildren
    ...
  }
  uninitializedFiber.memoizedState = initialState // FiberRoot 通过 memoizedState 去保存 state 状态

  /**
   * const queue = {
   *   baseState: fiber.memoizedState,
   *   firstBaseUpdate: null,
   *   lastBaseUpdate: null,
   *   shared: {
   *    pending: null,
   *    lanes: Nolanes,
   *    hiddenCallbacks: null
   *   },
   *   callback: null
   * }
   * 
   * fiber.updateQueue = queue
   */
  initializeUpdateQueue(uninitializedFiber) // 初始化 Fiber 节点的 updateQueue

  return root
}
```

createRoot 最终返回一个 ReactDOMRoot 节点的实例，挂载了 render 方法**可以接受我们自定义的 react 组件，从而进入到后续的整个应用的渲染流程当中，也就是 react 组件的渲染流程**。（我们通过 JSX 或者 createElement 书写的组件实际上是 react 当中的 ReactElement 类型）

初始化阶段实际上是将 ReactElement 和 Fiber 节点绑定的过程；

```javascript
ReactDOMRoot.prototype.render = function(children) {
  const root = this._internalRoot
  updateContainer(children, root, null, null)
}
```

```javascript
// react-reconciler/src/ReactFiberReconciler.js
export function updateContainer(
  element, // ReactElement
  container,
  parentComponent,
  callback
) {
  const current = container.current // 获取 Fiber 节点
  ...
  updateContainerImpl(
    current,
    lance,
    element,
    container,
    parentComponent,
    callback
  )
  ...
}


function updateContainerImpl(
  rootFiber: Fiber,
  lane: Lane,
  element,
  ...
) {
  ...
  const update = createUpdate(lane) // 新建一个 update 更新动作
  update.payload = { element } // 关联需要渲染的 element 
  ...
  const root = enqueueUpdate(rootFiber, update, lane) // 根据 rootFiber 来获取 FiberRoot 节点
  if (root !== null) {
    ...
    scheduleUpdateOnFiber(root, rootFiber, lane) // -----> ensureRootIsScheduled(root)  ----->  scheduleImmediateTask(processRootScheduleInMicrotask) -----> flushSyncWorkAcrossRoots_impl(syncTransitionLanes, false) -----> performSyncWorkOnRoot(root, nextLanes) ------>  performWorkOnRoot(root, lanes, forceSync)
  }
}
```

```javascript
// react-reconciler/src/ReactFiberWorkLoop.js
function performWorkOnRoot(
  root: FiberRoot,
  lanes,
  forceSync
) {
  ...
  let exitStatus = shouldTimeSlice
    ? renderRootConcurrent(root, lanes)
    : renderRootSync(root, lanes, true) // 进入到渲染流程
  ...
}
```

shouldTimeSlice: false -> renderRootSync(root, lanes, true)

beginWork -> 开始渲染 Fiber 节点

初次渲染根节点 updateHostRoot

createChildReconciler(true/false) -> reconcileChildFibers/mountChildFibers

createFiberFromElement -> 通过 ReactElement 来创建 Fiber 节点（节点还没真正的执行渲染）

reconcileChildFibersImpl

通过 ReactElement 来创建新的 Fiber 节点，并将节点标记为 workInProcess，然后开启下一轮的处理

nextChildren = renderWithHooks() 开始执行函数组件 -> 得到子组件的 ReactElement

reconcileChildren(current, workInProgress, nextChildren, renderLanes)

reconcileChildFibers -> 创建子组件的 Fiber 节点 -> 建立起 workInProgress 和子组件 Fiber 节点的父子关系 -> workInProgress.child = mountChildFibers/reconcileChildFibers

performUnitWork（深度优先） -> completeUnitWork（每个 Fiber 节点 render 结束后的执行函数，来开启 siblings Fiber 节点的执行）

每个 function component / host component 都有对应的一个 Fiber Node

reconcileChildFibersImpl

reconcileSingleElement

ReactSharedInternals.H = 
  current === null || current.memoizedState === null
    ? HooksDispatcherOnMount
    : HooksDispatcherOnUpdate

---

**createElement 是创建 ReactElement 的方法，并不是节点真正执行渲染的时机**


---
function ReactDOMRoot(internalRoot: FiberRoot) {
  this._internalRoot = internalRoot
}

ReactDOMRoot.prototype.render = function (children) {
  const root = this._internalRoot
  updateContainer(children, root, null, null)
}

```

createUpdate

```javascript
function createUpdate (lane) {
  const update = {
    lane,
    tag: UpdateState,
    payload: null,
    callback: null,
    next: null
  }
  return update
}
```

1. createContainer