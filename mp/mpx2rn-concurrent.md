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

在 Fiber 进行 render 的阶段 renderRootSync -> workLoopSync -> performUnitOfWork，实际还是 Function Component 执行构建 Fiber tree 的阶段，当遇到 Suspense 组件的时候：

```javascript
function beginWork() {
  // ...
  updateSuspenseComponent(current, workInProgress, renderLanes)
}

```



workLoop/workLoopConcurrent -> handleError(root, throwValue) // throwValue 是一个 promise 类型的数据

throwException

```javascript
function throwException(
  root: FiberRoot,
  returnFiber: Fiber,
  sourceFiber: Fiber,
  value: mixed,
  rootRenderLanes: Lanes
) {
  sourceFiber.flags |= Incomplete
}
```