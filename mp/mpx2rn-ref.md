## mpx2rn 组件渲染更新和 ref

基础用法：

1. <view wx:ref="xxx"></view>
2. <view wx:ref id="a" class="a b c"></view>

代码同构，不同平台表现的差异性也决定了代码整体的可维护性；

框架设计

* mpx

桥接不同平台的组件生命周期，最终由 mpx 统一来调度生命周期的执行；

* react

PassiveHook(useEffeect)、LayoutHook(useImperativeHandle)

* mpx2rn

`ref` 能否拿到数据和节点(react)的挂载时机有强依赖关系。

React Hook 执行时机

### 场景一：组件内部获取基础节点

#### 初次渲染

* created 时机肯定是拿不到的

* attached/ready 是一定能拿到

#### 二次更新

响应式数据发生变化，触发组件更新；

在小程序/web场景下，会使用 nextTick 来确保拿到的是更新后的节点；



### 场景二：父组件获取子组件当中的基础节点

```javascript
// parent.mpx
<template>
  <child wx:ref="child"></child>
</template>

// child.mpx
<template>
  <view wx:ref class="title"></view>
</template>
```

### 场景三：子组件或者父组件的基础节点



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