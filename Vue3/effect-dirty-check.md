## Vue3.4 effect-drity-check 机制

在最近刚发布的 Vue3.4 版本当中重构了部分响应式系统的功能。博客当中举了一个例子：

todo：补充一张图

在之前的版本当中，`count.value` 发生变化的话肯定会再次触发 `watchEffect` 的执行。主要的原因还是在于之前的 computed effect 的设计，computed 依赖的响应式数据发生了变化之后，scheduler 会立即触发对其产生依赖的 effect。所以在这个例子当中，count.value 发生了变化，触发 computed effect 进而也就触发了 watch effect 的执行。

由这个简单的例子可以继续推导下，在 Vue 框架内部基于 ReactiveEffect 还提供了包括，依赖 computed 数据的 effect 还会有其他的类型：

* computed effect
* render effect
* watch effect
* effect api

todo: 补充一个图 不同 effect 和 computed 数据之间的关系

所以针对以上这些 effect 如何依赖了 computed 数据，那么在 re-computed 的过程当中都是可能会出现上述例子当中 effect 重新执行的情况。

那么为了优化这种场景，Vue3.4 引入了 effect dirty check 机制：

首先来看下 ReactiveEffect 的设计，几个大的变化：

* 内部新增了一个属性 `_dirtyLevel` 用以标记目前 effect 的 dirty 状态
* 对于使用方而言第二个参数改为必传的 `trigger` 函数

```javascript
export class ReactiveEffect {
  ...
  _dirtyLevel = DirtyLevels.Dirty
  ...

  constructor(
    public fn: () => T,
    public trigger: () => void,
    public scheduler?: EffectScheduler,
    scope?: EffectScope
  ) {
    recordEffectScope(this, scope)
  }

  public get dirty() {
    if (this._dirtyLevel === DirtyLevels.ComputedValueMaybeDirty) {
      this._dirtyLevel = DirtyLevels.NotDirty // computed 数据访问过一次后，置为 NotDirty
      this._queryings++ // 针对 computed 数据的设置
      pauseTracking() // 暂停依赖的收集
      for (const dep of this.deps) {
        if (dep.computed) {
          triggerComputed(dep.computed) // 访问存在依赖关系的 computed 数据，进入 getter ，看是否发生了变化，如果发生了变化，动态的改变当前依赖的 effect dirty 值，进而最终会执行 effect scheduler 
          if (this._dirtyLevel >= DirtyLevels.ComputedValueDirty) {
            break
          }
        }
      }
      resetTracking()
      this._queryings--
    }
    return this._dirtyLevel >= DirtyLevels.ComputedValueDirty
  }
}
```



1. 具体的场景举例（和之前的工作流程的对比）；
   1. 具体会出现这种 case 的原因
2. 引入了 effect-dirty-check；
3. 如何去做的；
   1. ReactiveEffect API 的变化； trigger/scheduler 之间的区别（trigger 只是触发一些信号，即 computed 触发相关依赖的执行，scheduler 好理解，是交给用户来决定怎么去触发 effect）
   2. dity-check 机制；
4. 对于基于 ReactiveEffect 做上层 API 的一些改造工作。