全局变量 shouldTrack、activeEffect 来决定是否需要进行响应式数据的收集工作。

## ReactiveEffect

ReactiveEffect 是对于数据&变化的抽象。可以理解提供了一种管理响应式数据变化的机制：**何时访问响应式数据的时候进行依赖收集（时机很关键）**，当响应式数据发生变化所引起的相关依赖的变化。响应式数据的依赖分为以下几种类型：

* computed effect
* watch effect
* render effect

也就是说只有以上 effect 进入到工作流程之后才会开启响应式数据依赖的收集工作（开启的控制节点也就是对于 `shouldTrack`、`activeEffect` 全局变量的管控，effect.run 先开启开关，然后实际访问数据的时候即会完成依赖收集，所有都是围绕着 ReactiveEffect 实例来进行管理的）。响应式数据和它们之间的关系就是：响应式数据有多个 effect 依赖。那么以上这些 effect 何时会进入到工作流程呢？

对于 computed effect 来说，只有当访问 computed 数据（也是一种 ref 数据）的时候才会开启这个数据的依赖收集的工作。~~当然需要注意的一个点就是 computed 数据相对于 `reactive`(ref) 数据而言，computed 数据是它们的依赖，因此在访问 computed 数据的过程中需要完成 `reactive`(ref)~~

对于 watch effect 来说，在初始化的阶段也就是调用 watch api 的时候（对于非 watchEffect&flush post 类型）就会开启依赖收集的工作。

对于 render effect 来说:


ReactiveEffect 接受2个参数，第一个为访问响应式数据的函数方法 fn（调用后才会进入访问响应式数据的流程），第二个为当响应式数据发生变化后所需要执行的任务（scheduler）。

`run` 方法实际是对于响应式数据的访问做了一层封装，这里面比较核心关键的点就是对于全局变量 `shouldTrack`、`activeEffect` 的管控来决定是否需要进行响应式数据的收集工作。

```javascript
export class ReactiveEffect {
  
  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler || null,
    scope?: EffectScope
  ) {
    recordEffectScope(this, scope)
  }

  // 通过管控 shouldTrack、activeEffect 来决定当前的响应式系统是否需要收集值
  // 访问响应式数据的值，进入到响应式数据的 getter 阶段来完成响应式数据的依赖收集工作
  run() {
    if (!this.active) {
      return this.fn()
    }
    let parent: ReactiveEffect | undefined = activeEffect
    let lastShouldTrack = shouldTrack
    while (parent) {
      if (parent === this) {
        return
      }
      parent = parent.parent
    }
    try {
      this.parent = activeEffect
      activeEffect = this
      shouldTrack = true

      trackOpBit = 1 << ++effectTrackDepth

      if (effectTrackDepth <= maxMarkerBits) {
        initDepMarkers(this)
      } else {
        cleanupEffect(this)
      }
      return this.fn()
    } finally {
      if (effectTrackDepth <= maxMarkerBits) {
        finalizeDepMarkers(this)
      }

      // 1 * 2 ** effectTrackDepth
      trackOpBit = 1 << --effectTrackDepth

      activeEffect = this.parent
      shouldTrack = lastShouldTrack
      this.parent = undefined

      if (this.deferStop) {
        this.stop()
      }
    }
  }
}
```

### 依赖收集阶段：

在 v2 版本当中在创建响应式数据的过程中，针对每个响应式的 Key 创建了对于 `Dep` 的闭包用来收集所有依赖。
而在 v3 版本当中比较核心的一个点就是对于想要变成响应式的数据而言都是通过相应的 api 来转化为响应式数据，例如 `reactive`、`ref`、`computed`，对于它们而言一个非常重要的工作就是数据代理。就拿 `ref` 来说可以将 primitive value 转化为响应式的数据，实际上在内部就是创建了一个新的代理对象 `RefImpl`，`computed` 数据实际返回了一个新的代理对象 `ComputedRefImpl`，`reative` 则是返回了一个 `Proxy` 对象。

经过响应式 api 的处理最终返回响应式的代理对象，当访问到代理对象的时候进入依赖收集的过程，在这个过程当中，访问 `ref` 和 `computed` 数据收集依赖过程比较一致：`trackRefValue(this)`，直接传递对应的代理对象上的 `dep` 进入到依赖收集过程。对于 `reactive` 数据的访问过程中需要做的工作比较多，核心的点就是在访问数据的过程中，针对每个被访问的 `key` 都需要维护一个依赖关系（这里也比较好理解，对于 `ref`、`computed` 而言都是一个单值，对于这个单值而言只需要维护一个 dep 依赖关系即可，对于 `reactive` 而言，例如接受一个 object 类型的数据，那么对于这个 object 上的任何一个 key 都是响应式的，所以是需要针对每个 key 维护一个依赖关系的，也就是在 `track` 方法当中所做的），接下来进入 `trackEffects` 方法针对 dep 进行依赖收集：

```javascript
// reactivity/src/effect.ts
function track(target: Object, type: TrackOpTypes, key: unknow) {
  if (shouldTrack && activeEffect) {
    // 每个 reative 数据都会对应一个依赖映射关系： depsMap，这个 Map 数据保存了所有响应式 key 的依赖关系
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    // 每个响应式 key 都会维护一个依赖 dep set（通过 createDep 来产出）
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep()))
    }

    const eventInfo = __DEV__
      ? { effect: activeEffect, target, type, key }
      : undefined

    trackEffects(dep, eventInfo)
  }
}

export function trackEffects(dep: Dep, debuggerEventExtraInfo?: DebuggerEventExtraInfo) {
  let shouldTrack = false
  ...

  if (shouldTrack) {
    dep.add(activeEffect!)
    activeEffect!.deps.push(dep)
    if (__DEV__ && activeEffect!.onTrack) {
      activeEffect!.onTrack({
        effect: activeEffect!,
        ...debuggerEventExtraInfo
      })
    }
  }
}
```

### 响应式数据发生变更，触发依赖更新阶段：

针对 `ref` 和 `computed` 数据一样都是单值，所以对于这两者而言，如果数据发生了变化，其实就是需要获取数据上绑定的 `dep`，然后触发依赖当中保存的所有 `effect` 执行，这里在触发依赖更新的流程当中两种数据类型都是调用的同样的 `triggerRefValue` 方法（所以在 vue3 当中可以将 ref 以及 computed 数据类型联系起来看，它们都是提供了对于某个数据类型的代理，这个代理提供了 `get Value`、`set Value` 的方法用来收集依赖以及触发依赖的更新）：

```javascript
// packages/reactivity/src/ref.ts
export function triggerRefValue(ref: RefBase<any>, newVal?: any) {
  ref = toRaw(ref)
  if (ref.dep) {
    if (__DEV__){
      triggerEffects(ref.dep, {
        target: ref,
        type: TriggerOpTypes.SET,
        key: 'value',
        newValue: newVal
      })
    } else {
      triggerEffects(ref.dep)
    }
  }
}
```

而针对 `reactive` 数据类型，当某个 `key` 的值发生变化后，也就是进入到 `proxy` 数据的 `set` 方法，首先需要根据对应的 `key` 找到对应的 `dep` 收集的所有 `reactiveEffect` 实例，然后再进入到后续的 `triggerEffects` 流程当中。

所以对于这个方面，v3 相较于 v2 的抽象程度更高。

v2 都是基于 watcher 来实现，v3 基于 ReactiveEffect 来实现。

在响应式系统里面，和响应式数据结合非常紧密的调度器（也就是响应式数据发生变化后，effect 依赖执行时机）设计这一块从执行时机上做了更细粒度的拆分设计，主要体现在将不同的 effect 函数做了类型区分和执行时机的调度，在一个 vue 实例化的生命周期当中，computed/watch api 的调用都是早于 render，针对 computed/watch effect：

```javascript
// packages/runtime-core/src/scheduler.ts

export function queuePreFlushCb(cb: SchedulerJob) {
  queueCb(cb, activePreFlushCbs, pendingPreFlushCbs, preFlushIndex)
}

export function queuePostFlushCb(cb: SchedulerJobs) {
  queueCb(cb, activePostFlushCbs, pendingPostFlushCbs, postFlushIndex)
}

export function flushPreFlushCbs() {
  ...
}

export function flushPostFlushCbs() {
  ...
}

function flushJobs(seen: CountMap) {
  isFlushPending = false
  isFlushing = true
  if (__DEV__) {
    seen = seen || new Map()
  }

  flushPreFlushCbs(seen)

  queue.sort((a, b) => getId(a) - getId(b))

  const check = __DEV__
    ? (job: SchedulerJob) => checkRecursiveUpdates(seen!, job)
    : NOOP

  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      // queue 队列当中保存了 render effect
      const job = queue[flushIndex]
      if (job && job.active !== false) {
        if (__DEV__ && check(job)) {
          continue
        }
        // console.log(`running:`, job.id)
        callWithErrorHandling(job, null, ErrorCodes.SCHEDULER)
      }
    }
  } finally {
    flushIndex = 0
    queue.length = 0

    flushPostFlushCbs(seen)

    isFlushing = false
    currentFlushPromise = null
    // some postFlushCb queued jobs!
    // keep flushing until it drains.
    if (
      queue.length ||
      pendingPreFlushCbs.length ||
      pendingPostFlushCbs.length
    ) {
      flushJobs(seen)
    }
  }
}
```

对于 watch effect 而言根据用法的不同也决定了 effect 函数的执行时机的差异：

* watch -> queueCb（异步） -> queueFlush
* watchPostEffect
* watchSyncEffect
* watchEffect -> 立即执行 getter 函数完成响应式数据的收集（和 watch 不太一样的地方是 watch 可以明确指定监听的某个值或字段，而 watchEffect 可以在 getter 执行阶段对于所访问到的响应式数据都进行监听，一旦某一个值发生了变化，那么对应的 getter 函数就会执行）

对于普通的 watch api 调用来说（flush 默认为 `pre`）：

watch 的回调首先是一个异步的操作，它的执行是在 render 函数执行之前；

对于 `flush` 为 `sync` 来说：

watch 的回调是一个同步的操作，也就是说当被监听的数据发生了变化之后，回调会被立即执行；

而对于 `flush` 为 `post` 来说：

watch 的回调也是一个异步的操作，它的执行是在 render 函数执行之后，这里和 `flush: pre` 的一个比较重要的区别就是在 render 函数执行前/后，如果要获取 DOM 元素相关的内容会有需要注意的地方，也就是说这2种配置可以满足不同情况下获取 DOM 更新之前与之后的不同状态；

在 scheduler 设计当中针对任务的类型也做了区分，对于 watch effect 而言都是通过 `queueCb` 将需要被异步执行的任务使用队列保存起来，而对于 render effect 而言都是通过 `queueJob` 将需要执行的 render function 使用 `queue` 来保存起来。当主线程的同步函数/任务都被执行完之后，进入到下一帧就开始调用 `flushJobs` 来消费 effect。


renderer -> queueJob（异步） -> queueFlush
computed
