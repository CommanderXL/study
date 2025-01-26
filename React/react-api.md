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

```javascript
function mountState(initialState) {
  const hook = mountStateImpl(initialState)
  const queue = hook.queue
  const dispatch = dispatchSetState.bind(
    null,
    currentlyRenderingFiber,
    queue
  )
  queue.dispatch = dispatch
  return [hook.memoizedState, dispatch]
}

function mountStateImpl(initialState) {
  const hook = mountWorkInProgressHook() // 创建下一个新的 hook
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
  const hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null
  }
  if (workInProgressHook === null) {
    currentliRenderingFiber.memoziedState = workInProgressHook = hook
  } else {
    workInProgressHook = workInProgressHook.next = hook
  }
  return workInProgressHook
}
```