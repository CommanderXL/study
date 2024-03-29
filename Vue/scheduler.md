## Vue Scheduler 调度器设计

对于 Vue 来说 Scheduler 调度器核心需要解决的问题就是对于任务执行时机的管控。

`src/core/observer/scheduler.ts` 暴露了一个核心的方法：`queueWatcher`，用以接收一个 watcher：

```javascript
/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
export function queueWatcher(watcher: Watcher) {
  const id = watcher.id
  if (has[id] != null) {
    return
  }

  if (watcher === Dep.target && watcher.noRecurse) {
    return
  }

  has[id] = true
  if (!flushing) { // 如果当前没有任务在执行，将这个任务推到队列当中
    queue.push(watcher)
  } else {
    // if already flushing, splice the watcher based on its id
    // if already past its id, it will be run next immediately.
    let i = queue.length - 1
    while (i > index && queue[i].id > watcher.id) {
      i--
    }
    queue.splice(i + 1, 0, watcher)
  }

  // 这里的 waiting 字段主要的作用是启动异步任务，是一个锁，一旦置为 true，异步任务开始启动，主线程会继续收集需要被计算的 watcher，直到主线程的代码执行完；
  // queue the flush
  if (!waiting) {
    waiting = true

    // 如果当前没有任务在执行，那么将 flushSchedulerQueue 放到异步任务队列里面
    // 这样做的目的是启动了 flushSchedulerQueue 执行，但是这是一个异步的任务，所以在主线程的执行当中有可能还会有其他的 watcher 被推进到这个队列当中（这个过程是同步的）。当所有的同步任务执行完后，flushSchedulerQueue 才开始执行。
    if (__DEV__ && !config.async) {
      flushSchedulerQueue()
      return
    }
    nextTick(flushSchedulerQueue)
  }
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue() {
  currentFlushTimestamp = getNow()
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      watcher.before() // render watcher 上部署了 watcher.before 接口 -> src/core/instance/lifecycle.ts
    }
    id = watcher.id
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.
    if (__DEV__ && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' +
            (watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  resetSchedulerState()

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}
```

在分析 `flushSchedulerQueue` 方法之前，我们先来看下 scheduler 暴露出的 `queueWatcher` 是在什么情况下才被调用的：

```javascript
// src/core/observer/watcher.ts
class Watcher {
  ...
  update() {
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }
}

// src/v3/apiWatch.ts
function doWatch() {
  ...
  if (flush === 'sync') {
     watcher.update = watcher.run
  } else if (flush === 'post') {
    watcher.id = Infinity
    watcher.update = () => queueWatcher(watcher)
  } else {
    watcher.update = () => {
      if (instance && instance === currentInstance) {
        // pre-watcher triggered inside setup()
        const buffer = instance._preWatchers || (instance._preWatchers = [])
        if (buffer.indexOf(watcher) < 0) buffer.push(watcher)
      } else {
        queueWatcher(watcher)
      }
    }
  }
}
```

`queueWatcher` 方法只接受 watcher，那么 watcher 是在什么情况下才会产生呢？

* render watcher
* computed
* user watcher
  * watch options
  * $watch api

**对于 computed 而言，是一个 lazy watcher，lazy watcher 在初始化阶段和响应式数据发生变化通知更新的阶段，watcher 这个时候并不会重新计算值，而是改变自身的 `dirty` 属性，当实际访问到这个数据的时候才会重新计算。**

**对于其他的 watcher 来说，在初始化的阶段都会立即进行一次计算，进行一次响应式数据的收集工作，然后在响应式数据发生变化通知更新的阶段，对于在 options 上部署 `sync` 属性的 watcher 来说，这个 watcher 会立即重新计算值。没有部署 `sync` 属性的 watcher 会调用 `queueWatcher` 方法将这个 watcher 推入到更新队列当中，交给 scheduler 统一进行调度执行**（例如 render watcher）

在 `flushSchedulerQueue` 具体的执行阶段，首先会依据 watcher id 进行排序（升序），重新排序之后也就意味着不同 watcher id 的执行时机会有先后顺序，这里我们思考下在一个 vue instance 实例化阶段，不同的 watcher 都是什么时候产生的：

* render watcher （`mounted` hook 之前，mountComponent 方法）
* computed （`beforeCreate` 和 `created` 之间，initState 方法）
* user watch
  * watch options （同 computed）
  * $watch api（和具体的调用时机有关：`this.$watch`）

lazy/sync watcher 不在 scheduler 调度器的控制范围之内。所以在一个 vue instance 实例化阶段，watch options id 要比 render watcher 更小。那么在调度器的执行队列里面， watch options 也就会先执行。此外还有其他的情况，就是 vue instance 相互之间有联系的情况，例如：

* 父子组件，props 传递；
* 共同依赖 vuex 当中 state/getter 数据的不同组件；

这些情况都有一个共性，就是不同的组件都依赖了同一份的响应式数据，响应式数据和这些组件的 render watcher 都建立起了依赖关系，因为响应式数据的触发也就会触发对应的 render watcher 的执行。对于父子组件而言都是依托 VNode 进行递归的组件实例初始化+渲染。那么对于父子组件而言，父组件的 render watcher 肯定要比子组件的 render watcher 初始化的更早，所以在响应式数据（对子组件而言是 props，对父组件可能就是 data）更新的时候首先是父组件的 render watcher 进行 update，其次才是子组件的 render watcher 进行 update。

watcher 进行排序后就进入到循环遍历开始执行 `watcher.run()` 方法的阶段。对于 `render watcher` 一般都部署了 `before` 接口用以触发 `beforeUpdate hook`。**在这些 watcher 执行的时候，是有可能有其他的 watcher 被加入到执行队列当中的。**

当这一帧的所有 watcher 都更新完成后，调用 `resetSchedulerState` 方法完成 `scheduler` 状态的重置，伺候调用组件的 `update hooks`：

```javascript
function callUpdatedHooks(queue: Watcher[]) {
  let i = queue.length
  while(i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    // 在 render watcher 初始化阶段会在 watcher 上挂载 vm(vue instance)，因此在这里也用以获取 vue instance 来调用 update hooks
    if (vm && vm._watcher === watcher && vm._isMounted && !vm._isDestoryed) {
      callHook(vm, 'updated')
    }
  }
}
```

整个调度器有非常多的细节点值得我们去学习：

1. nextTick(flushSchedulerQueue)
2. 执行时机的控制
3. 任务队列的处理