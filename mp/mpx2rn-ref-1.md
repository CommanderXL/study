
* Vue 能力（抽象）-> 跨平台（$ref）

提供了跨平台（mp、web、rn）、一致性（基础节点、自定义节点）的获取节点实例的**语法糖**。
  
### 小程序的标准能力

微信小程序提供了底层 api：

* createQuerySelector 用以获取平台提供的基础节点(view、button 等)；
* selectComponent/selectComponents 用以获取自定义组件实例；

那么对于 ref 语法糖来说，最终通过编译+运行时结合的方案去...

* this.$refs.a => this.createQuerySelector().select('#a') => 获取节点的布局等信息等；
* this.$refs.b => this.selectComponent('#b') => 访问自定义组件实例的方法等；

### React 能力

React 提供了获取基础节点的能力：

```javascript
import { useRef, useEffect, createElement } from 'react'

function Component() {
  const ref = useRef(null)

  useEffect(() => {
    ref.current.measure(function(x, y) {
      // do something
    })
  }, [])

  return createElement('div', { ref })
}
```

同时也提供了父子组件间的通讯能力：

```javascript
import { useRef, useImperativeHandle, createElemnt } from 'react'

const ParentComponent = () => {
  const ref = useRef(null)

  return createElement(ChildComponent, { ref })
}

const ChildComponent = (props, ref) => {
  useImperativeHandle(ref, () => {
    return {
      show () {
        // do something
      }
    }
  })

  return <div></div>
}
```

React 提供的能力直观是能满足我们需要实现的功能。

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

微信小程序平台提供了一系列的基础组件：`View`、`Button`、`Text`、`ScrollView` 等，同样 RN 平台本身也提供了一系列的基础组件，当然这些基础组件仅针对 RN 平台的使用。

Mpx2Rn 核心要解决的一个问题是以微信小程序的能力范围为跨端标准来保持平台能力的一致性，即在微信小程序平台使用的组件在其他平台下能力要保证一致。因此 Mpx2Rn 需要去利用 RN 平台提供的一系列组件去实现对标微信小程序基础组件的基础组件。举个简单的例子：

`view` => `mpx-view` + `View`




需要有一套协议来实现基础组件的 Ref 能力。

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

#### 自定义组件

`mpx sfc` => `() => {}` + `mpxProxy`


那么在实现 Mpx2Rn 的 Ref 能力的过程中，核心要解决的问题是：


Mpx2Rn 要实现小程序的标准规范

核心要解决的问题：



* 自定义组件 Ref
* 基础节点 Ref


* React 组件的 Ref
* 底层 api 调用（__selectRef 等的使用），special case 调用底层的 api 去做一些查询工作
* 调用/获取时机不能过早，需要在 onMounted 之后