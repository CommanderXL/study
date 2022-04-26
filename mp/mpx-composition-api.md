mpx 设计理念是基于小程序框架做渐进增强，在小程序框架里每个 Component，Page 构造函数其实内部是做了一定程度的实例封装，所以对于 mpx 来说，渐进增强的核心也就是对于 Component，Page 在运行时环节做能力增强，剩下的渲染工作交给小程序的框架去接管。这块在跨 web 的场景中也是一样，组件的生命周期、渲染等等都是由 Vue 去接管的，在运行时环节需要做的一项比较重要的工作就是 api 差异的抹平。（这里可以有个图来展示框架渲染以及 mpx 所做的工作）

在接口设计层面，在组件内部要想获取数据，方法都是通过组件实例(这里的组件实例也就是小程序的组件实例，mpx 对于这个实例做了增强) this 去访问，mpx 通过暴露一个 Factory Function，外部通过这 Factory Function 的原型拓展其他的属性、方法。当小程序的实例进入实例化阶段(MpxProxy)后，再完成将Factory Function 的原型拓展挂载至小程序的实例 this 上。在这里面有2个实例需要区分下，一个就是小程序原本的实例，还有一个是 mpxProxy，他们之前的关系是：

```javascript
this.__mpxProxy = mpxProxy
```

mpxProxy 内部接管了当前小程序实例的响应式数据初始化、数据 diff 以及建立响应式数据和 render watcher 之间的联系等。从这些功能的角度来说，mpxProxy 和一个 vue 实例提供的功能差不多，当然差异还是比较大的，因为 vue 实例是由 Vue Constructor 实例化出来的，所以继承了各种拓展的属性和方法。但是 mpxProxy ...

对内，在 mpx runtime 层面有个非常重要的内容，就是 MpxProxy，与平台无关，对于小程序组件(页面)/web 实例做增强的工作。

在 mpx runtime 实现当中有2部分比较核心的内容：

* options 处理
* 组件实例的增强(对于跨 web 的场景直接交给 Vue 接管)

----

在开始介绍整个的方案前，首先看下 Vue@2.x 对于 composition-api 的支持，整体还是采用插件的方式去增强这部分的能力，强依赖 Vue Constructor 全局构造函数，通过 `mixin`、`optionMergeStrategies` 等能力去改变 Vue 实例化的组件的能力和行为：

* Setup：全局 mixin beforeCreate hook；
* LifeCycle Hooks：利用 optionMergeStrategies 的机制，动态收集并更新 LifeCycle Hooks；
* Reactive：依赖 `Vue.observable` 完成响应式数据初始化；

对于 mpx 而言，同样提供了全局 mixin 的能力，以及在小程序开始实例化之前的 beforeCreate hook，在 LifeCycle Hooks 方面依托小程序的 Hooks 构建了一套 mpxProxy inner LifeCycle Hooks，此外 mpx 目前的响应式系统基本和 Vue@2.x 保持一致。

在这样的一个前提下思考：**是否可以直接复用 `@vue/composition-api` 的能力，将这个属于 vue 的插件作为 mpx 的插件来使用，用以实现 mpx 的 composition-api 能力**，这样 mpx 不管在开发小程序还是跨 web 场景的应用下都可以使用 composition-api 能力，且不需要单独维护一个完整的 composition-api 的 package。

在整个的方案实现上采用的整体的思路是：将 mpxProxy 做能力增强，以供 `@vue/composition-api` 来消费使用。

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

这样插件可以直接作用于 MpxProxy，从而对小程序实例做增强。（不过这里面需要注意的一点是插件在执行过程中即会使用到 MpxProxy 的能力，同时也会使用小程序的实例。

### 对于 setup() 支持

`setup` 函数接受2个参数，第一个为组件定义的 `properties`，另外一个是 setup 的上下文，上下文 context 提供了事件触发(emit)，获取模板节点实例(refs)等属性。

因为 composition-api 是在 beforeCreate hook 对于 data 做了一层代理，在获取 data 之前完成 setup 函数的执行。

```javascript
import { createComponent } from '@mpxjs/core'

createComponent({
  properties: {
    name: {
      type: string,
      value: 'Foo'
    }
  },
  setup(props, context) {
    props.name

    context.emit('updateValue')
  }
})
```

不过在 setup 函数有一个单独的 context 上下文是在 `@vue/composition-api` 内构造出来的，主要是提供了对于：

* refs
* emit

这部分的 api 其实上也是调用组件实例上的方法。这部分是没有什么能力对这个 context 做改造或者增强的。

对于 setup() 的支持，从功能这个角度是可以拉齐的，不过在 API 的调用和属性访问上不太好拉齐，主要体现在事件触发，以及 refs 获取上。

问题一：是对于 this.target(小程序实例) 还是说 mpxProxy(mpx组件实例) 做增强？他们之间的关系是 mpxProxy.target === 小程序实例

在我们平时写 mpx 代码的时候，this 的指向都是小程序实例，只不过 mpx 对于这个实例做了能力的增强。

对外，暴露了一个 mpx Constructor 用以一些方法的拓展。 mpx Constructor 做能力增强 -> 可以实例化一个 MpxProxy.

不过需要明确的一点是

那么我们仔细分析下 composition-api 的实现，它还是借助 Vue 的插件系统去完成，最为核心的还是对于全局唯一的 Vue Constructor 进行拓展改造。

对于整个的技术方案前提的是在对原有的 mpx 运行时的架构设计不做大的改动情况下，去实现 composition-api 的能力。

在 mixin 的生命周期里面访问的都是 target

所要解决的核心的问题：

那么对于 mpx 而言，不一样的点在于，暴露的是一个全局唯一的 mpx constructor，mpx 的插件系统也是借助做这个函数来进行拓展的。

不管是 Vue Constructor 还是 Vue Component Instance，他们和 Mpx Constructor 以及 Mpx Proxy instance 之间的差异都是非常大的。

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

不过在目前 mpx 的设计当中，mpxProxy 是强依赖小程序实例以及实例的生命周期的，他们之间是一一绑定的关系，也就意味着 mpxProxy 没法脱离小程序实例使用。但是 mpx 要实现 composition-api 同样也会遇到统一管理副作用的问题。所以 mpxProxy 的作用不仅仅需要对于小程序实例做增强，同时也需要作为管理副作用的容器。

那么针对这个问题：

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

MpxProxy 可脱离小程序的实例单独实例化，同时还暴露了内部的一些核心 API 等。

### Scheduler

### LifeCycle

在 mpx LifeCycle 的设计当中是依托不同平台（小程序/vue）的生命周期进行构建，因此实际上存在2套生命周期，一套是各平台的(小程序/vue)组件的生命周期，以及 mpx 依托这些平台组件的生命周期而自己内部定义的一套 mpxProxy 生命周期。在小程序实例的关键 LifeCycle Hook 将用户定义的生命周期收敛至 mpxProxy 内部统一的生命周期进行管理。(todo：一张图简单的理解下)

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

当然对于 LifeCycle Hooks 的支持也并没有那么的理想，主要体现在 mpx 的设计当中是以小程序的生命周期为书写标准，所以在使用 `@vue/composition-api` 暴露出来的 Hooks 肯定是和原有的小程序的生命周期 Hook 有差异的，使用过程中肯定是有一定的心智负担的。

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

这也是 mpx 在不做非常大的变动下支持 composition-api 一个比较重要的点。所以可以在 `setup` 里面返回事件处理函数：

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
mpx.prototype.$emit = function (...args) {
  this.triggerEvent(...args)
}
```

### Store

----

1. 对于代码的复用；
2. 对于web生态的复用(脱离平台)，例如 vue 生态的复用