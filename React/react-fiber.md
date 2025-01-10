1. createRoot // react-dom/src/client/ReactDOMRoot.js
  
```javascript
function createRoot() {
  ...
  const root = createContainer(container, ...args) // 创建一个 FiberRootNode 节点，并和 dom element 进行关联 
  // FiberRoot 和 Fiber 节点并不是同一种数据结构类型
  return new ReactDOMRoot(root)  // 返回一个 ReactDOMRoot 节点示例，暴露了 render 方法，可以接受 function component 进行渲染
}


const initailState: RootState = {
  element: initialChildren
  ...
}

initializeUpdateQueue

ensureRootIsScheduled(root: FiberRoot)

firstScheduledRoot = lastScheduledRoot = root

didScheduleMicrotask = true

scheduleImmediateTask(processRootScheduleInMicrotask)

flushSyncWorkAcrossRoots_impl

performWorkOnRoot(root: FiberRoot, lanes: Lanes, forceSynv: boolean)

shouldTimeSlice: false -> renderRootSync(root, lanes, true)

beginWork -> 开始渲染 Fiber 节点

初次渲染根节点 updateHostRoot

reconcileChildFibers

createFiberFromElement -> 创建 Fiber 节点（节点还没真正的执行渲染）

reconcileChildFibersImpl

通过 ReactElement 来创建新的 Fiber 节点，并将节点标记为 workInProcess，然后开启下一轮的处理

renderWithHooks() 开始执行函数组件 -> 获取 ReactElement -> reconcileChildFibers -> 创建 Fiber 节点

ReactSharedInternals.H = 
  current === null || current.memoizedState === null
    ? HooksDispatcherOnMount
    : HooksDispatcherOnUpdate


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