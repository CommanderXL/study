# Composition Api for Vue2

`Composition Api` 作为一个单独的插件被挂载是 `Vue` 根的构造函数上。

## setup 初始化函数

```javascript
// *.vue

export default {
  setup(props) {
    ...

    return { // setup 函数里返回的内容可以用于组件的其余的部分
      ...
    }
  }
}
```

在 vue 实例的生命周期执行的时机为：`initProps` -> `initMethods` -> `initData`。其中 `Composition Api` 对于 vue 实例的 `data` 属性做了一层代理，确保 `setup` 函数的调用是在 `data` 初始化之前。

```javascript
$options.data = function wrappedData() {
  initSetup(vm, vm.$options) // setup 函数调用的真实时机
  return typeof data === 'function'
    ? (data as (
        this: ComponentInstance,
        x: ComponentInstance
      ) => object).call(vm, vm)
    : data || {}
}
```

## 响应式系统

`Composition Api` 使用的是一套独立的响应式系统，这套系统可以脱离 vue 的环境来被使用。

## 生命周期

```javascript
import { onMounted } from '@vue/composition-api'

export default {
  setup() {
    onMounted(() => {
      // do something
    })
  }
}
```

生命周期的钩子函数只能在 `setup` 内同步的调用。因为它们依赖于内部的全局状态来定位当前组件实例（正在调用 setup() 的组件实例）, 不在当前组件下调用这些函数会抛出一个错误。

```javascript
// src/apis/lifecycle.ts

const genName = (name: string) => `on${name[0].toUpperCase() + name.slice(1)}`
function createLifeCycle(lifeCyclehook: string) {
  return (callback: Function) => {
    const vm = currentVMInFn(genName(lifeCyclehook)) // 用以获取当前正在调用 setup 函数的 vm 实例（全局唯一）
    if (vm) {
      injectHookOption(getVueConstructor(), vm, lifeCyclehook, callback)
    }
  }
}

function injectHookOption(
  Vue: VueConstructor,
  vm: ComponentInstance,
  hook: string,
  val: Function
) {
  const options = vm.$options as any
  const mergeFn = Vue.config.optionMergeStrategies[hook] // 获取生命周期钩子函数的合并策略函数，Hooks 和 props 会默认合并为数组
  options[hook] = mergeFn(options[hook], wrapHookCall(vm, val))
}

function wrapHookCall(vm: ComponentInstance, fn: Function) {
  return (...args: any) => {
    let preVm = getCurrentInstance()
    setCurrentInstance(vm) // 当这个 hooks 被真实调用的时候，将全局唯一的 vm 置为这个实例
    try {
      return fn(...args)
    } finally {
      setCurrentInstance(preVm)
    }
  }
}

export const onMounted = createLifeCycle('mounted')
```

因为 `Composition Api` 设计的规范：在 setup 函数里面去调用生命周期函数，然后在组件的对应生命周期的节点去触发这些函数。因此 `onMounted` 钩子函数内部执行的时候（同步调用），找到当前正在调用的 vm 组件实例。然后完成 `mounted` 钩子的挂载（即对应的 `vm.$options` 配置）。
