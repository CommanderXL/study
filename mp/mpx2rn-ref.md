# mpx2rn 组件渲染更新和 ref 使用

## 基础用法：

1. 通过 `$ref` 去访问节点

```javascript
<view wx:ref="xxx"></view>
```

2. 通过 `createSelectorQuery` 去访问节点

```javascript
<view wx:ref id="a" class="a b c"></view>
```

<!-- 代码同构，不同平台表现的差异性也决定了代码整体的可维护性； -->

## 一些概念

* react hook

react 提供了 useEffect（PassiveHook 类型），useImperativeHandle（LayoutHook 类型） 内置的 hookApi。在 react 组件的 commit 阶段，一个核心的工作就是 commit HookApi 上挂载的 effect 函数(schedule effect)，不同的 Hook 类型也有一定的先后执行顺序：

1. 在组件内部，LayoutHook 类型（在这个阶段，也完成了对于 Host Component 的挂载和访问）先于 PassiveHook 类型的执行：

```javascript
function () {
  useEffect(() => {
    // ref 一定能访问的到
  })
}
```

2. 此外 react 在 commit 阶段，是个深度优先执行的过程，也就是说子组件的 Hook effect 会先于父组件的 Hook effect 执行；

那么在这样的 commit 执行顺序下，在组件的 useEffect 当中一定是：

1. 可以拿到组件实例or基础节点
2. 能拿到子组件的节点

* 生命周期

在 react 函数组件当中没有生命周期的概念，主要还是利用 react 本身的渲染机制来模拟生命周期的执行，例如 `useEffect(() => {}, [])`。react 组件的渲染主要包括 render 和 commit 2个阶段。

桥接不同平台的组件生命周期，最终由 mpx 统一来调度生命周期的执行，一张图来表示：

<!-- `ref` 能否拿到数据和节点(react)的挂载时机有强依赖关系。 -->

<!-- React Hook 执行时机 -->

* mpx2rn 

我们使用 mpx 作为上层的 dsl，react 作为 mpx2rn 的渲染 runtime library。也就是说我们写着 mpx 的代码，会经过一系列的 mpx 框架的处理后变成了可以放到 react 当中执行的代码。

mpx sfc ->  () => {} + mpxProxy

## 场景一：组件内部获取基础节点

```javascript
<template>
  <view bindtap="change" wx:ref="title">title</view>
  <view wx:if="{{ show }}" wx:ref="subTitle">subTitle</view>
</template>

<script>
  import { createComponent, UPDATED } from '@mpxjs/core'
  createComponent({
    data: {
      show: false
    },
    ready() {
      console.log('get the title ref', this.$refs.title)
    },
    methods: {
      change () {
        this.show = true
        this.$nextTick(() => {
          this.$refs.subTitle.boundingClientRect(res => {
            console.log('the subTitle rect is:', res) // 为空
          }).exec()
        })
      }
    },
    [UPDATED] () {
      this.$refs.subTitle.boundingClientRect(res => {
        console.log('the subTitle rect is:', res) // 能正常访问
      }).exec()
    }
  })
</script>
```

1. 初次渲染

* 组件 created/attached(映射到 mpxProxy CREATED)阶段肯定是拿不到的，因为这个阶段只是处于 react 组件的 render 阶段（正在构建 Fiber 节点）；

* 组件 ready(映射到 mpxProxy MOUNTED) 阶段是一定能拿到，因为这个阶段处于 react commit 阶段，且 LayoutHook 已经先于 PassiveHook 执行完了。

2. 二次更新

响应式数据发生变化，触发组件二次更新，在小程序/web场景下，都会使用 nextTick 来确保拿到的是更新后的节点。但是在 mpx2rn 的场景下会出现拿不到节点的情况，这里就要介绍一下 mpx2rn 的组件渲染机制：mpx 引入了响应式系统，利用响应式系统来调度组件的渲染更新。
<!-- 对于 React 来说组件的更新一般来自于 props、state 或者 context 的变化； -->

那么对于一个 mpx2rn 的组件更新流程就是：

1. react 组件初次 render 阶段初始化 mpxProxy 实例；
2. 初始化一个 ReactiveEffect 建立起响应式数据和 update job effect 的关系；
3. 响应式数据变更 -> schedule update job(queueJob) -> 同步任务执行完 -> update job effect(useSyncExternalStore) -> React 组件重新渲染

**在组件二次更新的过程当中涉及了2次异步操作:**

**第一次异步：响应式系统 schedule update job；**

**第二次异步：update job 执行，react 组件更新**

那么在这个组件二次更新的场景当中，当响应式数据发生变化后，代码执行的逻辑就是：

1. nextTick -> Promise.resovle（一次异步）
2. schedule update job（第一次异步），update job 执行，react 组件更新（第二次异步）；

因此对于1，2这两个执行的流程的代码时机时序是没法严格保证的。

但是为什么可以在 `UPDATED` 钩子里拿到节点呢？因为 `UPDATED` 钩子是在组件二次更新的 useEffect 阶段派发的，所以对应的 react 节点已经完成挂载了。


## 场景二：父组件获取子组件当中的基础节点

### Case 1：mpx 组件使用 mpx 子组件

```javascript
// parent.mpx
<template>
  <child list="{{ list }}" wx:ref="child"></child>
</template>
<script>
  import { createComponent } from '@mpxjs/core'
  createComponent({
    data: {
      list: []
    },
    ready() {
      
    }
  })
</script>

// child.mpx
<template>
  <view wx:ref="title"></view>
</template>
```

场景一：

在父子组件初次渲染的情况下，parent -> child 渲染（HookLayout -> HookPassive），在父组件的 ready 生命周期内一定能拿到拿到子组件当中的基础节点。

父组件响应式数据发生更新，触发子组件的重新渲染。如果在小程序/web情况，大家都会使用 nextTick 来保证获取更新后的节点，但是在 mpx2rn 的场景下就不一定能正常的 work 了。

当响应式数据发生变更后发生了什么事情呢？

首先响应式系统会将 watchEffect、父renderEffect、子renderEffect(effect 就是上文提到的 update job) 在同一个异步队列当中 flush 掉，不过这里使用 nextTick 也引入了一个异步任务，那么：

todo 补个图

* watchEffect(queueJob) -> nextTick
* 父renderEffect(queueJob) -> update job -> react 组件更新
* 子renderEffect(queueJob) -> update job -> react 组件更新

2个红色框内的异步任务实际的执行时序是没法保证的，所以会遇到的问题是在 nextTick 当中**不一定能拿到子组件渲染更新完成的节点**。

既然问题找到了，就是父组件目前没法感知到子组件的更新渲染状态。针对这种场景能给到的解法是：

1. 子组件部署 `UPDATED` 钩子，更新完成后事件通知到父组件，父组件感知到子组件完成更新后再做操作；
2. 父子组件不做更新通讯，即子组件不做任何操作，父组件部署 `UPDATED` 钩子来感知子组件更新完成；（todo 解释下为什么这个方案理论上是可以的）子组件肯定是先于父组件的 UPDATED 钩子触发的

场景二：

在场景一当中，父子间通讯的数据是一个引用类型，在 mpx2rn 的场景下父子组件通讯过程中，props 数据是直接透传下来的，也就意味子组件访问到的响应式数据是在父组件当中的响应式数据。

那么父子组件在渲染过程中，父子组件的 renderEffect 在执行的过程中都是访问的同一个响应式数据 list，因此 list 也就建立了和这2个 renderEffect 的联系，一旦 list 发生变更，进入到响应式系统调度的过程，**父与子的 renderEffect 被放到同一个异步队列当中执行**，然后进入到 react 组件的更新阶段。

再来看看场景二，父子间的通讯数据是一个简单类型(todo 看下 ref 类型)，父子间的通讯也就会变成一个非响应式数据类型的值，然后在子组件初始化的过程当中会将 props 上的这些数据初始化为响应式的数据，这时**子组件的 renderEffect 在执行过程中实际上是访问到的子组件自身的响应式数据并建立联系，而不是像场景一一样访问的是父组件传下的原始的响应式数据**。

那么在场景二的二次更新的过程当中，首先父组件的响应式数据变更，将 schedule update job（父组件第一次异步），这个阶段子组件无任何变化（因为还没实际进入到组件的渲染阶段），等到 update job 执行后，这时才真正的触发父组件的更新操作（父组件第二次异步），进入到 react Fiber tree 的更新阶段，在子组件(react)的 render 阶段接受到的 props 是更新后的数据，同时在这个 render 阶段会由 mpx 的响应式系统来接管这个子 react 组件的渲染时机，具体的体现就是：

```javascript
export default getDefaultOptions({ type, rawOptions = {}, currentInject }) {
  const defaultOptions = memo(forwardRef(props, ref) => {
    ...
    if (!isFirst) {
      // 处理props更新
      Object.keys(validProps).forEach((key) => {
        if (hasOwn(props, key)) {
          instance[key] = props[key]
        } else {
          const altKey = hump2dash(key)
          if (hasOwn(props, altKey)) {
            instance[key] = props[altKey]
          }
        }
      })
    }
    ...
  })
}
```

在子 react 组件二次 render 的过程会将接收到的最新的 props 数据更新到 mpxProxy 实例上，其实就是会触发子组件的响应式数据的更新，进而 schedule react update callback（子组件第一次异步）推入异步更新队列，等 react update callback 实际开始执行的时候才开始子组件的更新渲染。因此二次更新的时序就是：补个图

也意味着父组件先完成更新，子组件再完成更新，那么父组件的 UPDATED 钩子肯定是先于子组件的 UPDATED 钩子的执行的。

### Case 2：mpx 组件混合使用 react 子组件

mpx 组件当中可以直接使用 react 组件（例如基础组件 view，button 等），那么 react 组件本身的渲染时机也会影响使用它的父组件的代码执行。

例如在 `mpx-cube-ui` 当中封装的 `popup` 组件，它使用了 react 自定义组件 `root-portal`。`popup` 本身需要渲染的节点内容最终都是作为 `root-portal` 的子组件。

在 `root-portal` 的实现当中接受到的子组件并不是同步渲染的，而是在组件的 useEffect 当中去 setState 来触发组件的更新，并将 popup 实际的内容渲染出来。

```javascript
<popup 
  wx:if="{{ showPopup }}"
  wx:ref="popup">
  </popup>
```

有个场景就是通过 `wx:if` 来控制 popup 的渲染时机并调用 popup show 方法来展示组件。不过因为 popup 在展示之前需要通过获取子组件的高度来决定组件移动的位置。


## 场景三：子组件获取父组件的基础节点

由于平台能力的限制，在 mpx2rn 的场景下。

todo：看下大家目前还有哪些场景，梳理下看下相关的解法；


遇到调用 `wx:ref` 或者 `createSelectQuery` 获取不到节点实例的情况。

demo 实例：

```javascript
<template>
  <component-a wx:ref="scroll" list="{{list}}" currentIndex="{{currentIndex}}"/>
</template>

<script>
  createComponent({
    data: {
      list: []
    },
    watch: {
      list (newVal, val) {
        this.$nextTick(() => {
          const query = this.$refs.scroll.createSelectorQuery()
          query.selectAll('.item').boundingClientReact().exec(res => {
            console.log('---boundingClientReact', res)
          })
        })
      }
    }
  })
</script>
```

list 初始值为 `[]`

----

1. nextTick 的实现和作用；
2. react hook 执行的顺序；
3. 响应式系统 + react hook；
4. 简单值 + 对象对于组件渲染时机；

跨组件获取实例需要关注哪些内容？


<!-- 初始化实例，二次渲染 -->



<!-- ----

异步的异步没法保证

[UPDATE] 钩子去保证渲染完成

props 驱动组件的更新机制

为什么小程序可以？

1. 响应式数据变更，组件重新渲染，统一的调度机制；

为什么RN不可以？

1. reactive -> effect.run -> 异步调度执行，所以存在异步嵌套异步的场景；

如何去解？

父子间

[UPDATE] -> 

子组件本身：




子组件如何获取父组件实例？

props、provide/inject


不是 bug，而是在较为复杂的业务代码的场景下，如何能确保代码的执行是符合预期的 -->