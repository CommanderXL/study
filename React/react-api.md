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

在 Function Component 初次的 render 阶段是通过 `HooksDispatcherOnMount` 当中的 mountState 来初次建立 hook linked list 关系。

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

function dispatchSetState() {
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
  // 通过全局 concurrentQueues 来建立这个 hook queue 和 update 之间的关系
  // 同时获取 FiberRoot 节点
  const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane) 
  if (root !== null) {
    // 进入到下一次的 Fiber tree 的更新渲染
    scheduleUpdateOnFiber(root, fiber, lane)
    ...
    return true
  }
  return false
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
  // 每个函数组件调用 hook api 的话都会对应的新建一个内部 hook 类型记录
  const hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
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

在组件的二次渲染阶段，调用 `HooksDispatcherOnUpdate` 当中的 updateState 方法：

```javascript
function updateState(initialState) {
  return updateReducer(basicStateReducer, initialState)
}

function basicStateReducer(state, action) {
  return typeof action === 'function' ? action(state) : action
}

function updateReducer(reducer, initialArg, init?) {
  const hook = updateWorkInProgressHook()
  return updateReducerImpl(hook, currentHook, reducer)
}

function updateReducerImpl(hook, currentHook, reducer) {
  ...
  if (!is(newState, hook.memoizedState)) {
    markWorkInProgressReceivedUpdate() // !!! 标记这个组件发生了状态的更新
  }
}
```

### React.useEffect


### 位运算

二进制的数据去存储更复杂形式：一个数据可以存储多个操作，用以做后续的操作判定。

例如某个 Fiber 节点可能存在多种操作： flags = a | b | c（按位与）

那么如果要判断这个 Fiber 节点是否存在某个操作，只需要进行 flags & a（按位或）的操作即可判定；