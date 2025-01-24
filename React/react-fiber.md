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
    <div>
      <p>{props.count}</p>
    <div>
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
  const uninitializedFiber = createHostRootFiber(tag, isStrictMode) // 创建第一个 Fiber 节点，即 RootFiber，它的 tag 为 HostRoot，后续 beginWork 也是从这个 HostRoot 开始进行处理
  root.current = uninitializedFiber // 和 FiberRoot 节点建立起联系
  uninitializedFiber.stateNode = root

  ...
  const initialState = { // RootFiber 的初始 state 状态
    element: initialChildren
    ...
  }
  uninitializedFiber.memoizedState = initialState // RootFiber 通过 memoizedState 去保存 state 状态

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
    scheduleUpdateOnFiber(root, rootFiber, lane) 
    // -----> ensureRootIsScheduled(root) 
    // -----> scheduleImmediateTask(processRootScheduleInMicrotask) 
    // -----> flushSyncWorkAcrossRoots_impl(syncTransitionLanes, false)
    // -----> performSyncWorkOnRoot(root, nextLanes)
    // -----> performWorkOnRoot(root, lanes, forceSync)
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

function renderRootSync(
  root: FiberRoot,
  lanes,
  shouldYieldForPrerendering
) {
  ...
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    ...
    prepareFreshStack(root, lanes) // 根据 FiberRoot 来创建全局唯一处理的 Fiber 节点(workInProgress) 来进行递归处理
  }
  ...
  outer: do {
    ...
    workLoopSync() // 以 workInProgress 为全局唯一处理的 Fiber 节点来递归处理 Fiber 节点 
  } while (true)
}

function prepareFreshStack(root: FiberRoot, lanes): Fiber {
  ...
  resetWorkInProgressStack()
  workInProgressRoot = root // FiberRoot
  const rootWorkInProgress = createWorkInProgress(root.current, null) // root.current 实际上就是根 Fiber 节点
  workInProgress = rootWorkInProgress // 目前正在被处理的 Fiber 节点
  ...
  finishQueueingConcurrentUpdates() // 建立起 updateQueue 和 update 之间的联系 updateQueue.next = update
  ...
  return rootWorkInProgress
}

function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress)
  }
}
```

```javascript
// react-reconciler/src/ReactFiber.js
// 创建当前需要被处理的 Fiber 节点
function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  let workInProgress = current.alternate // 是否有之前的 Fiber 节点
  if (workInProgress === null) {
    workInProgress = createFiber(
      current.tag,
      pendingProps,
      current.key,
      current.mode
    )
    workInProgress.elementType = current.elementType
    workInProgress.type = current.type
    workInProgress.stateNode = current.stateNode
    ...
    workInProgress.alternate = current
    current.alternate = workInProgress
  } else { // 如果之前已经创建过 Fiber 节点
    workInProgress.pendingProps = pendingProps
    workInProgress.type = current.type
    ...
  }
  return workInProgress
}
```

依据 FiberRoot 创建一个 RootWorkInProgress 的 Fiber 节点，接下来就由这个 RootFiber 节点来进入到后续的 Fiber 节点递归处理的阶段。

```javascript
// react-reconciler/src/ReactFiberWorkLoop.js
function performUnitOfWork(unitOfWork) {
  const current = unitOfWork.alternate
  let next
  if (enableProfilerTime && (unitOfWork.mode & ProfileMode) !== NoMode) {
    startProfilerTimer(unitOfWork) // 记录这个 Fiber 节点开始处理的时间节点
    next = beginWork(current, unitOfWork, entangledRenderLanes) // 依据这个 Fiber 节点开始处理
    stopProfilerTimerIfRunningAndRecordDuration(unitOfWork) // 记录这个 Fiber 节点本身的处理时间（其实就是这个函数组件本身执行的时间）
  } else {
    ...
  }

  unitOfWork.memoizedProps = unitOfWork.pendingProps
  if (next === null) {
    completeUnitWork(unitOfWork)
  } else {
    workInProgress = next
  }
}
```

```javascript
// react-reconciler/src/ReactFiberBeginWork.js
function beginWork(current, workInProgress, renderLanes) {
  ...
  switch (workInProgress.tag) {
    ...
    case FunctionComponent: { // 处理 Function Component
      const Component = workInProgress.type // 渲染函数
      ....
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        resolvedProps,
        renderLanes
      )
    }
    ...
    case HostRoot: // 开始处理 HostRoot，即 RootFiber 节点
      return updateHostRoot(current, workInProgress, renderLanes)
    case HostComponent: 
      return updateHostComponent(current, workInProgress, renderLanes)
    case HostText:
      return updateHostText(current, workInProgress)
    case ForwardRef: {
      ...
    }
  }
}

/**
 * 核心的工作：对于 RootFiber 来说，主要的功能还是将 render 方法所接受的 ReactElement 转化为一个 Fiber 节点，接下来就是以这个 Fiber 节点为处理入口来开启这个 Fiber 节点绑定的 ReactElement 的渲染流程，也就是整个应用的渲染流程
 */
function updateHostRoot(current, workInProgress, renderLanes) {
  ...
  const nextState = workInProgress.memoziedState // RootFiber 初始化的 state
  const root = workInProgress.stateNode
  ...
  const nextChildren = nextState.element // 对于 RootFiber 来说，第一次更新渲染，element 即保存的是 ReactElement（ReactDOMRoot.render 所接受的 Function Component，ReactElement）
  ...
  reconcileChildren(current, workInProgress, nextChildren, renderLanes)

  return workInProgress.child
}

function updateFunctionComponent(
  current: null | Fiber,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes
) {
  ...
  nextChildren = renderWithHooks( // 实际执行函数组件，获取组件返回的 ReactElement，进入到后续依据 ReactElement 来创建 Fiber 节点的过程
    current,
    workInProgress,
    Component, // function component
    nextProps,
    context,
    renderLanes
  )
  ...
  workInProgress.flags |= PerformedWork
  renconcileChild(current, workInProgress, nextChildren, renderLanes)
  return workInProgress.child
}

function updateHostComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes
) {
  ...
  const type = workInProgress.type
  const nextProps = workInProgress.pendingProps
  const prevProps = current !== null ? current.memoizedProps : null

  let nextChildren = nextProps.children // 这个节点的子元素 ReactElement
  ...
  reconcileChildren(current, workInProgress, nextChildren, renderLanes) // 创建子的 Fiber 节点
  return workInProgress.child
}

function reconcileChildren(current, workInProgress, nextChildren, renderLanes) {
  if (current === null) {
    workInProgress.child = mountChildFibers( // 如果目前的 Fiber 还没有创建，那么就通过 nextChildren（ReactElement）进行关联
      workInProgress,
      null,
      nextChildren,
      renderLanes
    )
  } else {
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren,
      renderLanes
    )
  }
}
```

```javascript
// react-reconciler/src/ReactChildFiber.js
// 创建子节点的 reconciler 
function createChildReconciler(shouldTrackSideEffects) {
  function reconcileChildFibers(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: any,
    lanes
  ) {
    ...
    const firstChildFiber = reconcileChildFibersImpl(
      returnFiber,
      currentFirstChild,
      newChild,
      lanes
    )
    ...
    return firstChildFiber
  }
}

function reconcileChildFibersImpl(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChild,
  lanes
) {
  ...
  if (typeof newChild === 'object' && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE: {
        ...
        const firstChild = placeSingleChild( // 记录 Fiber 节点 flags 副作用的标识
          reconcileSingleElement(
            returnFiber,
            currentFirstChild,
            newChild,
            lanes
          )
        )
        ...
        return firstChild // 返回新建的 Fiber 节点
      }
    }
  }

  // 对于数组类型的 []<ReactElement> 的处理
  /**
   * <div>
   *  <p>1</p>
   *  <p>2</p>
   * </div>
   */
  if (isArray(newChild)) {
    ...
    const firstChild = reconcileChildrenArray(
      returnFiber,
      currentFirstChild,
      newChild,
      lanes
    )
    ...
    return firstChild
  }
}

function reconcileSingleElement(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  element: ReactElement,
  lanes
) {
  const key = element.key
  let child = currentFirstChild
  while (child !== null) {

  }
  
  if (element.type === REACT_FRAGMENT_TYPE) {
    ...
  } else {
    const created = createFiberFromElement(element, returnFiber.mode, lanes) // 根据 ReactElement 来创建 Fiber 节点
    coerceRef(created, element) // 建立 Fiber 节点和 ref 间的联系
    created.return = returnFiber // 通过 return 来建立起新的 Fiber 节点和父 Fiber 节点之间的联系
    return created
  }
}

function reconcileChildrenArray(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChildren: Array<any>,
  lanes
): Fiber | null {
  ...
  let resultingFirstChild: Fiber | null = null
  let previousNewFiber: Fiber | null = null

  let oldFiber = currentFirstChild
  let lastPlacedIndex = 0
  let newIdx = 0
  let nextOldFiber = null

  if (oldFiber === null) {
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = createChild(returnFiber, newChildren[newIdx], lanes)
      ...
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber
      } else {
        previousNewFiber.sibling = newFiber // 将 Array<ReactElement> 转化为 Fiber.sibling = Fiber 链表关系，当一个 Fiber 节点处理完，且没有子节点的话，就进入到了 sibling 兄弟节点的处理过程
      }
      previousNewFiber = newFiber
    }
    return resultingFirstChild
  }
}
```

```javascript
// react-reconciler/src/ReactFiberHooks.js
// 执行 function component，获取接下来要被渲染的 ReactElement
function renderWithHooks(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (p: Props, arg: SecondArg) => arg,
  props: Props,
  secondArg: SecondArg
) {
  ...
  currentlyRenderingFiber = workInProgress // 将当前的 Fiber 节点标记为 currentlyRenderingFiber

  workInProgress.memoizedState = null
  workInProgress.updateQueue = null

  ...
  // 使用的 Hook 类型
  ReactSharedInternals.H = 
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate
  
  let child = __DEV__
    ? callComponentInDEV(Component, props, secondArg)
    : Component(props, secondArg) // 执行 function component，得到返回的 ReactElement
  
  finishRenderingHooks(current, workInProgress, Component)

  return children // 返回 ReactElement
}
```

对于 FiberRoot 而言，通过 updateHostRoot 创建了**第一个自定义组件**所对应的 Fiber 节点，接下来也就是由这个 Fiber 节点来开启整个应用的渲染流程(`performUnitOfWork`)：

Fiber -> renderWithHooks -> ReactElement -> Fiber -> renderWithHooks -> ReactElement -> Fiber -> ...

这里以最开始的 app.js 当中的 function component 为例，它的最终执行结果就是返回了一个 `ReactElement`，子组件 `component-a`（同样也是 ReactElement，子组件还没执行 render）都挂载到了 `props.children` 属性上，接下里也就会为这个 ReactElement 创建对应的 Fiber 节点（和元素 `p` 标签对应），不过这个 Fiber 节点和其他 Function Component (`fiberTag = FunctionComponent`)特殊的地方在于 `fiberTag = HostComponent`，后续进入到这个 Fiber 节点处理的过程中，实际也就进入了 `updateHostComponent` 处理过程。

当所有的 Fiber 节点完成了 renderWithHooks 之后（`performUnitOfWork`），然后由下向上反向的再次遍历 Fiber 节点（`completeUnitOfWork`），当前 Fiber 节点遍历完成后，再遍历其 sibling 节点，和 renderWithHooks 节点（深度优先）的遍历流程不一致：

```javascript
function completeUnitOfWork(unitOfWork: Fiber): void {
  let completedWork: Fiber = unitOfWork
  do {
    ...
    const current = completedWork.alternate
    const returnFiber = completedWork.return

    let next
    ...
    next = completeWork(current, completedWork, ...)
    if (next !== null) {
      workInProgress = next
      return
    }

    const siblingFiber = completedWork.sibling
    if (siblingFiber !== null) {
      workInProgress = siblingFiber
      return
    }

    completedWork = returnFiber
    workInProgress = completedWork
  } while (completedWork !== null)

  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootCompleted
  }
}
```

那么在 compeleteUnitOfWork 的流程当中，主要完成的工作是依据 Fiber 节点去创建 HostComponent(真实的 dom 节点)，并将子 dom 节点挂载到父 dom 节点上，同时完成一系列的数据收集工作（例如 flags、组件的 render 时长 actualDuration 数据等）：

```javascript
// react-reconciler/src/ReactFiberCompleteWork.js
function completeWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
) {
  const newProps = workInProgress.pendingProps // 接受到的所有的 props，包括 children
  popTreeContext(workInProgress)
  switch (workInProgress.tag) {
    ...
    case FunctionComponent:
    case ForwardRef:
    case Profiler:
    case MemoComponent:
      bubbleProperties(workInProgress)
      return null
    case HostRoot: {
      const fiberRoot = workInProgress.stateNode
      ...
    }
    case HostComponent: {
      popHostContext(workInProgress)
      const type = workInProgress.type
      ...
      const currentHostContext = getHostContext()
      ...
      const rootContainerInstance = getRootHostContainer()
      const instance = createInstance( // createInstance 会直接创建真实 dom 节点
        type,
        newProps,
        rootContainerInstance,
        currentHostContext,
        workInProgress
      )
      ...
      appendAllChildren(instance, workInProgress, false, false) // 通过 Fiber 节点找到子 Fiber 节点上挂载的真实的 dom 节点，并通过 document.appendChild 将子的 dom 节点挂载到当前节点
      workInProgress.stateNode = instance // 在这里建立 Fiber 节点和 HostComponent（即 dom element）的联系，web 场景下其实就是 dom 元素
      ...
      bubbleProperties(workInProgress) // 将子 Fiber 节点的一些数据进行冒泡，合并到当前的 Fiber 节点上，例如收集这个 Fiber 节点的 render 时长（actualDuration），这个数据是需要包含这个 Fiber 节点所有子 Fiber 节点的 render 时长的。
      ...
      return null
    }
  }
}
```



Dispatcher -> 是什么作用？

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

performUnitOfWork（深度优先） -> completeUnitWork（每个 Fiber 节点 render 结束后的执行函数，来开启 siblings Fiber 节点的执行）

每个 function component / host component 都有对应的一个 Fiber Node

reconcileChildFibersImpl

reconcileSingleElement

ReactSharedInternals.H = 
  current === null || current.memoizedState === null
    ? HooksDispatcherOnMount
    : HooksDispatcherOnUpdate

---

**createElement 是创建 ReactElement 的方法，并不是节点真正执行渲染的时机**

commitRootWhenReady

commitRoot

commitRootImpl

// the next phase is the mutation phase, where we mutate the host tree
commitMutationEffects

commitMutationEffectsOnFiber

commitReconciliationEffects

flushPassiveEffects

flushPassiveEffectsImpl

commitPassiveMountEffects

commitPassiveMountOnFiber

commitHookEffectListMount

---------


