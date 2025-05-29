### Concurrent 并发渲染

ensureRootIsScheduled

scheduleCallback

performConcurrentWorkOnRoot

performUnitOfWork 之后，通过 shouldYield 来决策是否需要释放主线程

主线程释放完后，又是如何回到 render 阶段的？ ->  派发更新，从顶到底部；

Priorities -> Lanes

Suspense 的渲染流程是怎么样的？

对于 Suspense 组件来说，核心的2个属性，一个是接受到的 fallback，一个是其所需要异步渲染的组件

```javascript
import Toast from './toast.tsx'
import { lazy } from 'react'

const Dynamic = lazy(() => import('./dynamic.tsx'))

const component = () => {
  return (
    <>
      <Suspense fallback={Toast}>
        <Dynamic />
      </Suspense>
    </>
  )
}
```

`lazy` api 最终返回的同样是一个 `ReactElement`，只不过 `$$typeof` 有特殊的标识为 `REACT_LAZY_TYPE`（createElement 只管构造 ReactElement，保存构造函数、接受 props 传参等）：

```javascript
/*
  对于 LazyComponent 的 Fiber 节点处理逻辑也很清晰：对于动态加载的组件，添加成功、失败的回调来接受加载成功的异步组件or加载失败的错误，因为是异步的动作，在处理函数当中会判断当前异步组件的加载状态，如果是未加载成功的状态，将会直接 payload._result 通过错误给 throw 出去，这样就能被外部的处理 Fiber 节点的流程给捕获，从而进入到后续的 sibling 组件的处理

  这里为什么要通过 throw payload._result 来将结果抛出去呢？
  主要还是因为处理 Fiber 节点的过程是个同步递归的操作，通过 throw Error 的形式可以立即中断递归处理的过程。
*/
function lazyInitialize<T>(payload: Payload<T>): T {
  if (payload._status === Uninitialized) {
    const ctor = payload._result
    const thenable = ctor()

    thenable.then(
      moduleObject => { // 加载成功的异步组件
        if (
          (payload: Payload<T>)._status === Pending ||
          payload._status === Uninitalized
        ) {
          const resolved: ResolvedPayload<T> = payload
          resolved._status = Resolved
          resolved._result = moduleObject // 更新 payload 的数据为异步组件
        }
      },
      error => {
        if (
          (payload: Payload<T>)._status === Pending ||
          payload._status === Uninitialized
        ) {
          const rejected: RejectedPayload = payload
          rejected._status = Rejected
          rejected._result = error
        }
      }
    )

    if (payload._status === Uninitialized) {
      // In case, we're still uninitialized, then we're waiting for the thenable
      // to resolve. Set it as pending in the meantime.
      const pending: PendingPayload = payload
      pending._status = Pending
      pending._result = thenable
    }
  }

  if (payload._status === Resolved) {
    const moduleObject = payload._result
    ...
    return moduleObject.default
  } else {
    throw payload._result
  }
}

export function lazy<T>(
  ctor: () => Thenable<{default: T, ...}>
): LazyComponent<T, Payload<T>> {
  const payload: Payload<T> = {
    _status: Uninitalized,
    _result: ctor
  }

  // 返回的 ReactElement
  const lazyType: LazyComponent<T, Payload<T>> = {
    $$typeof: REACT_LAZY_TYPE,
    _payload: payload,
    _init: lazyInitializer
  }

  return lazyType
}
```

那么进入到 LazyComponent 后续所对应的 Fiber 节点的处理阶段：

```javascript
function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  ...
  switch (workInProgress.tag) {
    case LazyComponent: {
      const elementType = workInProgress.elementType
      return mountLazyComponent(
        current,
        workInProgress,
        elementType,
        renderLanes
      )
    }
    ...
  }
  ...
}

function mountLazyComponent(
  _current: null | Fiber,
  workInProgress: Fiber,
  elementType: any,
  renderLanes: Lanes
) {
  ...
  const props = workInProgress.pendingProps
  const lazyComponent: LazyComponentType<any, any> = elementType
  let Component
  ...
  const payload = lazyComponent._payload
  const init = lazyComponent._init
  Component = init(payload) // 处理 lazy api 所接受的异步组件

  ...
  // Store the unwrapped component in the type
  workInProgress.type = Component
  ...
}


```

先有 ReactElement 还是先有 Fiber 节点？  ->  先有 ReactElement（保存了这个组件的构造函数），再通过 ReactElement 去创建 Fiber 节点，在接下来的 Fiber 节点处理阶段，再执行组件的构造函数，即 render 阶段

在 Fiber 进行 render 的阶段 renderRootSync -> workLoopSync -> performUnitOfWork，实际还是 Function Component 执行构建 Fiber tree 的阶段，当遇到 Suspense 组件的时候：

```javascript
function beginWork() {
  // ...
  updateSuspenseComponent(current, workInProgress, renderLanes)
}

```

再回到整个 Fiber tree 开始处理的地方，通过 try/catch 来处理 Fiber 节点的处理过程中抛出来的异常，例如上面提到的 lazy api 返回的 LazyComponent 处理阶段抛出来的异常：`throw payload._result`，保存了加载异步组件的 promise 实例。

```javascript
function renderRootSync(root: FiberRoot, lanes: Lanes) {
  ...
  do {
    try {
      workLoopSync()
      break
    } catch (thrownValue) {
      handleError(root, throwValue)
    }
  } while (true)
}

function handleError(root, thrownValue): void {
  do {
    let erroredWork = workInProgress
    try {
      ...
      throwException(
        root,
        erroredWork.return,
        erroredWork,
        throwValue,
        workInProgressRootRenderLanes
      )
      completeUnitOfWork(erroredWork)
    } catch () {
      ...
      continue
    }
    return
  } while (true)
}
```



workLoopSync/workLoopConcurrentSync -> handleError(root, throwValue) // throwValue 是一个 promise 类型的数据

throwException

```javascript
function throwException(
  root: FiberRoot,
  returnFiber: Fiber,
  sourceFiber: Fiber,
  value: mixed,
  rootRenderLanes: Lanes
) {
  // The source fiber did not complete
  sourceFiber.flags |= Incomplete

  if (
    value !== null &&
    typeof value === 'object' &&
    typeof value.then === 'function'
  ) {
    // This is a wakeable. The component suspended
    const wakeable: Wakeable = (value: any)

    ...
    const suspenseBoundary = getNearestSuspenseBoundaryToCapture(returnFiber)
    if (suspenseBoundary !== null) {
      
    }
  }
}
```