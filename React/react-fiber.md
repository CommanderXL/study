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
import { createElement, useState, useEffect } from 'react'
import componentA from './component-a.js'
function app() {
  const [count, setCount] = useState(1)
  return createElement('div', null, createElement(componentA, { count }))
}

export default app

// component-a.js
function componentA(props) {
  const [cls, setCls] = useState('normal')
  const [show, setHide] = useState(true)
  useEffect(() => {
    // do something
    setTimeout(() => {
      setCls('highlight')
      setHide(false)
    }, 2000)
  }, [])
  return (
    <div>
      <p class={cls}></p>
      <p>{props.count}</p>
      {
        show ? <p>text</p> : ''
      }
    <div>
  )
}
export default componentA
```

## Render 阶段

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

这个 RootFiber(HostRootFiber) 完全是个虚拟的根 Fiber 节点，可以简单理解为一个 react 应用是由 RootFiber(HostRootFiber) 来构建整个 Fiber Tree，整个 Fiber Tree 的处理流程也是由这个虚拟的 RootFiber(HostRootFiber) 开始。RootFiber.render 方法所接受的 Function Component 所创建的 Fiber 节点实际上也就是这个 FiberRoot 的子节点(FiberRoot.child = Function Component(对应的 Fiber 节点))。

```javascript

// react-reconciler/src/ReactFiberRoot.js
function createContainer() {
  const root = new FiberRootNode(...)
  ...
  const uninitializedFiber = createHostRootFiber(tag, isStrictMode) // 创建第一个 Fiber 节点，即 RootFiber，它的 tag 为 HostRoot，后续 beginWork 也是从这个 HostRoot 开始进行处理 -> createFiber(HostRoot, null, null, mode)
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

createRoot 最终返回一个 ReactDOMRoot 节点的实例，挂载了 render 方法**可以接受我们自定义的 react 组件，从而进入到后续的整个应用的渲染流程当中，也就是 react 组件的渲染流程**。（我们通过 JSX 或者 createElement 书写的组件实际上是 react 当中的 ReactElement 类型，每个 Function Component 都会返回一个 ReactElement，最终会通过 ReactElement 创建 Fiber 节点）

```javascript
// src/jsx/ReactJSXElement.js

function ReactElement(
  type,
  key,
  ...
) {
  ...
  let element

  element = {
    $$typeof: REACT_ELEMENT_TYPE,

    // Built-in properties that belong on the element
    type, //  function or string or object （例如对于函数组件来说，这个 type 就是实际的函数组件的定义）
    key,
    ref,
    props // 包含了 children，子节点
  }

  return element
}
```

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
    workInProgress.alternate = current // 建立起新久 Fiber 节点间的联系
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

beginWork 实际上就是即将进入到 Fiber 节点的处理阶段，首先会对 Fiber 节点所接受到的属性以及 context 做一次判断，如果发现不一样的话会初次记录 `didReceiveUpdate`，用以后续决定...

```javascript
// react-reconciler/src/ReactFiberBeginWork.js
function beginWork(
  current, // 当前被遍历的 Fiber 节点，这个节点实际上是上次被渲染的
  workInProgress, // 当前处理的 Fiber 节点，即将要被渲染的
  renderLanes
) {
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
  const nextProps = workInProgress.pendingProps
  const prevState = workInProgress.memoizedProps
  const prevChildren = prevState.element // 之前的 ReactElement（如果不是 render 函数重新接受一个 app 组件，prevChildren 和 nextChildren 实际还是一样的）
  ...
  const nextState = workInProgress.memoziedState // RootFiber 初始化的 state
  const root = workInProgress.stateNode
  ...
  const nextChildren = nextState.element // 对于 RootFiber 来说，第一次更新渲染，element 即保存的是 ReactElement（ReactDOMRoot.render 所接受的 Function Component，ReactElement）
  ...
  if (nextChildren === prevChildren) {
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes)
  }
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
// 创建子节点的 reconciler，需要特别关注 shouldTrackSideEffects 这个参数，会决定在处理 Fiber 节点的过程中是否需要收集 effect 
function createChildReconciler(shouldTrackSideEffects) {
  ...
  function reconcileSingleTextNode(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    textContext: string,
    lanes: Lanes
  ): Fiber {
    ...
    // 创建 text Fiber 节点
    const created = createFiberFromText(textContent, returnFiber.mode, lanes)
    created.return = returnFiber
    ...
    return created
  }

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

  // 处理文本内容节点 <p>texttext</p>
  if (
    (typeof newChild === 'string' && newChild !== '') ||
    typeof newChild === 'number' ||
    typeof newChild === 'bigint'
  ) {
    return placeSingleChild(
      reconcileSingleTextNode(
        returnFiber,
        currentFirstChild,
        '' + newChild,
        lanes
      )
    )
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
    coerceRef(created, element) // 将 props 接收到的 ref 属性挂载到 Fiber 节点 
    created.return = returnFiber // 通过 return 来建立起新的 Fiber 节点和父 Fiber 节点之间的联系
    return created
  }
}

// 通过 props 接受到的 ref 属性挂载到 Fiber 节点上
function coerceRef(workInProgress: Fiber, element: ReactElement): void {
  const refProp = element.props.ref
  workInProgress.ref = refProp !== undefined ? refProp : null
}

function createFiberFromElement() {

}

function createFiberFromText() {

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

  // 重置当前组件的部分属性
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

事实上在 Function Component 的 render 阶段同步完成了 effect 的收集工作（例如在函数组件内部调用的 useEffect）。

```javascript
// react-reconciler/src/ReactFiberHooks.js
function mountEffect(
  create: () => (() => void) | void,
  deps
) {
  mountEffectImpl(
    PassiveEffect | PassiveStaticEffect, // 需要关注这里，通过 useEffect 方法注册的 effect 方法会给这个 Fiber 节点打上 PassiveEffect | PassiveStaticEffect 的标记，这个标记会在 commit 阶段来决定这个 Fiber 节点是否有 effect 函数需要执行
    HookPassive,
    create,
    deps
  )
}

function mountEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps
) {
  const hook = mountWorkInProgressHook() // 新建一个 hook list，也是链表结构
  const nextDeps = deps === undefined ? null : deps
  currentlyRenderingFiber.flags |= fiberFlags // !!! 更新这个 Fiber 节点的 flags，用于后续 commit 阶段 effect 函数的执行
  hook.memoizedState = pushSimpleEffect(
    hookHasEffect | hookFlags,
    createEffectInstance(),
    create,
    nextDeps
  )
}

function pushSimpleEffect(
  tag,
  inst,
  create,
  deps
) {
  const effect = {
    tag,
    create,
    deps,
    inst,
    next
  }
  return pushEffectImpl(effect)
}

// !!! effect function list 是一种单向闭合链表的数据结构
function pushEffectImpl(effect) {
  ...
}
```

对于 FiberRoot 而言，通过 updateHostRoot 创建了**第一个自定义组件**所对应的 Fiber 节点，接下来也就是由这个 Fiber 节点来开启整个应用的渲染流程(`performUnitOfWork`)：

Fiber -> renderWithHooks -> ReactElement -> Fiber -> renderWithHooks -> ReactElement -> Fiber -> ...

简单解释下就是：一个 Function Component 对应一个 Fiber 节点，Function Component 执行返回的 ReactElement 是用来创建这个 Fiber 节点的子 Fiber 节点。（todo: 这里对于 Fiber 节点的理解，Fiber 节点和 Function Component 之间的关系）

即：Function Component 执行返回 ReactElement，react 内部会依据这个 ReactElement 去创建 Fiber 节点，进而继续进入到后续的这个 Fiber 节点的处理。

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
      /**
       * 收集子节点的 effect 标记：
       *  subtreeFlags |= child.subtreeFlags
       *  subtreeFlags |= child.flags
       * 
       *  child.return = completedWork
       *  child = child.sibling
       * 
       * completedWork.subtreeFlags |= subtreeFlags // 收集子节点的标记
       */
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
      
      if (current !== null && workInProgress.stateNode != null) { // 对于二次更新的情况
        updateHostComponent(
          current,
          workInProgress,
          type,
          newProps,
          renderLanes
        )
      } else { // 对于 HostComponent 节点初次渲染的情况
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

        appendAllChildren(instance, workInProgress, false, false) // 对于初始化的应用来说，通过 Fiber 节点找到子 Fiber 节点上挂载的真实的 dom 节点，并通过 document.appendChild 将子的 dom 节点挂载到当前节点，这个时候每个 Fiber 节点的 stateNode 已经是挂载了所有子节点的 dom 节点
        workInProgress.stateNode = instance // 在这里建立 Fiber 节点和 HostComponent（即 dom element）的联系，web 场景下其实就是 dom 元素
        ...
      }

      bubbleProperties(workInProgress) // 将子 Fiber 节点的一些数据进行冒泡，合并到当前的 Fiber 节点上，例如收集这个 Fiber 节点的 render 时长（actualDuration），这个数据是需要包含这个 Fiber 节点所有子 Fiber 节点的 render 时长的。
      ...
      return null
    }
  }
}

function bubbleProperties(completedWork) {
  const didBailout = 
    completedWork.alternate !== null &&
    completedWork.alternate.child === completedWork.child

  if (!didBailout) { // 如果这个节点重新进行了 render（和之前的节点对比发现不一样）

  } else {
    ...
  }
  return didBailout
}

function updateHostComponent(
  current: Fiber,
  workInProgress: Fiber,
  type: Type,
  newProps
) {
  if (supportsMutations) {
    const oldProps = current.memoizedProps
    if (oldProps === newProps) {
      return
    }
    markUpdate(workInProgress)
  }
  ...
}

function markUpdate(workInProgress) {

}
```

## Commit 阶段

那么经过2次遍历的操作（beginWork、completeWork），就可以将 Fiber 节点所对应的 DOM 节点创建并关联起来了（fiber.stateNode = domNode），最终整个 Fiber Tree 也有记录了每个 hostComponent 的需要变更的操作，接下来就回到 `performWorkOnRoot` 方法当中，进入到后续的 commit 阶段（commit 阶段核心有2个触发 effect 的时间节点：mutation、layout）：

```javascript
function renderRootSync() {
  ....

  workInProgressRoot = null // 全局置空
  workInProgressRootRenderLanes = Nolanes

  // It's safe to process the queue now that the render phase is complete
  finishQueueingConcurrentUpdates()
}

function performWorkOnRoot(root, lanes, forceSync) {
  ...
  finishConcurrentRender(
    root,
    exitStatus,
    finishedWork,
    lanes,
    renderEndTime
  )

  // -> commitRootWhenReady
  // -> commitRoot
  // -> commitRootImpl
}

function commitRootImpl(...) {
  ...
  const finishedWork = root.finishedWork // 从 FiberRoot 获取 finishedWork(Fiber) 实际就是 FiberRoot 节点
  ...
  const subtreeHasEffects = // 当前节点是否记录了子节点的 effect 操作
    (finishedWork.subtreeFlags &
      (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !== NoFlag
  const rootHasEffect = // 看当前节点本身是否需要执行一些 effect 操作
    (finishedWork.flags &
      (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !== NoFlag
  
  if (subtreeHasEffects || rootHasEffect) {
    ...
    // The next phase is the mutation phase, where we mutate the host tree.
    // 主要完成的工作是:
    /**
     * 1. Host Component 节点的添加or删除
     * 2. （函数组件）触发 HookInsertion effect（unmount、mount 阶段）
     * 3. （函数组件）触发 HookLayout effect（unmount 阶段）
     * 
     * */

    /**
     * 另外需要特别注意的是不同的 hook 类型执行的时机也会有差异，依次为：
     * HookInsertion
     * HookLayout
     * HookPassive
     */
    commitMutationEffects(root, finishedWork, lanes) // 将 render 记录的 Fiber 节点操作开始进行 commit 操作
    ...
    root.current = finishedWork

    // -> safelyAttachRef -> 和 HostComponent 建立 ref 关系，即调用绑定到 HostComponent 上的 ref 函数
    ...
    // HookLayout effect 在 mutation 阶段后 之后
    commitLayoutEffects(finishedWork, root, lanes) // 触发带有 Update flag 的 Fiber 节点上 Hook 当中带有 HookLayout 类型的 effect 函数，例如通过 useImperativeHandle 创建的带有 effect 函数的 hook 及 useLayout hook api 等

    ...
    if (inlcudesSyncLane(pendingPassiveEffectsLanes) && 
    (disableLegacyMode || root.tag !== LegacyRoot)) {
      flushPassiveEffects() // 开始执行 passive effect
    }

    ...
  }
}

function commitMutationEffects(root, finishedWork, commitedLanes) {
  inProgressLanes = commitedLanes
  inProgressRoot = root

  commitMutationEffectsOnFiber(finishedWork, root, commitedLanes)

  inProgressLanes = null
  inProgressRoot = null
}

// 从 FiberRoot 根节点开始深度递归进行 commitMutationEffectsOnFiber，完成节点的删除、插入等一系列的操作 commit 操作
function commitMutationEffectsOnFiber(finishedWork, root, lanes) { 
  ...
  const current = finishdWork.alternate
  const flags = finishedWork.flags

  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent:
      recursivelyTraverseMutationEffects(root, finishedWork, lanes)
      commitReconciliationEffects(finishedWork)

      if (flags & Update) { // 如果有 Update flag
        commitHookEffectListUnmount(
          HookInsertion | HookHasEffect, // 目前 HookInsertion 只在 useInsertionEffect 这个 hook api 当中使用到了
          finishedWork,
          finishedWork.return
        )
        commitHookEffectListMount(HookInsertion | HookHasEffect, finishedWork)
        commitHookLayoutUnmountEffects(
          finishedWork,
          finishedWork.return,
          HookLayout | HookHasEffect // useImperativeHandle、useLayout 这2个 hook api 当中使用到了
        )
      }
      break
    case HostRoot: {
      ...
      recursivelyTraverseMutationEffects(root, finishedWork, lanes)
      commitReconciliationEffects(finishedWork) 
    }
    case HostComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes) // 先进行节点的删除操作
      commitReconciliationEffects(finishedWork) // 再进行节点的添加操作
      ...
    }
  }
}

function recursivelyTraverseMutationEffects(root, parentFiber, lanes) {
  // 如果有节点删除的情况，先处理节点删除，这样就不需要再递归调用这个节点的子节点的 mutationEffects
  const deletions = parentFiber.deletions
  if (deletions !== null) {
    for (let i = 0; i < deletions.length; i++) {
      const childToDelete = deletions[i]
      commitDeletionEffects(root, parentFiber, childToDelete)
    }
  }

  // 每个 Fiber 节点还保存了子节点的标记，用来判断是否需要进行 commitMutationEffects
  if (parentFiber.subtreeFlags &
    (enablePersistedModeClonedFlag ? MutationMask | Cloned : MutationMask)) {
      let child = parentFiber.child
      while (child !== null) {
        commitMutationEffectsOnFiber(child, root, lanes)
        child = child.sibling
      }
    }
}

// 节点的插入等操作
function commitReconciliationEffects(finishedWork) {
  const flags = finishedWork.flags // 如果 Fiber 节点上打了 Placement 标记，那么会在这个节点完成将 Fiber 节点关联的 HostComponent 挂载到父节点上，打标记的过程实际上是在 render 阶段完成的
  // 对于 FiberRoot.render 接受到的一个Function Component对应的 Fiber 节点来说，在初次渲染的阶段就会打上 Placement 的标记（具体见 ReactChildFiber.js 当中的 placeSingleChild 方法）
  if (flags & Placement) {
    commitHostPlacement(finishedWork)
    finishedWork.flags &= ~Placement // 清空标记
  }
}

function commitHostPlacement(finishedWork) {
  ...
  commitPlacement(finishedWork)
}

function commitPlacement(finishedWork) {
  // Recursively insert all host nodes into the parent.
  const parentFiber = getHostParentFiber(finishedWork) // 获取父 Fiber 及对应的 stateNode，完成节点的插入
  switch (parentFiber.tag) {
    case HostComponent: {
      ...
    }
    case HostRoot: {
      const parent = parentFiber.stateNode.containerInfo // 获取 HostRoot 对应的容器元素，也就是需要绑定的根 DOM 节点
      const before = getHostSibling(finishedWork) // 兄弟节点，方便后续的插入
      insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent)
      break
    }
  }
}
```

至此一个 React 应用的 render + commit （host tree mutation 阶段）阶段就完成了，也完成了试图最终的展示（即 dom 节点插入到 document 文档当中），那么在示例代码 component-a 当中调用的 `useEffect` 方法，我们都知道可以通过 `useEffect(() => { // do something }, [])` 去模拟组件的 mount 挂载的流程（只会执行一次）。那么 useEffect 接受到的第一个 effect function 是在什么时候执行的呢？还是回到 `commitRootImpl` 方法内部后续会调用 `flushPassiveEffects()` 方法：

```javascript
function flushPassiveEffects() {
  ...
  return flushPassiveEffectsImpl()
  ...
}

function flushPassiveEffectsImpl() {
  ...
  commitPassiveUnmountEffects(root.current)
  commitPassiveMountEffects(
    root,
    root.current,
    lanes,
    ...
  )
}

function commitPassiveMountEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  ...
) {
  resetComponentEffectTimers()

  commitPassiveMountOnFiber(
    root,
    finishedWork
    ....
  )
}

// 深度遍历子 Fiber 节点，如果 Fiber 节点记录的 passive 的标记，那么也就会执行 passive effects（例如在函数组件内部调用了 useEffect）
function commitPassiveMountOnFiber(
  finishedRoot: FiberRoot,
  finishedWork: Fiber,
  ...
) {
  const flags = finishedWork.flags // 获取当前 Fiber 节点的标记
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent: {
      recursivelyTraversePassiveMountEffects(
        finishedRoot,
        finishedWork,
        committedLanes,
        committedTransitions,
        endTime
      )
      if (flags & Passive) {
        commitHookPassiveMountEffects(
          finishedWork,
          HookPassive | HookHasEffect // 需要触发的 hook 标记
        )
      }
      break
    }
    case HootRoot: {
      recursivelyTraversePassiveMountEffects(
        finishedRoot,
        finishedWork,
        committedLanes,
        committedTransitions,
        endTime,
      )
      ...
    }
    case Profiler: {
      // do something
    }
    ...
  }
}

function commitHookPassiveMountEffects(finishedWork, hookFlags) {
  ...
  commitHookEffectListMount(hookFlags, finishedWork)
}

function commitHookEffectListMount(flags, finishedWork) {
  try {
    const updateQueue = finishedWork.updateQueue // 保存了所有的 effect 函数，单向闭合链表
    const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null
    if (lastEffect !== null) {
      const firstEffect = lastEffect.next
      let effect = firstEffect
      do {
        if ((effect.tag & flags) === flags) {
          // Mount
          let destroy

          ...
          const create = effect.create
          const inst = effect.inst
          destroy = create() // effect 函数执行
          inst.destroy = destroy
        }
        effect = effect.next // 找到下一个 effect 函数依次执行
      } while (effect !== firstEffect) // 直到这个 effect 函数和 firstEffect 相同就代表了所有的 effect 函数执行完成了（在上面的 useEffect 当中也说明了 Fiber 节点是通过单向闭合的链表来保存所有的 effect 函数，所以最后一个 effect 函数的 next 指向了第一个 effect 函数）
    }
  }
}
```


## 二次更新

### 节点属性的更新

在上面的 demo 示例当中，`component-a` 过 2s 后会调用 `setCls` 方法来重新设置值（有关 `useState` 触发更新的操作见 react-api 相关的内容），开启组件更新及视图更新的操作。

在触发 `setState` 的过程当中有个很关键的地方就是会创建一个 lane 值（对于 lane 值的比较也会决定组件是否需要更新的操作）：

```javascript
// react-reconciler/src/ReactFiberHooks.js
function dispatchSetState(
  fiber,
  queue,
  action
) {
  ...
  const lane = requestUpdateLane(fiber) // lane = 1 这个新创建的 lane 值会伴随这次的更新操作
  ...
  // -> dispatchSetStateInternal
  // -> enqueueConcurrentHookUpdate
  // -> getRootForUpdatedFiber -> 依据这个 Fiber 节点向上遍历找到 FiberRoot
  // -> scheduleUpdateOnFiber
  // -> ensureRootIsScheduled(root)
  // -> processRootScheduleInMicrotask
  // -> flushSyncWorkAcrossRoots_impl
  // -> performSyncWorkOnRoot
  // -> renderRootSync
}
```

setState 是在 component-a 组件当中触发，接下来会通过这个 Fiber 节点向上遍历去找到整个 Fiber Tree 的根节点 FiberRoot，由 FiberRoot 节点作为新一轮更新操作的起始节点。

由于是一次新的更新操作，会通过 `prepareFreshStack(root, lanes)` 来新建 `workInProgress` 节点，同时在这个方法内部有一个非常重要的操作：**给当前 Fiber 节点设置 lanes 值，此外从当前的 Fiber 节点向上依次遍历，来给父 Fiber 节点设置 childLanes 的值。**

```javascript
function prepareFreshStack() {
  ...
  finishQueueingConcurrentUpdates()
  ...
}

// react-reconciler/src/ReactFiberConcurrentUpdates.js
function finishQueueingConcurrentUpdates() {
  // 一方面是完成 hook queue 和 update 之间的联系，在遍历到触发更新的 Fiber 节点的时候就可以知道这次 update 是进行的什么样的操作了
  ...
  if (lane !== NoLane) { // 本次更新的 lane 为 1
    markUpdateLaneFromFiberToRoot(fiber, update, lane)
  }
  ...
}

function markUpdateLaneFromFiberToRoot(sourceFiber, update, lane) {
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane) // 更新发生更新的 Fiber 节点的 lanes 值
  let alternate = sourceFiber.alternate
  if (alternate !== null) {
    alternate.lanes = mergeLanes(alternate.lanes, lane)
  }

  ...
  // 从这个节点向上遍历，依次找到父 Fiber 节点，并设置 childLanes 的值（如果有值，就说明其子节点可能存在更新操作，那么在 Fiber 节点需要进行遍历的操作）；
  let parent = sourceFiber.return
  let node = sourceFiber
  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane)
    alternate = parent.alternate
    if (alternate !== null) {
      alternate.childLanes = mergeLanes(alternate.childLanes, lane)
    }
    ...

    node = parent
    parent = parent.return
  }
  ...
}
```

接下来进入 `workLoopSync -> performUnitOfWork -> beginWork` 方法，在上文当中也说了这个方法内部会进入到真实的 Fiber 节点的处理阶段，但是在方法内部的**前置阶段会进行 Fiber 节点是否需要更新的方法判断**。

```javascript
function beginWork(
  current,
  workInProgress,
  renderLanes
) {
  if (current !== null) { // 当前需要被操作的 Fiber 节点
    const oldProps = current.memoizedProps // 上一次的 props
    const newProps = workInProgress.pendingProps // 这一次的 props

    if (
      oldProps !== newProps || // 判断 props 是否发生了变化，如果发生了变化，那么这个组件会重新触发 render（函数组件）
      hasLegacyContextChanged() 
    ) {
      didReceiveUpdate = true
    } else {
      // Neither props nor legacy context changes. Check if there's a pending
      // update or context change.
      // 如果 props 没有发生变化，那么会检查是否有 update 操作或者是 context 发生了变化
      // 例如调用 setState 方法的组件内部就会新建一个 update 操作，这不过这个方法内部是通过 lanes 来进行标识判断的
      const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(
        current,
        renderLanes
      )

      if (
        !hasScheduledUpdateOrContext &&
        (workInProgress.flags & DidCapture) === NoFlags
      ) {
        didReceiveUpdate = false
        // 如果这个节点 props, context 都没有变化且没有 update 操作，那么也就会 bail out 跳过这个节点的处理，其子节点也都会跳过（也就是说不会完成遍历和 render 等操作）
        return attemptEarlyBailoutIfNotScheduledUpdate(
          current,
          workInProgress,
          renderLanes
        )
      }

      if ((current.flags & ForceUpdateForLegacySuspense) !== NoFlags) {
        didReceiveUpdate = true
      } else {
        didReceiveUpdate = false
      }
    }
  } else {
    didReceiveUpdate = false
  }
}

function checkScheduledUpdateOrContext(current, renderLanes) {
  const updateLanes = current.lanes
  if (includesSomeLane(updateLanes, renderLanes)) { // 如果当前 Fiber 节点的 lanes 为 renderLanes，就代表这个 Fiber 节点有 update 操作
    return true
  }

  // 判断 context 是否发生了变化
  if (enableLazyContextPropagation) {
    const dependencies = current.dependencies
    if (dependencies !== null && checkIfContextChanged(dependencies)) {
      return true
    }
  }
  return false
}

function attemptEarlyBailoutIfNoScheduledUpdate(
  current,
  workInProgress,
  renderLanes
) {
  ...
  // 在实际进行 bailout 操作前，还需要判断子 Fiber 节点需要进行遍历的操作
  return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes)
}

function bailoutOnAlreadyFinishedWork(
  current,
  workInProgress,
  renderLanes
) {
  if (current !== null) {
    workInProgress.dependencies = current.dependencies
  }
  ...
  // 判断 childLanes 来看子节点是否有 update 操作，如果没有的话，会看子节点是否存在 context 的变化，如果没有也就代表子节点不需要做相关的操作
  // Check if the children have any pending work.
  if (!includesSomeLanes(renderLanes, workInProgress.childLanes)) {
    // The children don't have any work either. We can skip them.
    // TODO: Once we add back resuming, we should check if the children are
    // a work-in-progress set. If so, we need to transfer their effects.

    if (enableLazyContextPropagation && current !== null) {
      // Before bailing out, check if there are any context changes in
      // the children.
      lazilyPropagateParentContextChanges(current, workInProgress, renderLanes);
      if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
        return null; // 子节点也不存在 context 的变化，那么也就意味着子 Fiber 节点没有任何的更新，那么进行到这里也就说明当前的 Fiber 节点可以 bail out
      }
    } else {
      return null;
    }
  }

  // 如果发现子节点有更新的操作，那么直接返回 child 子节点进入后续的处理流程当中，而当前的节点不需要进行 render 等操作来获取子 ReactElement 及对应的 Fiber 节点
  // This fiber doesn't have work, but its subtree does. Clone the child
  // fibers and continue.
  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}
```


```javascript
// react-reconciler/src/ReactChildFiber.js
function cloneChildFibers(current, workInProgress) {
  let currentChild = workInProgress.child
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps)
  workInProgress.child = newChild

  newChild.return = workInProgress
  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling
    newChild = newChild.sibling = createWorkInProgress(
      currentChild,
      currentChild.pendingProps
    )
    newChild.return = workInProgress
  }
  newChild.sibling = null
}
```

而在我们一开始的示例 demo 当中，我们通过调用 `setCls` 方法来更新 `p` 节点上的 class 属性，那么 Fiber 节点的操作如何最终反应到真实的 dom 节点上呢？

上文也提到了 `component-a` 通过 `setCls` 派发了一次 update 操作，整个 Fiber Tree 遍历到这个节点的时候会进入 `updateFunctionComponent` 阶段重新对这个 function component 进行 render 生成新的 ReactElement 子节点并进入到 `reconcileChilden`

```javascript
function updateFunctionComponent(
  current,
  workInProgress,
  Component,
  nextProps,
  renderLanes
) {
  ...
  nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    context,
    renderLanes
  )
  ...
  reconcileChildren(current, workInProgress, nextChildren, renderLanes)
  return workInProgress.child
}
```

```javascript
// react-reconciler/src/ReactChildFiber.js
function createChildReconciler(shouldTrackSideEffects) {
  ...
  function useFiber(fiber, pendingProps) {
    const clone = createWorkInProgress(fiber, pendingProps)
    clone.index = 0
    clone.sibling = null
    return clone
  }
  ...
  function reconcileSingleElement(
    returnFiber,
    currentFirstChild,
    element,
    lanes
  ) {
    const key = element.key
    let child = currentFirstChild
    while (child !== null) {
      if (child.key === key) {
        const elementType = element.type
        ...
        if (child.elementType === elementType || ...) {
          deleteRemainingChildren(returnFiber, child.sibling)
          const exitsing = useFiber(child, element.props) // 之前的 Fiber 节点存在，那么直接复用之前的 Fiber 节点，只不过会传入最新的 props 的值，因为进入到 reconcileChildren 阶段也就是组件重新进行了 render 获取到了最新的 ReactElement，因此传入到子组件的 props 也都是最新的
          coerceRef(existing, element)
          existing.return = returnFiber
          ...
          return existing
        }
    }
  }
}
```

那么对于 `p` 节点所对应的 Fiber 节点来说，遍历到这个节点的时候，在 beginWork 初期就判断 `oldProps !== newProps`，因此就进入到了 `updateHostComponent` 阶段，正好这个节点没有子 Fiber 节点需要处理，那么进入到 `completeUnitOfWork(unitOfWork) -> completeWork` 阶段，

```javascript
function completeWork(
  current,
  workInProgress,
  renderLanes
) {
  const newProps = workInProgress.pendingProps
  ...
  switch (workInProgress.tag) {
    ...
    case HostComponent: {
      const type = workInProgress.type
      // 如果当前的 Fiber 节点和 dom 节点都存在
      if (current !== null && workInProgress.stateNode != null) {
        updateHostComponent(
          current,
          workInProgress,
          type,
          newProps,
          renderLanes
        )
      } else {
        ... // 生成新的 host component（dom）节点
      }
    }
  }
}

function updateHostComponent(
  current,
  workInProgress,
  type,
  newProps,
  renderLanes
) {
  if (supportsMutation) {
    const oldProps = current.memoziedProps
    if (oldProps === newProps) {
      return
    }

    // 如果新旧2个 Fiber 节点（Host Component 类型）的 props 不一致，那么就会打一个 update 标记
    markUpdate(workInProgress)
  }
}

// 给这个 Fiber 节点打一个 Update flag 标记
function markUpdate(workInProgress) {
  workInProgress.flags |= Update
}
```

当 Fiber Tree 遍历完后，对应的 Fiber 节点也打上了 flags 标记（mutation effect），接下来进入到 commit 阶段来完成节点的 mutation 操作：

```javascript
function commitMutationEffectsOnFiber(
  finishedWork,
  root,
  lanes
) {
  ...
  switch (finishedWork.tag) {
    ...
    case HostComponent: {
      ...
      if (supportsMutation) {
        ...
        if (flags & Update) { // 如果有 update flag
          const instance = finishedWork.stateNode
          if (instance != null) {
            const newProps = finishedWork.memorizedProps
            const oldProps = current !== null ? current.memoizedProps: newProps
            commitHostUpdate(finishedWork, newProps, oldProps) // 通过调用 host config 当中提供的 commitHostUpdate 方法来完成 dom 节点的更新操作
          }
        }
      }
    }
  }
}
```

### 节点的添加、删除

todo: 节点的添加&删除流程，或者更新的流程。

createElement 重新调用传入的 props，和之前的对比就不一致了？

clone fiber 节点也就意味着不需要经过 ReactElement render 流程

Fiber 节点 render 阶段可以中断 -> commit 阶段不能中断；

---------

一个 Function Component 和 Fiber 节点间的关系是什么？

一一对应关系，一个 Function Component 会对应生成一个 Fiber 节点。

一个 Function Component 返回的内容(ReactElement)，最终也会生成一个 Fiber 节点，那么 Function Component 所对应的 Fiber 节点和返回的 ReactElement 创建的 Fiber 节点是父子关系。

**每个 ReactElement 都和一个 Fiber 节点对应；**


beginWork 阶段主要就是：

1. 遍历操作 Fiber 节点；
2. Function Component 是否需要重新 render；
3. Fiber 节点的复用；



Dispatcher -> 是什么作用？

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

commitBeforeMutationEffects(root, finishedWork)

commitMutationEffectsOnFiber

commitReconciliationEffects

flushPassiveEffects

flushPassiveEffectsImpl

commitPassiveUnmountEffects
commitPassiveMountEffects

commitPassiveMountOnFiber

commitHookPassiveMountEffects

commitHookEffectListMount

---------


