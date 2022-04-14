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

插件混入了全局的钩子函数，在 `beforeCreated` 执行的阶段完成一些 composition api 初始化的操作。

```javascript
// src/mixin.ts
export function mixin(Vue: VueConstructor) {
  Vue.mixin({
    beforeCreate: functionInitApi,
    mounted(this: ComponentInstance) {
      afterRender(this)
    },
    beforeUpdate() {
      updateVmAttrs(this as ComponentInstance)
    },
    updated(this: ComponentInstance) {
      afterRender(this)
    },
  })

  // 在 beforeCreate 阶段完成一些 api 的挂载/改造的功能，这个时候并没有实际的执行
  function functionInitApi(this) {
    const vm = this
    const $options = vm.$option
    // 获取 setup 函数
    const { setup, render } = $options

    ...
    const { data } = $options.data
    // wrapper the data option, so we can invoke setup before data get resolved
    $options.data = function wrappedData() {
      // setup 执行的动作是在 data 初始化之前的阶段去完成的
      initSetup(vm, vm.$options)
      return isFunction(data)
        ? (
          data as (this: ComponentInstance, x: ComponentInstance) => object
        ).call(vm, vm)
        : data || {}
    }
  }

  function initSetup(vm: ComponentInstance, props: Record<any, any> = {}) {
    const setup = vm.$options.setup!
    const ctx = createSetupContext(vm)
  }

  function createSetupContext(vm: ComponentInstance & { [x: string]: any }): SetupContext {

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

在 `Vue` 在整个设计当中，响应式系统作为联系数据与模板的桥梁。`Composition Api` 使用的是一套独立的响应式系统，这套系统可以脱离 vue 的环境来被使用。

### Reactive

`reactive` 作为一个独立的响应式 api 被暴露出来。

```javascript
import { reactive } from '@vue/composition-api'

const state = reative({
  age: 21,
  name: 'Phatom'
})
```

在 `reactive` api 的内部实现当中：

```javascript
// src/reactivity/reactive.ts

export function reactive<T extends object>(obj: T) UnwrapRef<T> {
  ...
  const observed = observe(obj) // observe 方法内部实际调用 Vue.observable 来完成响应式数据的改造，返回一个 observable 实例
  setupAccessControl(observed) // 完成响应式数据的构造后，交由 setupAccessControl 来做进一步的数据访问的代理工作
  return observed as UnwrapRef<T>
}

/**
 * Proxing property access of target.
 * We can do unwrapping and other things here.
 */
function setupAccessControl(target: AnyObject): void {
  if (
    !isPlainObject(target) ||
    isRaw(target) ||
    Array.isArray(target) ||
    isRef(target) ||
    isComponentInstance(target) ||
    accessModifiedSet.has(target)
  )
    return

  accessModifiedSet.set(target, true)

  // 遍历对象上所有的 key 值来定义对应的 value 的代理策略
  const keys = Object.keys(target)
  for (let i = 0; i < keys.length; i++) {
    defineAccessControl(target, keys[i])
  }
}

/**
 * Auto unwrapping when access property
 */
export function defineAccessControl(target: AnyObject, key: any, val?: any) {
  if (key === '__ob__') return
  if (isRaw(target[key])) return

  let getter: (() => any) | undefined
  let setter: ((x: any) => void) | undefined
  const property = Object.getOwnPropertyDescriptor(target, key)
  if (property) {
    if (property.configurable === false) {
      return
    }
    // 获取通过 Vue.observable 处理过的数据的 getter/setter 函数
    getter = property.get
    setter = property.set
    if (
      (!getter || setter) /* not only have getter */ &&
      arguments.length === 2
    ) {
      val = target[key]
    }
  }
  // 深度优先
  setupAccessControl(val)
  // 改写了对应值的 getter / setter 函数，实际是对原 getter / setter 函数做进一步的代理
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get: function getterHandler() {
      // 访问 Vue.observable 处理过后的数据 getter 函数，这里也有完成了响应式的数据的收集工作
      const value = getter ? getter.call(target) : val
      // if the key is equal to RefKey, skip the unwrap logic
      if (key !== RefKey && isRef(value)) {
        return value.value // 对于 ref 类型数据的 unwrap 操作
      } else {
        return value
      }
    },
    set: function setterHandler(newVal) {
      if (getter && !setter) return

      // 访问 Vue.observable 处理过后的数据 getter 函数，这里也有完成了响应式的数据的收集工作
      const value = getter ? getter.call(target) : val
      // If the key is equal to RefKey, skip the unwrap logic
      // If and only if "value" is ref and "newVal" is not a ref,
      // the assignment should be proxied to "value" ref.
      if (key !== RefKey && isRef(value) && !isRef(newVal)) {
        value.value = newVal // 对于 ref 类型数据的 unwrap 操作
      } else if (setter) {
        setter.call(target, newVal)
      } else {
        val = newVal
      }
      setupAccessControl(newVal)
    },
  })
}
```

其实可以看到 `reactive` 内部首先通过 `Vue.observable` api 完成数据的响应式的处理。然后有一个非常重要的操作：`setupAccessControl`，主要就是对于经过 `Vue.observable` 处理后的数据重置原有的代理实现，主要是为了兼容 `ref` 数据类型（对于 ref 数据的访问/改写都通过 value.value 属性进行操作，即自动的 `unwrap` 自动展开，如果不是 `ref` 数据类型的话，那么还是和原有的访问保持一致）。

### Ref

```javascript
import { ref } from '@vue/composition-api'

let val = ref(1) // val 实际上是一个 RefImpl 实例对象

val.value = 2
```

> 接受一个参数值并返回一个响应式的可改变的 `ref` 对象。`ref` 对象拥有一个指向内部值的单一属性 `.value`

```javascript
export function ref<T extends object>(
  raw: T
): T extends Ref ? T : Ref<UnwrapRef<T>>
export function ref<T>(raw: T): Ref<UnwrapRef<T>>
export function ref<T = any>(): Ref<T | undefined>
export function ref(raw?: unknown) {
  if (isRef(raw)) {
    return raw
  }

  // RefKey => composition-api.refKey
  // ref 函数会构造一个 obj
  /**
   * {
   *   'composition-api.refKey': val
   * }
   */

  // 首先创建一个响应式的数据，以 RefKey 作为 key
  const value = reactive({ [RefKey]: raw })
  // 创建一个 ref 的代理，传入自定义的 getter / setter 函数，内部实际访问的是这个响应式数据的值
  return createRef({
    get: () => value[RefKey] as any,
    set: (v) => ((value[RefKey] as any) = v),
  })
}

export function createRef<T>(options: RefOption<T>, readonly = false) {
  // 使用 RefImpl 创建一个 ref 实例
  const r = new RefImpl<T>(options)
  // seal the ref, this could prevent ref from being observed
  // It's safe to seal the ref, since we really shouldn't extend it.
  // related issues: #79
  const sealed = Object.seal(r)

  readonlySet.set(sealed, true)
  return sealed
}

class RefImpl<T> implements Ref<T> {
  readonly [_refBrand]!: true
  public value!: T
  constructor({ get, set }: RefOption<T>) {
    // 对这个 ref 类型的值定义一个 value 键名的代理，通过 get / set 函数，这样也就和响应式系统给关联上了
    // 所以 compositable api 对于 ref 类型值的访问需要通过 value 属性
    proxy(this, 'value', {
      get,
      set,
    })
  }
}
```

如何理解通过 `ref` 构造的数据：

由于基本数据类型特性的原因，如果需要变成可响应式的数据，那么是需要通过一层代理，将基本数据类型转化为 `object`，然后再将这个 `object` 转化为响应式的数据（还是通过 `reative` 来完成数据的改造），之后的数据变更都通过这个 `object` 来完成操作。在 `@vue/composition-api` 内部实现当中，是直接构造了一个普通对象：

```javascript
// RefKey 是一个自定义的字符串 composition-api.refKey
{
  [RefKey]: raw
}
```

这个普通对象经由 `reactive` api 的处理转化为了响应式的数据。因此通过访问 `object[RefKey]` 上的 getter/setter 函数便可完成响应式数据的收集与通知等操作。虽然对于 Primitive Value 已经构造出来了响应数据，但是这个时候还不够，因为这个响应式数据的 key 是 `composition-api.refKey`，肯定不能通过这个 key 去直接访问。因此针对这个问题，再一次的对这个响应式数据做了一层代理，即创建一个 `RefImpl` 实例，这个实例上的 `value` 属性可以访问到响应式数据。

通过 `ref` 构造的数据是 `RefImpl` 类的实例对象，这个实例对象具有唯一可供遍历的键名：`value`。因此在 `ref` 作为 `reactive` 对象的属性进行访问或修改的时候会自动 `unwrap` 对应的 `value` 值，因此不再需要单独通过 `.value` 的写法去访问：

```javascript
const count = ref(0)
const state = reactive({
  count,
})

console.log(state.count) // 0

state.count = 1
console.log(count.value) // 1
```

> 注意当嵌套在 reactive Object 中时，ref 才会解套。从 Array 或者 Map 等原生集合类中访问 ref 时，不会自动解套：

```javascript
const arr = reactive([ref(0)])
// 这里需要 .value
console.log(arr[0].value)

const map = reactive(new Map([['foo', ref(0)]]))
// 这里需要 .value
console.log(map.get('foo').value)
```

## 其他的一些 API

### computed

在 `computed` 的实现里面，首先是获取当前正在访问的组件实例，并完成 getter/setter 的初始化工作。需要注意的是 `computed` 方法返回的数据类型为 ref。这里也可以回忆下，对于将 plain object 类型的数据变为响应式的是通过 `reactive` 来完成的，最终得到的数据也可以直接访问原有数据上的 key 来获取对应的值。但是对于 Primitive value 使用 ref 或者是对于使用 computed 构造出的一个新的变量值，其实这两者都会遇到一个获取这个构造之后的响应式数据值的问题，因为对于 plain object 来说，直接访问对应的 key 就好了，但是这2者的数据类型最终都为封装为：`{ [RefKey]: raw }`，所以最终会给这个不太方便访问实际值的 plain object 创建一个新的 `value` 属性以供访问。

```javascript
export function computed(gettersOrOptions) {
  const vm = getCurrentScopeVm()

  if (vm && !vm.$isServer) {
    const { Watcher, Dep } = getVueInternalClasses()
    let watcher: any
    computedGetter = () => {
      if (!watcher) {
        // 初始化 watcher，且为 lazy 模式，实际的 getter 函数还未执行
        watcher = new Watcher(vm, getter, noopFn, { lazy: true })
      }
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }

    computedSetter = (v: T) => {
      if (setter) {
        setter(v)
      }
    }
  } else {
    ...
  }

  // 最终是返回的一个 ref 数据，和普通的 ref(1) 构建处理的数据不一样的点是这个 ref 带有一个 effect 属性
  return createRef<T>(
    {
      get: computedGetter,
      set: computedSetter
    },
    !setter,
    true
  ) as WriteableComputedRef<T> | ComputedRef<T>
}
```

### effectScope

### watchEffect

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

因为 `Composition Api` 设计的规范：在 setup 函数里面去调用生命周期函数，然后在组件的对应生命周期的节点去触发这些函数。因此 `onMounted` 钩子函数内部执行的时候（同步调用），在全局当中找到当前正在调用的 vm 组件实例。然后完成 `mounted` 钩子的挂载（即对应的 `vm.$options` 配置）。

这里需要注意的是 `setup` 函数执行的时机是在 `initData` 之前，在组件的生命周期里面，这是一个非常靠前的时间节点（因为很多生命周期函数都还没有调用），那么这些生命周期的 hooks 所要完成的工作就是收集在 `setup` 里面调用的这些 lifecycle hook 的 callback。因为 Vue 里面提供了一个有关 options 合并的策略函数，具体参见 `core/utils/options.js`：

```javascript
/**
 * Hooks and props are merged as arrays.
 */
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  const res = childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
  return res
    ? dedupeHooks(res)
    : res
}

function dedupeHooks (hooks) {
  const res = []
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i])
    }
  }
  return res
}

LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})
```

其实就是完成 lifecycle callback 合并到一个数组的工作。然后在这个组件进行到实际的生命周期的时候就会执行之前已经收集好的 callback。
