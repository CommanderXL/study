## Pinia 实现的简析

Pinia 也可以理解为 Vue 的一个 hook 功能。

`createPinia` 用以创建一个 pinia 实例，这个实例上暴露了挂载 Vue App 的 install 接口，以及自身的插件接口等，`_s` 上保存了不同的 store 实例接口。

```javascript
export function createPinia(): Pinia {
  const scope = effectScope(true)

  const state = scope.run<Ref<Record<string, StateTree>>>(() => ref<Recorld<string, StateTree>>())!
}
```

`defineStore` 是一个高阶函数，它返回一个函数 `useStore`，只有当这个函数执行的时候，才会完成这个 store 实例的创建。


```javascript
export function defineStore() {

}
```

```javascript
function createOptionStore(id, options, pinia, hot) {
  const { state, actions, getters } = options

  const initialState = pinia.state.value[id]

  // 依据 id 值在 Pinia 实例上挂载对应的值
  function setup() {
    if (isVue2) {
      set(pinia.state.value, id, state ? state() : {})
    } else {
      pinia.state.value[id] = state ? state() ? {}
    }

    const localState = toRefs(pinia.state.value[id])

    // 返回这个 store 上定义的数据
    return assign(
      localState,
      actions,
      Object.keys(getters || {}).reduce((computedGetters, name) => {
        // 将 getters 转化为 computed 数据
        computedGetters[name] = markRaw(computed(() => {
          setActivePinia(pinia)

          const store = pinia._s.get(id)!

          return getters![name].call(store, store)
        }))
      })
    )
  }

  store = createSetupStore(id, setup, options, pinia, hot)

  store.$reset = function $reset() {}

  return store as any
}
```

```javascript
function createSetupStore($id: Id, setup: () => SS, options, pinia, hot) {

  const partialStore = {
    _p: pinia,
    $id,
    $onAction,
    $patch,
    $reset,
    $subscribe(callback, options = {}) {},
    $dispose,
  } as _StoreWithState<Id, S, G, A>

  // 依据 partialStore 初始化 store，这个时候 store 实例仅包括内部的一些方法
  const store: Store<Id, S, G, A> = reactive(
    assing(
      ...,
      partialStore
    )
  ) as unknown as Store<Id, S, G, A>

  // 通过 id 注册 store 实例至 pinia 上
  pinia._s.set($id, store)

  // 执行 setup 方法完成对于 defineStore 接受到的 options 初始化后的值
  const setupStore = pinia._e.run(() => {
    scope = effectScope()
    return scope.run(() => setup())
  })!

  for (const key in setupStore) {
    const prop = setupStore[key]

    if ((isRef(prop)) && !isComputed(prop) || isReactive(prop)) {
      ...
    } else if (typeof prop === 'function') { // 对于 action 的代理，用以支持 subscribe 等 api
      const actionValue = __DEV__ && hot ? prop : wrapAction(key, prop)

      if (isVue2) {
        set(setupStore, key, actionValue)
      } else {
        setupStore[key] = actionValue
      }
    }
  }

  if (isVue2) {
    Object.keys(setupStore).forEach(key => {
      set(
        store,
        key,
        // @ts-expect-error: valid key indexing
        setupStore[key]
      )
    })
  } else {
    assign(store, setupStore)
    // allows retrieving reactive objects with `storeToRefs()`. Must be called after assigning to the reactive object.
    // Make `storeToRefs()` work with `reactive()` #799
    assign(toRaw(store), setupStore)
  }

  // 执行挂载至 pinia 的插件
  pinia._p.forEach((extender) => {
    ...
  })

  ...
  return store
}
```

简答总结下这里面的流程就是：在 createSetupStore 里面首先初始化 store 实例 `_partialStore`（包含了 store 实例所暴露出的 `$patch`，`$dispost`，`$subscribe` 等方法），然后执行 setup 操作完成对于 `defineStore` 所接受的 `state`、`getters`、`actions` 进行初始化的操作：

* state 转化为响应式数据
* getters 转化为 computed 
* actions 被做了一层代理用以支持 `$subscribe` 等 api

最终遍历 `setupStore` 合并至 `_partialStore` 上。

在 Pinia 中还提供了 `mapHelpers` 辅助函数用以支持不使用 composition api 的场景下使用：

* `mapStores`

将多个 store 够挂载到当前的 vue instance 上面，这样就可以通过 `this.xxxStore` 这种方式访问到 store 实例，进而可以访问 store 实例上的 state，action 方法等。这个 api 的场景一般适用就是需要大量借助辅助函数来获取 store 实例暴露出来的数据。但是一般场景下，都是按需使用辅助函数来解构使用我们需要的不同 store 实例上的数据。

```javascript
import { mapStores } from 'pinia'

// given two stores with the following ids
const useUserStore = defineStore('user', {
  // ...
})
const useCartStore = defineStore('cart', {
  // ...
})

export default {
  computed: {
    // note we are not passing an array, just one store after the other
    // each store will be accessible as its id + 'Store'
    ...mapStores(useCartStore, useUserStore)
  },

  methods: {
    async buyStuff() {
      // use them anywhere!
      if (this.userStore.isAuthenticated()) {
        await this.cartStore.buy()
        this.$router.push('/purchased')
      }
    },
  },
}
```

* `mapState`
* `mapGetters` 和 `mapState` 等价
* `mapActions`