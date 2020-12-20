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

其实可以看到 `reactive` 内部首先通过 `Vue.observable` api 完成数据的响应式的处理。然后再针对 `setup` 函数的调用做针对性的处理，主要就是对于数据做进一步的代理工作，用以支持 `ref` 类型数据的访问的 `unwrap` 自动展开的处理。 

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

由于基本数据类型特性的原因，如果需要变成可响应式的数据，那么是需要通过一层代理，将基本数据类型转化为 `object`，然后再将这个 `object` 转化为响应式的数据，之后的数据变更都通过这个 `object` 来完成操作。在 `@vue/composition-api` 内部实现当中，是直接构造了一个普通对象：

```javascript
{
  [RefKey]: raw
}
```

这个普通对象经由 `reactive` api 的处理转化为了响应式的数据。因此通过访问 `object[RefKey]` 上的 getter/setter 函数便可完成响应式数据的收集与通知等操作。

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

### Computed

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

其他的生命周期钩子函数的挂载方式与此一样。
