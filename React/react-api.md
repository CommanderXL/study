每个 Function Component 在每次 render 开始之前（不管是初次还是二次 render）(`renderWithHooks` 内部)，都会将：

* workInProgress.memoizedState = null -> hook link list 置为 null
* workInProgress.updateQueue = null -> effect link list 置为 null
* workInProgress.lanes = NoLanes -> lanes 置为 0，用以下次的更新渲染
* workInProgress.flags -> 标记了当前 Fiber 节点是否需要更新

对于每个 hook api 执行都会创建一个 hook 对象，一个 Fiber 节点通过 memoizedState 保存了第一个 hook，所有的 hook 都是以 hook link list 的形式保存，在 Fiber 节点的 render 阶段：

1. 初次 render：构建 hook link list；
2. 再次 render：通过 hook link list 可以访问到当前正在执行的 hook；

```javascript
const hook = {
  memoziedState: null, // hook 的初始状态，为任意类型。例如对 useEffect 来说，这个 hook 初始状态就是保存的一个 effect，对于 useState 来说，初始态就是 useState 接受到的一个数据，因此每个 hook api 初始态都有不一样的数据类型
  baseState: null,
  baseQueue: null,
  queue: null, // useState 有使用到，在二次更新的时候会和 update 建立联系，用以触发组件的二次更新
  next: null // 下一个 hook
}
```

### React.memo

```javascript
export function memo(type, compare) {
  const elementType = {
    $$typeof: REACT_MEMO_TYPE,
    type,
    compare: compare === undefined ? null : compare
  }

  return elementType
}
```

```javascript
export function useRef(initialValue) {
  const dispatcher = resolveDispatcher() // 找到当前的 dispatcher，fiber 节点？ 然后调用节点上的 useRef 方法
  return dispatcher.useRef(initialValue)
}
```

```javascript
export function useMemo() {

}
```

`useMemo` 的依赖比较

```javascript
// 使用浅比较来判断 deps 依赖是否发生了变化
function areHookInputsEqual(nextDeps, prevDeps) {
  ...
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (is(nextDeps[i], prevDeps[i])) {
      continue
    }
    return false
  }
  return true
}
```

`memo` 组件的 props 浅比较：

```javascript
function shallowEqual(objA, objB) {
  if (is(objA, objB)) {
    return true
  }

  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  for (let i = 0; i < keysA.length; i++) {
    const currentKey = keysA[i];
    if (
      !hasOwnProperty.call(objB, currentKey) ||
      // $FlowFixMe[incompatible-use] lost refinement of `objB`
      !is(objA[currentKey], objB[currentKey])
    ) {
      return false;
    }
  }

  return true;
}
```

### React.useContext

### React.useState

在 Function Component 初次的 render 阶段调用 `useState` 方法会通过 `HooksDispatcherOnMount` 当中的 mountState 来初次建立 hook linked list 关系。

等组件渲染完成后的某个时机，通过调用 setState 方法接受一个 action 参数，在内部会新建一个 update 用以 Fiber 节点的更新操作。

```javascript
function mountState(initialState) {
  const hook = mountStateImpl(initialState) // 新建 useState 所对应的 hook，并建立 hook linked list
  const queue = hook.queue // 后续会建立这个 hook queue 和要实施的 update 之间的关系
  const dispatch = dispatchSetState.bind( // 绑定上下文
    null,
    currentlyRenderingFiber,
    queue
  )
  queue.dispatch = dispatch
  return [hook.memoizedState, dispatch] // 返回初始值
}

function dispatchSetState(action) {
  ...
  const lane = requestUpdateLane(fiber) // 获取开始更新 Fiber tree 的 lane
  const didScheduleUpdate = dispatchSetStateInternal(
    fiber,
    queue,
    action,
    lane
  )
  ...
}

function dispatchSetStateInternal(
  fiber: Fiber,
  queue: UpdateQueue,
  action,
  lane
) {
  const update = {
    lane,
    revertLane,
    action,
    hasEagerState,
    eagerState: null,
    next: null
  }

  ...
  // 通过全局 concurrentQueues 先缓存这个 hook queue 和即将要完成的 update 
  // 同时根据这个派发事件的节点来获取 FiberRoot 节点
  const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane) 
  if (root !== null) {
    // 由 FiberRoot 节点开始进入到下一次的 Fiber tree 的更新渲染
    scheduleUpdateOnFiber(root, fiber, lane)
    ...
    return true
  }
  return false
}

function enqueueConcurrentHookUpdate(
  fiber,
  queue,
  update,
  lane
) {
  const concurrentQueue = queue
  const concurrentUpdate = update
  enqueueUpdate(fiber, concurrentQueue, concurrentUpdate)
  return getRootForUpdatedFiber(fiber) // 依据这个节点一直向上找到 FiberRoot 节点
}

function mountStateImpl(initialState) {
  const hook = mountWorkInProgressHook() // 创建下一个新的 hook，并建立前后 hook 间的关系
  ...
  hook.memoizedState = hook.baseState = initialState // 设置初始值
  const queue = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState
  }
  hook.queue = queue
  return hook
}

function mountWorkInProgressHook() {
  // 每个函数组件调用 hook api 都会对应的新建一个内部 hook 类型记录
  const hook = {
    memoizedState: null, // 上一次的 state 值
    baseState: null,
    baseQueue: null,
    queue: null, // useState 当中和下一次的更新 update 建立联系
    next: null
  }
  if (workInProgressHook === null) {
    // This is the first hook in the list
    currentliRenderingFiber.memoziedState = workInProgressHook = hook
  } else {
    // Append to the end of the list
    workInProgressHook = workInProgressHook.next = hook
  }
  return workInProgressHook
}
```

组件初次渲染建立起 hook linked list 后，在某个阶段调用 `setState` 来进行组件的更新，实际上 **组件的二次更新阶段会由 hook 的调度执行逻辑来派发 hook 的实际执行**，这里主要是调用 `HooksDispatcherOnUpdate` 当中的 updateState 方法：

```javascript
function updateState(initialState) {
  return updateReducer(basicStateReducer, initialState)
}

function basicStateReducer(state, action) {
  return typeof action === 'function' ? action(state) : action
}

function updateReducer(reducer, initialArg, init?) {
  const hook = updateWorkInProgressHook() // 获取组件在更新阶段正在执行的 hook
  return updateReducerImpl(hook, currentHook, reducer)
}

function updateReducerImpl(hook, currentHook, reducer) {
  const queue = hook.queue

  let baseQueue = hook.baseQueue

  // 获取在 dispatchSetStateInternal 内部建立起的 queue 和 update 间的关系（queue.pending = update）
  // 在新一轮的更新流程当中都会调用 prepareFreshStack 方法来创建 workInProgress 节点，并在这个方法快结束的时候调用 finishQueueingConcurrentUpdates 来完成 hook queue 和 update 的绑定，当 Fiber tree 开始遍历更新进行到当前的 Fiber 节点的时候也就能依据相应的 update 完成 state 值的变化判断
  const pendingQueue = queue.pending 

  if (pendingQueue !== null) {
    ...
    current.baseQueue = baseQueue = pendingQueue
    queue.pending = null
  }

  const baseState = hook.baseState
  ...
  const first = baseQueue.next // update
  let newState = baseState

  let newBaseState = null
  let newBaseQueueFirst = null
  let newBaseQueueLast = null
  let update = first
  ...
  const action = update.action // 通过 setState 派发的 update 操作

  newState = reducer(newState, action) // 获取最新的 state 状态
  ...
  if (!is(newState, hook.memoizedState)) { // 这个 hook 状态的新旧值对比，如果不一样也就意味着这个组件需要被更新
    markWorkInProgressReceivedUpdate() // !!! 标记这个组件发生了状态的更新 -> didReceiveUpdate = true 
  }
}
```

### React.useEffect

组件初次 render，创建一个新的 hook，挂载到 Fiber 节点的 hook list 上，同时新建一个对应的 effect 函数，挂载到 Fiber 节点的 updateQueue 上，等 Fiber 节点进入到 commit 阶段后会执行这些 effect 函数。

```javascript
function mountEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null
) {
  mountEffectImpl(
    PassiveEffect | PassiveStaticEffect,
    HookPassive,
    create,
    deps
  )
}

function mountEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null
) {
  const hook = mountWorkInProgressHook()
  const nextDeps = deps === undefined ? null : deps
  currentlyRenderingFiber.flags |= fiberFlags // fiber 节点的 flags
  hook.memoizedState = pushSimpleEffect( // 这个 hook 的初始状态为 effect
    HookHasEffect | hookFlags,
    createEffectInstance(),
    create,
    nextDeps
  )
}

// 每个 effect 都对应一个 instance 实例
function createEffectInstance () {
  return {destroy: undefined, resource: undefined}
}

function pushSimpleEffect(
  tag: HookFlags,
  inst: EffectInstance,
  create: () => (() => void) | void,
  deps
) {
  const effect = {
    tag, // effect 的类型
    create, // effect 实际执行的函数
    deps, // 依赖
    inst, // effect 实例 {destroy, resource}
    next // 下一个 effect 函数
  }
  return pushEffectImpl(effect)
}

function pushEffectImpl(effect: Effect): Effect {
  let componentUpdateQueue: null | FunctionComponentUpdateQueue =
    (currentlyRenderingFiber.updateQueue: any); // 每个 Fiber 节点上的 updateQueue 都保存需要执行的 effect link list（单向闭合链表的结构）
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    currentlyRenderingFiber.updateQueue = (componentUpdateQueue: any); // 保存 effect list
  }
  // componentUpdateQueue 主要就是保存 effect link list
  const lastEffect = componentUpdateQueue.lastEffect;
  if (lastEffect === null) {
    componentUpdateQueue.lastEffect = effect.next = effect;
  } else {
    const firstEffect = lastEffect.next;
    lastEffect.next = effect;
    effect.next = firstEffect;
    componentUpdateQueue.lastEffect = effect;
  }
  return effect;
}
```

### React.useSyncExternalStore

这个 api 内部会给这个 Fiber 节点的 hook list 上添加2个 hook，同时也会给这个 Fiber 节点添加2个 effect。

和 useEffect 不一样的地方是，这个 api 内部会构造一个 effect 函数：`subscribeToStore` 并挂载到 Fiber.updateQueue 上，这样当这个 Fiber 节点进入到 commit 阶段后执行这个 effect 函数。

对于这个 effect 函数来说，主要的工作就是执行业务代码调用这个 api 的时候传入的第一个参数 `subscribe` 方法，并将内部的方法 `handleStoreChange` 传入到函数内部，这样在**业务代码侧也就可以拿到决定是否可以重新触发组件渲染的回调函数，可以在 store 发生变化后主动调用这个回调函数来开启组件的重新渲染**

**Fiber.updateQueue 上保存了需要被执行的 effect link list。**

```javascript
// react-reconciler/src/ReactFiberHooks.js
function mountSyncExternalStore(
  subscribe: (() => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T
): T {
  const fiber = currentlyRenderingFiber
  const hook = mountWorkInProgressHook() // mount 阶段创建一个新的 hook，并添加到 hook list）

  let nextSnapshot
  ...
  nextSnapshot = getSnapShot()
  ...
  hook.memoizedState = nextSnapshot
  const inst = {
    value: nextSnapshot,
    getSnapshot
  }
  hook.queue = inst

  // schedule an effect to subscribe to the store
  // 创建一个新的 hook，同时把 effect 挂载到 Fiber.updateQueue 上
  mountEffect(subscribeToStore.bind(null, fiber, inst, subscribe), [subscribe]) // 添加另外一个 hook 至 hook list）
  fiber.flags |= PassiveEffect
  pushSimpleEffect( // 这个 hook 的上一次状态保存的是 snapshot
    HookHasEffect | HookPassive,
    createEffectInstance(),
    updateStoreInstance.bind(null, fiber, inst, nextSnapshot, getSnapshot),
    null
  )

  return nextSnapshot
}

function subscribeToStore(
  fiber,
  inst,
  subscribe
) {
  const handleStoreChange = () => {
    if (checkIfSnapshotChanged(inst)) {
      forceStoreRerender(fiber)
    }
  }

  return subscribe(handleStoreChange)
}
```

### React.forwardRef

需要搭配 `useImperativeHandle` 这个 hook api 来使用，一般用于父组件或者子组件暴露的内容。（还有一种 ref 使用场景就是用以建立 react 和 HostComponent 的联系，可以拿到 HostComponent 实例）

> 19版本不需要单独 forwardRef api 来建立 ref 间的联系

`forwardRef` 本身是一个包装 api：

```javascript
// react/src/ReactForwardRef.js
export function fowardRef(render: (props: Props, ref: React$Ref<ElementType>) => React$Node) {
  const elementType = {
    $$typeof: REACT_FORWARD_REF_TYPE,
    render // 实际的函数组件的 render 函数
  }

  return elementType
}
```

由 `forwardRef` api 包装的内容仍然会传给 `createElement` 来创建 `ReactElement` 用以后续创建 Fiber 节点，对于 `ReactElement` 来说 `$$typeof` 始终为 `REACT_ELEMENT_TYPE`：

```javascript
// react/src/jsx/ReactJSXElement.js
function ReactElement(
  type,
  key,
  self,
  source,
  owner,
  props,
  debugStack,
  debugTask
) {
  const refProp = props.ref

  const ref = refProp !== undefined ? refProp : null
  ...
  element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props
  }

  return element
}
```

进入到 `beginWork` 后，由 `ReactElement` 创建 Fiber 节点的过程中有个比较特殊的逻辑处理：

```javascript
function createChildReconciler() {
  ...
  function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    element: ReactElement,
    lanes: Lanes
  ): Fiber {
    ...
    // Fiber 节点的 FiberTag 为 ForwardRef
    const created = createFiberFromElement(element, returnFiber.mode, lanes)
    coerceRef(created, element) // 通过 props 传递进来的 ref，会被挂载到 workInProgress.ref 属性上
    created.return = returnFiber
    ...
    return created
  }
}
```

当这个 Fiber 节点创建完进入接下来的 render 阶段，有个很重要的 Hook Api：`useImperativeHandle` 需要搭配组件所接收到的 ref 属性使用：

```javascript
// 在组件初次渲染阶段，这个 hook api 在内部会创建一个 effect 函数 imperativeHandleEffect
function mountImperativeHandle(
  ref,
  create
  deps
) {
  ...
  const effectDeps = deps !== null && deps !== undefined ? deps.concat([ref]) : null
  let fiberFlags = UpdateEffect | LayoutStaticEffect // 标记这个 Fiber flag 为 Update
  // 依据这个 effect 创建对应的 hook 及 effect 函数，并挂载到 hook list，等到节点在 commit 阶段来触发对应的 effect 函数。
  mountEffectImpl(
    fiberTags,
    HookLayout, // 标记这个 effect 类型为 HookLayout
    imperativeHandleEffect.bind(null, create, ref), // 和 useEffect 不一样，和 useSyncExternalStore 类似，是 react 内部包装了一个 effect 函数 
    effectDeps
  )
}

function imperativeHandleEffect(
  create: () => T,
  ref: {current: T | null} | ((inst: T | null) => mixed) | null | void
): void | (() => void) {
  // ref 数据类型即可以是 function 也可以是一个 useRef 类型的数据
  if (typeof ref === 'function') {
    const refCallback = ref
    const inst = create() // 调用 useImperativeHandle 接受的的第二个参数，获取需要向父组件挂载的需要暴露出去实例（Object）及其挂载的方法
    const refCleanup = refCallback(inst) // 将子组件需要暴露出去的示例传入到父组件传进来的 ref 函数当中，这样父组件就可以访问子组件暴露的内容
    return () => { // ref effect cleanup function
      if (typeof refCleanup === 'function') {
        refCleanup()
      } else {
        refCallback(null) // 对 react19版本前的销毁 ref 逻辑的兼容
      }
    }
  } else if (ref !== null && ref !== undefined) { // 如果 ref 数据为一个通过 useRef 创建的类型，那么直接通过 refObject.current = inst 进行挂载
    const refObject = ref
    const inst = create()
    refObject.current = inst
    return () => { // ref effect cleanup function
      refObject.current = null
    }
  }
}
```

在这个函数组件完成 render 阶段后（即 hook list 及 effect list 的挂载），在 commit 阶段首先会执行 `commitHookLayoutUnmountEffects` 完成 HookLayout 类型的 effect 函数的执行：

```javascript
// react-reconciler/src/ReactFiberCommitWork.js
function commitMutationEffectsOnFiber(
  finishedWork: Fiber,
  root: FiberRoot,
  lanes: Lanes
) {
  ...
  const current = finishedWork.alternate
  const flags = finishedWork.flags

  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes)
      commitReconciliationEffects(finishedWork)

      if (flags & Update) {
        commitHookEffectListUnmount(
          HookInsertion | HookHasEffect,
          finishedWork,
          finishedWork.return
        )
        commitHookEffectListMount(HookInsertion | HookHasEffect, finishedWork)
        commitHookLayoutUnmountEffects(
          finishedWork,
          finishedWork.return,
          HookLayout | HookHasEffect
        )
      }
    }
    ...
    case HostComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes)
      commitReconciliationEffects(finishedWork)
      
      if (flags & Ref) { // 之前创建 Fiber 节点的时候已经打上 Ref flag
        if (!offscreenSubtreeWasHidden && current !== null) {
          safelyDetachRef(current, current.return); // 如果 Fiber 节点之前没有就不执行了，如果有就先执行下 ref detach 的逻辑
        }
      }
    }
  }
}

function safelyDetachRef(
  current,
  nearestMountedAncestor
) {
  const ref = current.ref
  const refCleanup = current.refCleanup // 如果 ref 函数执行有回调，那么就作为 refCleanup

  if (ref !== null) {
    if (typeof refCleanup === 'function') {
      refCleanup()
      ...
      current.refCleanup = null
      const finishedWork = current.alternate
      if (finishedWork != null) {
        finishedWork.refCleanup = null
      }
    } else if (typeof ref === 'function') { // 兼容 React19 版本以下的 ref 写法
      ref(null)
    } else {
      ref.current = null // 如果 ref 属性不是函数类型
    }
  }
}
```

当 `commitMutationEffects` 完成后，进入到 `commitLayoutEffects` 阶段，用以触发 HookLayout 类型的 effect 函数（例如 useImperativeHandle 内部创建的 effect 函数 imperativeHandleEffect，useLayout 挂载的 effect 函数），也是在这个阶段完成父子组件的 ref 函数执行。

对于原生组件上绑定 ref 属性的执行也是在这个阶段完成对于 HostComponent 的绑定（safelyAttachRef）：

```javascript
function commitLayoutEffects(
  finishedWork: Fiber,
  root: FiberRoot,
  commitedLanes: Lanes
): void {
  ...
  const current = finishedWork.alternate
  commitLayoutEffectOnFiber(root, current, finishedWork, commitedLanes)
  ...
}

function commitLayoutEffectOnFiber(
  finishedRoot,
  current,
  finishedWork,
  commitedLanes
) {
  ...
  const flags = finishedWork.flags
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent: {
      recursivelyTraverseLayoutEffects(
        finishedRoot,
        finishedWork,
        commitedLanes
      )
      if (flags & Update) {
        commitHookLayoutEffects(finishedWork, HookLayout | HookHasEffect)
      }
      break
    }
    ...
    case HostComponent: {
      recursivelyTraverseLayoutEffects(
        finishedRoot,
        finishedWork,
        commitedLanes
      )
      ...
      if (flags & Ref) { // 在创建 Fiber 节点的过程中，通过 markRef 会给这个 Fiber 节点打上 Ref 标记
        safelyAttachRef(finishedWork, finishedWork.return)
      }
      break
    }
  }
}

function commitHookLayoutEffects(
  finishedWork,
  hookFlags
) {
  commitHookEffectListMount(hookFlags, finishedWork)
}

function safelyAttachRef(
  current: Fiber,
  nearestMountedAncestor: Fiber | null
) {
  commitAttachRef(current)
}

function commitAttachRef(finishedWork: Fiber) {
  const ref = finishedWork.ref
  if (ref !== null) {
    const instance = finishedWork.stateNode // 获取 HostComponent，真实的 dom 节点
    ...
    instanceToUse = instance
    if (typeof ref === 'function') { // 如果 ref 属性是个函数，直接将 HostComponent 实例传递到函数内部
      finishedWork.refCleanup = ref(instanceToUse) 
    } else { // 如果 ref 属性是通过 useRef 创建的类型数据
      ref.current = instanceToUse
    }
  }
}
```



### 位运算

二进制的数据去存储更复杂形式：一个数据可以存储多个操作，用以做后续的操作判定。

例如某个 Fiber 节点可能存在多种操作： flags = a | b | c（按位与）

那么如果要判断这个 Fiber 节点是否存在某个操作，只需要进行 flags & a（按位或）的操作即可判定；