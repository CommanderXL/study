
* Vue 能力（抽象）-> 跨平台（$ref）

提供了跨平台（mp、web、rn）、一致性（基础节点、自定义节点）的获取节点实例的**语法糖**。
  
### 小程序的标准能力

微信小程序提供了用以获取平台基础节点和自定义组件实例的 api：

* createQuerySelector & SelectorQuery 用以获取平台提供的基础节点(view、button 等)；
* selectComponent/selectComponents 用以获取自定义组件实例；

在我们使用 Mpx 进行开发的过程中，可以通过 Mpx 提供的增强能力 `wx:ref` 指令来获取模版上对应的基础节点或者自定义组件实例。事实上 `wx:ref` 本身是一个语法糖，举个例子：

```javascript
<template>
  <view wx:ref="view">
    <child-component wx:ref="childComponent"></child-component>
  </view>
</template>
```

* this.$refs.view 等效为 this.createQuerySelector().select() => 获取到基础节点；
* this.$refs.childComponent 等效为 this.selectComponent() => 获取到自定义组件实例；

 Mpx 框架通过编译+运行时一系列的处理使得我们不用写平台底层的代码，而是通过这一跨平台的抽象能力（wx:ref）来提高我们的开发体验和效率。


### React 能力

React 本身提供了获取基础节点（web、rn）的能力，通过在基础节点上部署 ref 属性来获取对应的基础节点，这样获取到基础节点后通过调用对应平台的基础节点相关 api 即可查询节点的布局位置等信息：

```javascript
// rn 示例
import { useRef, useEffect, createElement } from 'react'
import { View } from 'react-native'

function Component() {
  const ref = useRef(null)

  useEffect(() => {
    ref.current.measure(function(x, y) {
      // do something
    })
  }, [])

  return createElement(View, { ref })
}
```

除了获取基础节点外，react 也提供了父子组件间的通讯能力，父组件在创建子组件的过程中部署 ref 属性，子组件通过 `useImperativeHandle` api 来暴露需要给到父组件使用的 api：

```javascript
import { useRef, useImperativeHandle, createElemnt } from 'react'

// 父组件
const ParentComponent = () => {
  const ref = useRef(null)

  useEffect(() => {
    
  }, [])

  return createElement(ChildComponent, { ref })
}

// 子组件
const ChildComponent = (props, ref) => {
  useImperativeHandle(ref, () => { // 暴露对应的接口
    return {
      show () {
        // do something
      }
    }
  })

  return <div></div>
}
```

React 提供的获取平台基础节点的能力和父子组件间通讯的能力直观是能满足我们需要实现的微信小程序平台提供的。(todo 补个图)

### 功能拆解

我们已经清楚了上层需要实现的 api 能力，同时也清楚了 RN 平台所提供的底层 api 的能力。

对于一个 mpx 组件的 Template 模版来说最终也是转化成了 render 函数：

```javascript
<template>
  <view wx:ref="view">
    <child-component wx:ref="childComponent"></child-component>
  </view>
</template>
```

```javascript
createElement('view', {
  ref: ''
}, createElement('child-component', {
  ref: ''
}))
```


#### 基础组件

RN 平台本身提供了一系列的基础组件：，这些基础组件只是针对 RN 平台的。

微信小程序平台提供了一系列的基础组件：`View`、`Button`、`Text`、`ScrollView` 等，同样 RN 平台本身也提供了一系列的基础组件，当然这些基础组件仅针对 RN 平台的使用。这两个平台所提供的基础组件的能力范围也有非常大的差异。

那么对于 Mpx2Rn 来说，核心要解决的一个问题是**以微信小程序的能力范围为跨端标准来保持跨平台能力的一致性**：即在微信小程序平台使用的基础组件在其他平台下能力和行为要保证一致。因此 Mpx2Rn 也就需要利用 RN 平台提供的一系列组件去实现对标微信小程序基础组件的基础组件。举个简单的例子：

`view` => `mpx-view`（自定义组件） + `View`（rn 基础组件）

因此在我们源码当中写的 `view` 标签，最终都是转化为 `mpx-view`（即 Mpx 框架提供的在 RN 平台上和微信小程序 view 能力对齐的自定义组件）。`mpx-view` 本身是基于 RN 提供的 `View` 基础组件做的二次封装，它是一个自定义组件，

那么如果我们想要在页面/组件当中去获取 `View` 节点的 ref 始终都是绕不开自定义组件 `mpx-view`，（始终都是和 mpx-view 进行交互，还不能直接和基础节点 `View` 进行交互，除了 `view` 组件以外，Mpx2Rn 所提供的对表微信小程序的基础组件都面临这个问题）。

在 Mpx2Rn 的场景下如何获取基础节点的 ref：如何获取自定义组件当中的节点的 ref。

这里定义了一套协议来实现基础组件的 ref 能力。

```javascript
export type HandlerRef<T, P> = {
  getNodeInstance(): {
    props: RefObject<P>,
    nodeRef: RefObject<T>,
    instance: Obj
  }
}

export default function useNodesRef<T, P> (props: P, ref: ForwardedRef<HandlerRef<T, P>>, nodeRef: RefObject<T>, instance:Obj = {}) {
  const _props = useRef<P | null>(null)
  _props.current = props

  useImperativeHandle(ref, () => {
    return {
      getNodeInstance () {
        return {
          props: _props,
          nodeRef,
          instance
        }
      }
    }
  })
}
```

每一个基础组件都按照 `useNodesRef` hook 的约定来完成相关接口的部署：


```javascript
import { forwardRef, useRef } from 'react'
import { View } from 'react-native'

const MpxView = forwardRef((props, ref) => {
  ...
  const nodeRef = useRef(null)
  useNodesRef(props, ref, nodeRef, {
    // some other properties
  })
  ...

  return <View ref={nodeRef}></View>
})
```



#### 自定义组件

`mpx sfc` => `() => {}` + `instance`

对于每个 mpx sfc 来说，其实都是由一个实体的 React Function Component（以下就简称为“RFC”） 和一个抽象的 instance 构成，由 RFC 来做平台的桥接层（渲染、生命周期等），由 instance 对 RFC 来做能力的增强（响应式系统、渲染调度等）。

在微信小程序的设计规范里，父组件可以通过 this.selectComponent 方法获取子组件实例对象，这样就可以直接访问组件的任意数据和方法。

但是对于 RFC 来说就是一个纯函数，并没有组件实例的概念。因此 Mpx2Rn 的场景当中是通过抽象的 instance 来实现对标微信小程序的组件实例。

```javascript
export function getDefaultOptions() {
  const defaultOptions = memo(forwardRef(props, ref) => {
    const instanceRef = useRef(null)
    ...
    if (!instanceRef.current) {
      instanceRef.current = createInstance({ propsRef, type, rawOptions, ... })
    }

    const instance = instanceRef.current
    useImperativeHandle(ref, () => {
      return instance
    })
    ...
  })
}
```


Mpx2Rn 要实现小程序的标准规范

核心要解决的问题：

### 核心工作流程

todo 补个图

### Some tips


* React 组件的 Ref
* 选择器的使用（wx:key）
* 底层 api 调用（__selectRef 等的使用），special case 调用底层的 api 去做一些查询工作
* 调用/获取时机不能过早，需要在 onMounted 之后
* selector 的使用限制
* 跨组件获取 ref 