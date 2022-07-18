全局变量 shouldTrack、activeEffect 来决定是否需要进行响应式数据的收集工作。

## ReactiveEffect

ReactiveEffect 是对于数据&变化的抽象。可以理解提供了一种管理响应式数据变化的机制：**何时访问响应式数据的时候进行依赖收集（时机很关键）**，当响应式数据发生变化所引起的相关依赖的变化。响应式数据的依赖分为以下几种类型：

* computed effect
* watch effect
* render effect

也就是说只有以上 effect 进入到工作流程之后才会开启响应式数据依赖的收集工作（开启的控制节点也就是对于 `shouldTrack`、`activeEffect` 全局变量的管控，effect.run 先开启开关，然后实际访问数据的时候即会完成依赖收集，所有都是围绕着 ReactiveEffect 实例来进行管理的）。响应式数据和它们之间的关系就是：响应式数据有多个 effect 依赖。那么以上这些 effect 何时会进入到工作流程呢？

对于 computed effect 来说，只有当访问 computed 数据（也是一种 ref 数据）的时候才会开启这个数据的依赖收集的工作。~~当然需要注意的一个点就是 computed 数据相对于 `reactive`(ref) 数据而言，computed 数据是它们的依赖，因此在访问 computed 数据的过程中需要完成 `reactive`(ref)~~

对于 watch effect 来说，在初始化的阶段（对于非 watchEffect&flush post 类型）就会开启依赖收集的工作。

对于 render effect 来说:


ReactiveEffect 接受2个参数，第一个为访问响应式数据的函数方法 fn（调用后才会进入访问响应式数据的流程），第二个为当响应式数据发生变化后所需要执行的任务。

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

所以对于这个方面，v3 相较于 v2 的抽象程度更高。

v2 都是基于 watcher 来实现，v3 基于 ReactiveEffect 来实现。

在响应式系统里面，和响应式数据结合非常紧密的调度器（也就是响应式数据发生变化后，effect 依赖执行时机）设计这一块从执行时机上做了更细粒度的拆分设计，主要体现在将不同的 effect 函数做了类型区分和执行时机的调度，在一个 vue 实例化的生命周期当中，computed/watch api 的调用都是早于 render，针对 computedwatch effect 

```javascript
// todo scheduler 代码
```

对于 watch effect 而言根据用法的不同也决定了 effect 函数的执行时机的差异：

watch -> queueCb（异步） -> queueFlush
watchPostEffect
watchSyncEffect
watchEffect

对于普通的 watch 函数（flush 默认为 `pre`）来说


renderer -> queueJob（异步） -> queueFlush
computed
