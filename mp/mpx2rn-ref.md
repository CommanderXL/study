## mpx2rn 组件渲染更新和 ref

基础用法：

1. <view wx:ref="xxx"></view>
2. <view wx:ref id="a" class="a b c"></view>

代码同构，不同平台表现的差异性也决定了代码整体的可维护性；

框架设计

* mpx

桥接不同平台的组件生命周期，最终由 mpx 统一来调度生命周期的执行；

todo 画个图

在 react 函数组件当中没有生命周期的概念，主要还是利用 useEffect api 来模拟生命周期的执行。

* react

react 提供了 useEffect（PassiveHook 类型），useImperativeHandle（LayoutHook 类型） 内置的 hookApi。在 react 组件的 commit 阶段，一个核心的工作就是 commit HookApi 上挂载的 effect 函数(schedule effect)，不同的 Hook 类型也有一定的先后执行顺序：

1. 在组件内部，LayoutHook 类型（在这个阶段，也完成了对于原生节点的挂载和访问）先于 PassiveHook 类型的执行：

```javascript
function () {
  useEffect(() => {
    // ref 一定能访问的到
  })
}
```

2. 在 commit 阶段，是个深度优先执行的过程，也就是在父子之间，子组件的 Hook effect 会先于父组件的 Hook effect 执行；

那么在这样一个组件 commit 执行顺序下，在组件的 useEffect 当中一定是：

1. 可以拿到组件实例or基础节点
2. 能拿到子组件的节点



* mpx2rn

`ref` 能否拿到数据和节点(react)的挂载时机有强依赖关系。

React Hook 执行时机

### 场景一：组件内部获取基础节点

#### 初次渲染

* created/attached -> CREATED 时机肯定是拿不到的

* ready -> MOUNTED 是一定能拿到（渲染的时序保证的）

#### 二次更新

响应式数据发生变化，触发组件更新；

在小程序/web场景下，会使用 nextTick 来确保拿到的是更新后的节点；



### 场景二：父组件获取子组件当中的基础节点

```javascript
// parent.mpx
<template>
  <child list="{{ list }}" wx:ref="child"></child>
</template>

// child.mpx
<template>
  <view wx:ref="title"></view>
</template>
```

Case 1：mpx 组件混合使用 react 组件


Case 2：mpx 组件使用 mpx 子组件

场景一：

初次渲染，parent -> child 渲染（HookLayout -> HookPassive），ready 生命周期一定能拿到

父组件响应式数据发生更新，触发子组件的重新渲染。如果在小程序/web情况，大家都会使用 nextTick 来保证获取更新后的节点，但是在 mpx2rn 的场景下就不一定能正常的 work 了。

这里先简单介绍下 mpx2rn 组件渲染机制：

mpx sfc => () => {}

mpx 引入了响应式系统，利用响应式系统来调度组件的渲染更新；
对于 React 来说组件的更新一般来自于 props、state 或者 context 的变化；

那么对于一个 mpx2rn 的组件更新流程就是：

响应式数据 -> RenderEffect run -> queueJob -> react hook update(useSyncExternalStore) -> React 组件重新渲染

**在这个过程当中涉及了2次异步操作:**

**1. 响应式系统的 schedule renderEffect；**
**2. renderEffect 结束后会进行 react hookApi 的 schedule effect。**

那么再回到刚才的示例当中，当响应式数据发生变更后发生了什么事情呢？

首先响应式系统会将 watchEffect、renderEffect 在同一个异步队列当中 flush 掉，不过这里使用 nextTick 也引入了一个异步任务，那么：

* watchEffect -> nextTick
* renderEffect -> react hook update

这里2个异步任务实际的执行时序是没法保证的，所以会遇到的问题是在 nextTick 当中**不一定能拿到子组件渲染更新完成的节点**。

既然问题找到了，针对这种场景能给到的解法是：

1. 子组件部署 `UPDATED` 钩子，更新完成后事件通知到父组件，父组件感知到子组件完成更新后再做操作；
2. 父子组件不做更新通讯，即子组件不做任何操作，父组件部署 `UPDATED` 钩子来感知子组件更新完成；（todo 解释下为什么这个方案理论上是可以的）子组件肯定是先于父组件的 UPDATED 钩子触发的

场景二：

在场景一当中，父子间通讯的数据是一个引用类型，在 mpx2rn 的场景下父子组件通讯过程中，props 数据是直接透传下来的，也就意味子组件访问到的响应式数据是在父组件当中的响应式数据。

那么父子组件在渲染过程中，父子的 renderEffect 在执行的过程中都是访问的同一个响应式数据 list，因此 list 也就建立了和这2个 renderEffect 的联系，一旦 list 发生变更，进入到响应式系统调度的过程，父与子的 renderEffect 被放到同一个异步队列当中执行。（todo id 的比较？）

再来看看场景二，父子间的通讯数据是一个简单类型(todo 看下 ref 类型)，父子间的通讯也就会变成一个非响应式数据类型的值，然后在子组件初始化的过程当中会将 props 上的这些数据初始化为响应式的数据，这时子组件的 renderEffect 过程中实际上是访问到的子组件自身的响应式数据并建立联系，而不是和场景一一样访问的父组件传下的原始的响应式数据。

那么在场景二的二次更新的过程当中，



### 场景三：子组件获取父组件的基础节点

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


初始化实例，二次渲染



----

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


不是 bug，而是在较为复杂的业务代码的场景下，如何能确保代码的执行是符合预期的