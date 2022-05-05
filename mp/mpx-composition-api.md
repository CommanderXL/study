## 一次 mpx 对于 web 生态能力复用的探索

不同于其他的全运行时小程序框架可以在上层直接使用 Vue、React，在生态能力的复用上会更加的容易，用一部分的性能牺牲换取了开发体验。mpx 作为编译型小程序框架依托小程序规范做能力增强，运行时部分极为轻量简洁，配合编译构建阶段的包体积优化和基于Render Function的数据依赖追踪做到业内小程序的性能最优。

在我们的实际业务场景当中也经常会遇到 mpx 转 web，然后想复用 web 生态能力的场景，例如在司机运营活动的场景中，我们沉淀了在 web 场景下统计页面元素节点曝光的工具库: [exposure-lib
](https://github.com/hubvue/exposure-lib)，不过我们的项目是使用 mpx 来做跨平台的开发，所以在跨 web 场景下，mpx 通过暴露 `mpx.__vue` 这个 Vue Constructor 来给 `exposure-lib` 消费，最终使用 mpx 进行 web 侧的开发也可以非常便利的去享用 web 生态的能力。
 
上周花了几天时间尝试探索 mpx 在小程序侧对于 web 生态能力的复用。核心的目的是更加深入的了解在以后的业务迭代当中是否有更多的可能将 web 生态当中的能力直接嵌入到 mpx 小程序侧当中来做功能的拓展，用以减少代码的维护以及开发成本。

在这里我是尝试在不改动目前 mpx 整体架构源码的情况下去支持 composition-api 能力的尝试和探索。

### 简单介绍

mpx 设计理念是基于小程序规范做渐进增强，在小程序框架里每个 Component，Page 构造函数其实内部是做了一定程度的实例封装，所以对于 mpx 来说，渐进增强的核心也就是对于 Component，Page 在运行时环节做能力增强，剩下的渲染工作交给小程序的框架去接管。这块在跨 web 的场景中也是一样，组件的生命周期、渲染等等都是由 Vue 去接管的，在运行时环节需要做的一项比较重要的工作就是 api 差异的抹平。（这里可以有个图来展示框架渲染以及 mpx 所做的工作）

在接口设计层面，在组件内部要想获取数据，方法都是通过组件实例(这里的组件实例也就是小程序的组件实例，mpx 对于这个实例做了增强) this 去访问，mpx 通过暴露一个 Factory Function，外部通过这 Factory Function 的原型拓展其他的属性、方法。当小程序的实例进入实例化阶段(MpxProxy)后，再完成将 Factory Function 的原型拓展挂载至小程序的实例 this 上。在这里面有2个实例需要区分下，一个就是小程序原本的实例，还有一个是 mpxProxy，他们之前的关系是：

```javascript
this.__mpxProxy = mpxProxy
```

在 mpxProxy 内部接管了当前小程序实例的响应式数据初始化、数据 diff 以及建立响应式数据和 render watcher 之间的联系等。从这些功能的角度来说，mpxProxy 和一个 Vue 实例提供的功能是有重合的，当然差异还是比较大，因为 Vue 实例是由 Vue Constructor 实例化出来的，所以继承了各种拓展的属性和方法。但是对于 mpxProxy 来说仅做小程序实例的增强的工作，并不承载对外暴露接口去完成拓展，都是交由 Factory Function 的原型拓展来完成，例如mixin，响应式接口等都是通过 Factory Function 去暴露的，所以 mpxProxy 和 Vue 实例之间从功能和定位来说差异较大。

在开始介绍整个的方案前，首先看下 `Vue@2.x` 对于 composition-api 的支持，整体还是采用插件的方式去增强这部分的能力，强依赖 Vue Constructor 全局构造函数，通过 `mixin`、`optionMergeStrategies` 等能力去改变 Vue 实例化的组件的能力和行为：

* Setup：全局 mixin beforeCreate hook；
* LifeCycle Hooks：利用 optionMergeStrategies 的机制，动态收集并更新 LifeCycle Hooks；
* Reactive：依赖 `Vue.observable` 完成响应式数据初始化；
* ...

对于 mpx 而言，同样提供了全局 mixin 的能力（通过 Factory Function 暴露的），以及在小程序开始实例化之前的 beforeCreate hook，在 LifeCycle Hooks 方面依托小程序的 Hooks 构建了一套 mpxProxy inner LifeCycle Hooks，此外 mpx 目前的响应式系统基本和 `Vue@2.x` 保持一致。

在这样的一个前提下思考：**是否可以直接复用 `@vue/composition-api` 的能力，将这个属于 vue 的插件作为 mpx 的插件来使用，用以实现 mpx 的 composition-api 能力**，这样 mpx 不管在开发小程序还是跨 web 场景的应用下都可以使用 composition-api 能力，且不需要单独维护一个完整的 composition-api 的 package。

最终我尝试的思路是：**将 mpxProxy 做能力增强，以供 `@vue/composition-api` 来消费使用，`@vue-composition-api` 所依赖的所有的能力都由 mpxProxy 来提供**。

这里我想分几个模块来说下这部分的工作：

### 插件使用

对于插件的使用上来说，在 mpx 的插件系统设计当中，插件接受到的是一个全局唯一个 Factory Function，所有的插件都可以在原型链上挂载需要拓展的方法，这些方法最终会被代理至小程序实例上。但是这样一个 Factory Function 是无法直接被 composition-api 插件所使用的，因为插件内部还依赖一些由 mpxProxy 提供的能力。在 mpx 当中这个 Factory Function 更多的仅用作属性的拓展的功能。因此对于插件的使用上做了一点改造，使得插件直接访问 MpxProxy，插件所需要的能力统一收敛至 MpxProxy 上来访问：

```javascript
import VueCompositionAPI from '@vue/composition-api'
import MpxProxy from '@mpxjs/core/src/core/proxy.js'

const rawInstall = VueCompositionAPI.install
VueCompositionAPI.install = function (proxy1, options, proxy2) {
  rawInstall(MpxProxy, options)
}
```

这样插件可以直接作用于 MpxProxy，从而对小程序实例做增强。（不过这里面需要注意的一点是插件在执行过程中即会使用到 MpxProxy 的能力，同时也会使用小程序的实例）

### 对于 setup() 支持

`setup` 函数接受2个参数，第一个为组件定义的 `properties`，另外一个是 setup 的上下文 context，上下文 context 提供了事件触发(emit)，获取模板节点实例(refs)等属性和方法(这里只列了非常关注的2个点)。

因为 composition-api 是在 beforeCreate hook 对于 data 做了一层代理，在获取 data 之前完成 setup 函数的执行。

```javascript
<template>
  <view wx:ref="viewRef">this is view</view>
  <button bindtap="updateValue"></button>
</template>

import { createComponent } from '@mpxjs/core'
import { onMounted } from '@vue/composition-api'

createComponent({
  properties: {
    name: {
      type: string,
      value: 'Foo'
    }
  },
  setup(props, { emit, refs }) {
    props.name // 获取 props 属性

    onMounted(() => {
      console.log(refs.viewRef) // 获取 ref 属性
    })

    const updateValue = () => {
      emit('updateValue') // 触发事件
    }

    return {
      updateValue
    }
  }
})
```

setup 函数提供的这个 context 上下文，可以理解为对于组件实例的部分方法属性的一个代理，因为最终都还是从组件实例上获取的。不过这个 context 是在 `@vue/composition-api` 内构造出来的，这部分的内容是我们无法侵入的。

所以对于 setup() 的支持，从功能这个角度是可以拉齐的，不过在 API 的调用和属性访问上不太好拉齐，主要体现在事件触发，以及 refs 获取上，使用起来还是有点心智负担（小程序获取 refs 属性是 $refs，事件触发是 triggerEvent）。

### Reactivity APIs

在响应式系统方面，mpx 本身的能力和 vue 保持一致。插件仅依赖响应式接口 `obserable`，所以在支持 Reactivity APIs （例如 `reactive`、`ref` 等）的时候只需要对 MpxProxy 提供静态方法 `observable`：

```javascript
export default class MpxProxy {
  constructor() {
    ...
  }

  static observable(...args) {
    return EXPORT_MPX.observable(...args)
  }
}
```

不过在支持 `computed`、`watch` 等相关 API 的时候。因为 vue 引入了一套更加抽象的统一管理副作用的 API：`EffectScope`，可以说是整个 vue 的响应式系统都是基于 `EffectScope` 来构建的。事实上一个 `EffectScope` 和一个组件实例一一对应，有可能这个组件实例并非承载实际渲染页面的作用，仅仅是用作管理副作用的容器而存在。

不过在目前 mpx 的设计当中，mpxProxy 是强依赖小程序实例以及实例的生命周期的，他们之间是一一绑定的关系，也就意味着 mpxProxy 没法脱离小程序实例使用。但是 mpx 要实现 composition-api 同样也会遇到统一管理副作用的问题。所以 mpxProxy 的作用不仅仅需要对于小程序实例做增强，同时也需要作为管理副作用的容器。同时容器还需要具备自己的初始化（收集副作用）和销毁（清除副作用）的一套逻辑。

那么针对这个问题，对于 mpxProxy 的生命周期做一点闭环改造，`created` 阶段在构造函数的时候便开始调用：

```javascript
// core/src/core.js
export default class MpxProxy {
  constructor(
    options, 
    target = {
      __getInitialData: () => {},
      __render: () => {}
    }, 
    params = []
  ) {
    ...
    this.created(params)
  }
}
```

这样最终 MpxProxy 可脱离小程序的实例单独实例化，不仅仅承载了对于小程序实例增强的工作，同时还作为整个 composition-api 系统当中管理副作用的容器而使用。

因为 mpx 的响应式系统基本和 Vue 保持一致，所以对于 Reactive API: `watch`、`computed`、`reactive`、`ref`、`watchPostEffect`、`watchSyncEffect` 等可以非常低的成本去支持。因为 Reactive API 不依赖平台，所以在使用上也比较顺滑。

### LifeCycle

在 mpx LifeCycle 的设计当中是依托不同平台（小程序/vue）的生命周期进行构建，因此实际上存在2套生命周期，一套是各平台的(小程序/vue)组件的生命周期，以及 mpx 依托这些平台组件的生命周期而自己内部定义的一套 mpxProxy 生命周期。在小程序实例的关键 LifeCycle Hook 将用户定义的生命周期收敛至 mpxProxy 内部统一的生命周期进行管理。

```javascript
// 第一层级为(小程序/vue)生命周期(以微信平台组件实例生命周期举例)，第二层级为 mpxProxy 生命周期
--- attached
  |-- __created__
--- ready
  |-- __mounted__
--- detached
  |-- __destory__
```

在实现 composition-api 过程中有个比较核心的点就是动态更新生命周期 Hooks，例如在 Vue 当中是在 setup 执行过程中去收集其他的生命周期 Hooks，并动态更新。

对应到小程序平台侧，首先**明确一点就是小程序自身的生命周期 Hooks 是没法动态更新的，这里的动态更新也是利用 mpxProxy 内部定义的一套生命周期，在小程序 setup 函数执行并收集完生命周期 Hooks 后也是动态更新的内部生命周期**。

所以针对 LifeCycle Hooks 的实现做了如下的改造：

1. LifeCycle optionMergeStrategies 补齐(@vue/composition-api 强依赖合并策略)；
2. setup 函数执行收集完 LifeCycle Hooks 后，部分 Web 侧生命周期需转化为 mpxProxy 内部生命周期；

```javascript
import { mergeWebHook } from '../helper/utils'

const LIFECYCLES_HOOKS = [
  'beforeMount',
  'mounted',
  'updated',
  'destoryed'
]

const mpxProxyConfig = {
  optionMergeStrategies: {}
}

LIFECYCLE_HOOKS.forEach(hook => {
  mpxProxyConfig.optionMergeStrategies[hook] = mergeWebHook
})


export default class MpxProxy {

  static config = mpxProxyConfig

  constructor() {}

  initData (data, dataFn) {
    if (typeof data === 'function') {
      data = data()

      // web 侧生命周期转化为 mpxProxy 内部生命周期
      INNER_LIFECYCLES.forEach(lifecycle => {
        const webLifecycle = lifecycle.replace(/_/g, '')
        if (this.options[webLifecycle]) {
          this.options[lifecycle] = this.options[webLifecycle]
          delete this.options[webLifecycle]
        }
      })
      // 收集 setup 返回的响应式数据，作为小程序渲染逻辑
      if (this.target.__composition_api_state__) {
        const { rawBindings = {} } = this.target.__composition_api_state__
        Object.keys(rawBindings).forEach(name => {
          if (hasOwn(this.target, name)) {
            this.localKeysMap[name] = true
          }
        })
      }
    }
  }
}
```

当然对于 LifeCycle Hooks 的支持也并没有那么的理想，功能上是可以拉齐的，不足主要还是体现在 mpx 的设计当中是以小程序的生命周期为书写标准，所以在使用 `@vue/composition-api` 暴露出来的 Hooks 肯定是和原有的小程序的生命周期 Hook 有差异的，使用过程中肯定是有一定的心智负担的。

### 事件

在 composition-api 中事件方法和组件的实例进行绑定是在 setup 执行完后完成的。

在小程序侧的 methods 可以动态挂载，即：

```javascript
<template>
  <button bindtap="toggle">按钮点击</button>
<template>

<script>
import { createComponent } from '@mpxjs/core'

createComponent({
  lifetimes: {
    ready() {
      this.tapBtn = function () {
        console.log('tapBtn')
      }
    }
  }
})
</script>
```

所以可以在 `setup` 里面直接返回事件处理函数：

```javascript
<template>
  <button bindtap="toggle">按钮点击</button>
<template>

<script>
import { createComponent } from '@mpxjs/core'

createComponent({
  setup(props, { emit, refs }) {
    const toggle = function () {
      console.log('tapBtn')
    }

    return {
      toggle
    }
  }
})
</script>
```

setup 函数执行完后返回的方法、属性都会挂载至小程序实例上。**不过在支持事件的时候，因为 setup context 是在 `@vue/composition-api` 内部构造的一个全新的 context，所以触发事件的 API(`emit`)和小程序(`triggerEvent`)目前没法拉齐**，为了支持事件也只能抹平对应的能力：

```javascript
// todo 事件的支持
mpx.prototype.$emit = function (...args) {
  this.triggerEvent(...args)
}
```

所以在事件的支持上也只能做到功能上能拉齐，但是 API 的调用和原本的事件调用有些差异的。

### Store

mpx Store 的使用不依赖 mpx 的插件系统，而是一个比较独立的 Reactive 模块。所以在 store 的使用上是非常顺滑的：

```javascript
// store.js
import { createStore } from '@mpxjs/core'

export default createStore({
  state: {
    city: 'bj'
  },
  mutations: {
    updateCity(state, val) {
      state.city = val
    }
  }
})

// list.mpx
<template>
  <view>the city is: {{ newCity }}</view>
  <button bindtap="changeCity">change city</button>
</template>

<script>
import { createComponent } from '@mpxjs/core'
import store from 'store'
import { computed } from '@vue/composition-api'

createComponent({
  setup(props) {
    const { state } = store

    const newCity = computed(() => state.city)
    const changeCity = () => {
      store.commit('updateCity', 'sh')
    }

    return {
      newCity,
      changeCity
    }
  }
})
</script>
```

### 总结

最终的代码实现可以参见这个 [commit](https://github.com/CommanderXL/mpx/commit/d8b270d18141571c019bd69d6852397298efa980)。

主要还是分为两大块，第一个为插件部分，对应到：`core/composition.js` 这部分，核心主要是抹平小程序平台/web侧的插件使用，这部分也是作为一个插件被 mpx 所消费。

```javascript
import mpx from '@mpxjs/core'
import MpxCompositionAPI from '@mpxjs/composition-api' // 对应到 core/composition.js  

mpx.use(MpxComsotionAPI)
```

另外一部分是 `core/proxy.js` 里面对于 mpxProxy 能力的增强。

顺着不改变 `@mpxjs/core` 的整体架构逻辑，只做小部分的 mpxProxy 的能力增强，同时直接引入 `@vue/composition-api` 作为 mpx 的 composition-api 能力的实现这样一个思路做下来。总体的代码量改动量不多，主要还是针对 mpx 使用 vue 生态的一些能力的补齐(在跨 web 场景下是零成本复用)，从功能实现角度比较容易复用和拉齐。

但是整个方案的局限性还是比较明显的：runtime 层面核心模块的设计和实现差异，对于一些 Hooks API 的实现上会有比较大的局限性以及使用上所带来的心智负担，当然这也是可以预见的，因为**从整个框架的设计角度和出发点来看是基于小程序的规范去做增强，所以在跨平台(生态)方面的能力的抹平工作都是由小程序向web侧去兼容**。

这次对于 mpx composition-api 能力的探索算是更加深入的去尝试把 web 相关生态的能力复用至小程序生态，对于两者的复用性的可能性以及复用场景也有了更深的了解。

### 未来规划

目前团队正在紧锣密鼓的重写 mpx runtime 层面的一些核心基础模块的实现（例如：`scheduler` 会基于小程序本身的渲染更新机制去重构、`watcher` 内部实现会和 `ReactiveEffect` 拉齐），使得整个响应式系统的表现和 Vue3 更加对齐。

在部分 Hooks API 设计上还是会遵照小程序的规范去设计实现。

在生态方面，Store 也计划在现有风格的基础上基于 Hooks 的实现提供一个 [Pinia](https://pinia.vuejs.org/introduction.html) 风格的 Store 来提供更好的使用体验。

composition-api 的引入会给 mpx runtime 层面的逻辑执行带来更多的**动态特性**，这部分的逻辑收敛对于我们想要基于 mpx runtime 做能力增强也带来了一些新的思路和想法。

composition-api 的能力也会在不久的一段时间和大家见面。