## Pinia 实现的简析

Pinia 也可以理解为 Vue 的一个 hook 功能。

`createPinia` 用以创建一个 pinia 实例，这个实例上暴露了挂载 Vue App 的 install 接口，以及自身的插件接口等，`_s` 上保存了不同的 store 实例接口。

```javascript
export function createPinia(): Pinia {
  // 新建一个 scope 实例
  const scope = effectScope(true)

  const state = scope.run<Ref<Record<string, StateTree>>>(() => ref<Recorld<string, StateTree>>())!
}
```

`defineStore` 是一个高阶函数，它返回一个函数 `useStore`，**只有当这个函数执行的时候，才会完成这个 store 实例的创建即初始化**。


```javascript
export function defineStore() {
  ...
  function useStore() {}

  userStore.$id = id

  return useStore
}
```

```javascript
function createOptionStore(id, options, pinia, hot) {
  const { state, actions, getters } = options

  // pinia.state 是一个 ref 类型的数据，所以通过 value 获取对应数据
  const initialState = pinia.state.value[id]

  // 依据 id 值在 Pinia 实例上挂载对应的值
  /**
   * pinia.state: Record<string, Ref<string, unknow>>
   */
  // 初始化 state 的值
  function setup() {
    if (isVue2) {
      set(pinia.state.value, id, state ? state() : {})
    } else {
      pinia.state.value[id] = state ? state() ? {}
    }

    // 将 state 上的数据转化为 ref 数据
    const localState = toRefs(pinia.state.value[id])

    // 返回处理过后的 store 数据：state/getters/actions
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

  // 在 pinia 内部最终都统一通过 createSetupStore 来创建 store 实例
  store = createSetupStore(id, setup, options, pinia, hot)

  store.$reset = function $reset() {
    const newState = state ? state() : {}
    this.$patch(($state) => {
      assign($state, newState)
    })
  }

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
    assign(
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

简答总结下 `createSetupStore` 的流程就是：

1. 首先初始化 store 实例 `_partialStore`（内置了每个 store 实例都需要暴露的 API： `$patch`（类似于 mutation 的效果，只不过比 mutation 更加灵活），`$dispose`，`$subscribe`，`$onAction` 等）；
2. 执行 setup 初始化函数，完成对于 `defineStore` 所接受的 `state`、`getters`、`actions` 进行初始化的操作：

* state 转化为响应式数据；
* getters 转化为 computed；
* actions 通过一层代理函数(wrapAction)用以支持 `$onAction` 等 api；

3. 遍历 `setupStore` （用户定义的 store 数据）合并至 `_partialStore` （内置的初始化 store 实例）上，最终返回 store 实例。

可以看到通过 `defineStore` 去定义一个 `store` 并执行 `useStore` 获取到最终的 store 实例，对于这个 store 实例本身而言，用户定义的 state/getters/actions 都被扁平化的挂载到了 store 实例上了。因此在使用 composition-api 的代码组织方式下，可以直接通过 store 去访问这些数据/方法：

```javascript
const useStore = defineStore('storeId', {
  state: () => {
    return {
      count: 0,
      hasChanged: true
    }
  },
  actions: {
    increment() {
      this.count++
    }
  }
})

const store = useStore()
store.count++ // 直接操作 state 数据

store.increment() // 通过 action 操作 state 数据
```

**和 `vuex` 当中不一样的地方是 vuex 约定更新 state 的值都需要通过 mutation 的操作来更改。在 `pinia` 当中可以直接操作 state 数据。**


接下来看下 store 实例上提供的内置的方法都有哪些以及是如何去工作的：


```javascript
// $subscribe
const subscriptions: SubscriptionsCallback<S>[] = markRaw([])

const partialStore = {
  $subscribe(callback, options = {}) {
    const removeSubscription = addSubscription(
      subscriptions,
      callback,
      options.detached,
      () => stopWatcher
    )

    const stopWatcher = scope.run(() => {
      watch(
        () => pinia.state.value[$id],
        (state) => {
          if (options.flush === 'sync' ? isSyncListening : isListening) {
            callback(
              {
                storeId: $id,
                type: MutationType.direct, // 'direct'
                events: debuggerEvents
              },
              state
            )
          }
        },
        assign({}, $subscribeOptions, options)
      )
    })!

    return removeSubscription
  }
}
```

`$subscribe` 方法主要是提供了订阅 state 数据发生变化的处理机制，`subscriptions` 数组保存了所有的订阅函数。可以看到在这个方法内部是通过 `watch` 函数去监听 `state` 数据，如果 `state` 数据发生变化即触发订阅函数（`direct` 类型，和下面的 `$patch` 方法的类型不一样）`options` 配置可以控制 `watch` 方法的执行机制。

在 `watch` 的回调当中注意到有对 `flush` 类型以及2个开关的判断，这主要也是为了区别于 state 发生变化触发订阅函数回调的不同方式。


```javascript
// $patch
function $patch(partialStateOrMutator) {
  // 注意这2个开关的设置，会影响到在 $patch 执行过程中对于 state 进行操作时是否会触发 $subscribe 的回调函数
  isListening = isSyncListening = false
  // $patch 既可接受函数也可接受 plain object 的形式
  if (typeof partialStateOrMutator === 'function') {
    partialStateOrMutator(pinia.state.value[$id])
    subscriptionMutation = {
      type: MutationType.patchFunction, // 'patch function'
      storeId: $id,
      events: debuggerEvents
    }
  } else {
    mergeReativeObjects(pinia.state.value[$id], partialStateOrMutator)
    subscriptionMutation = {
      type: MutationType.patchObject, // 'patch object'
      payload: partialStateOrMutator,
      storeId: $id,
      events: debuggerEvents
    }
  }
  const myListenerId = (activeListener = Symbol())
  nextTick().then(() => {
    if (activeListener === myListenerId) {
      isListening = true
    }
  })
  isSyncListening = true
  // because we paused the watcher, we need to manually call the subscriptions
  triggerSubscriptions(
    subscriptions,
    subscriptionMutation,
    pinia.state.value[$id] as UnwrapRef<S>
  )
}
// $dispose

// $onAction
```

pinia 提供了一个比较灵活的 api：$patch 进行批量数据的更新，和 vuex 当中的 mutation 有点类似，都不允许进行异步的操作， vuex 提供的 mutation 规范有更强的约束性，不过最终所达到的效果来看 $patch 可以看做是对于 vuex mutation 语义上的一层抽象。

在 \$patch 内部的实现当中，`pinia.state.value[$id]` 根据 $id 值保存了不同 store 实例的 state 的数据，且为响应式，在方法执行一开始就将 `isListening` 和 `isSyncListening` 置为 `false`。**这样做的目的主要是为了避免在 $patch 过程当中更新 state 数据的时候会触发 $subscribe 保存的订阅函数。而将订阅函数的触发改为在 $patch 方法内部调用 triggerSubscriptions 方法来出发订阅函数的执行。**这也是通过 $patch 方法去更新数据和直接更新数据两种方式在 pinia 内部的触发订阅函数的差异点。因为如果是通过直接更新数据的方式会直接交由 watch callback 去触发，而非在 $patch 内部手动调用订阅函数。


```javascript
// $onAction

let actionSubscriptions: StoreOnActionListener<Id, S, G, A>[] = markRaw([])

const partialStore = {
  ...
  $onAction: addSubscription.bind(null, actionSubscriptions)
}
```


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


-----

Pinia 内部使用了 [`vue-demi`](https://github.com/vueuse/vue-demi) 这个 pkg 暴露了兼容 vue2&vue3 2个版本的api。

------

相关文章：

* [vue-demi 介绍](https://antfu.me/posts/make-libraries-working-with-vue-2-and-3)