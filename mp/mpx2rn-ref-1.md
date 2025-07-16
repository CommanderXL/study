
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

Mpx 框架通过编译+运行时一系列的处理使得我们不用写平台底层的代码，而是使用这一跨平台的抽象能力（wx:ref）来满足我们研发诉求的前提下提高我们的开发体验和效率。

我们清楚了 `wx:ref` 本身要解决的问题及小程序平台提供的底层能力，那么在 Mpx2Rn 的场景下核心要解决的一个问题就是：**以微信小程序的能力范围为跨端标准来保持跨平台能力的一致性**。也就是说在微信小程序提供的底层 api 能力及 `wx:ref` 增强能力在 Mpx2Rn 的场景下也需要保持一致，那也就意味着我们需要在保证上层 api 一致的情况下，在 RN 实现对等小程序的能力。（todo 描述再优化下）


### React 能力

React 本身提供了获取基础节点（web、rn）的能力，通过在基础节点上部署 ref 属性来获取对应的基础节点，然后通过基础节点调用对应平台的相关 api 即可查询节点的布局位置等信息：

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

直观上来看 React 提供的获取平台基础节点的能力和父子组件间通讯的能力是能满足我们需要实现的微信小程序平台所提供的获取基础节点和组件实例的能力。但是具体到功能的实现，我们需要优先看清楚平台框架之间的设计差异性，才能找到对应的解决方案。

### 功能拆解

具体到 Mpx2Rn 的场景来看，对于一个 mpx 组件的 template 模版来说，在 Mpx2Rn 的场景下最终会被编译转化为一个 react 的 render 函数，我们在模版上定义的属性、指令也都被编译处理后注入到 render 函数中，最终这个 mpx 组件的渲染会交由 react 去接管。

```javascript
<template>
  <view wx:ref="view">
    <child-component wx:ref="childComponent"></child-component>
  </view>
</template>
```

```javascript
createElement('view', {
  ref: this.__getRefVal('node', [['', 'view']], 'ref_fn_1')
}, createElement('child-component', {
  ref: this.__getRefVal('component', [['', 'childComponent']], 'ref_fn_2')
}))
```


#### 基础组件

<!-- RN 平台本身提供了一系列的基础组件：，这些基础组件只是针对 RN 平台的。 -->

微信小程序平台提供了一系列的基础组件：`View`、`Button`、`Text`、`ScrollView` 等，同样 RN 平台本身也提供了一系列的基础组件，当然这些基础组件仅针对 RN 平台的使用。这两个平台所提供的基础组件能力范围也有非常大的差异。

那么对于 Mpx2Rn 来说，核心要解决的一个问题是**以微信小程序的能力范围为跨端标准来保持跨平台能力的一致性**：即在微信小程序平台使用的基础组件在其他平台下能力和行为要保证一致。因此 Mpx2Rn 也就需要利用 RN 平台提供的一系列组件去实现对标微信小程序基础组件的基础组件。举个简单的例子：

`view` => `mpx-view`（自定义组件） + `View`（rn 基础组件）

在我们源码当中写的 `view` 标签，这个 `view` 标签节点本身在 RN 平台上并不存在，这是 Mpx2Rn 在实际的渲染阶段将模版上的 `view` 标签节点转化为 `mpx-view`（即 Mpx 框架提供的在 RN 平台上和微信小程序 view 能力对齐的自定义组件）。而 `mpx-view` 本身是基于 RN 提供的 `View` 基础组件做的二次封装，它从实现上来说一个自定义组件，但是从跨平台所要实现的功能来说，它是一个基础组件。

那么如果我们想要在页面/组件当中去获取 `view` 节点的 ref 始终都是绕不开自定义组件 `mpx-view`，（始终都是直接和 `mpx-view` 进行交互，还不能直接和 RN 基础节点 `View` 进行交互，除了 `view` 组件以外，Mpx2Rn 所提供的对标微信小程序的基础组件，例如 button、image 都是这种场景）。

在 Mpx2Rn 的场景下如何获取基础节点的 ref？这个问题等效于如何获取自定义组件当中的基础节点的 ref。

这里定义了一套协议来实现基础组件的 ref 能力：

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

Mpx2Rn 每开发一个基础组件都需要接入并按照 `useNodesRef` hook 的约定来完成相关接口的部署：


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

最终所达到的效果就是：虽然我们的代码是直接和 mpx-xxx 等自定义组件交互，但是框架侧通过xxxx


#### 自定义组件

`Mpx2Rn sfc` => `() => {}` + `instance`

对于每个 Mpx2Rn 组件来说，其实都是由一个实体的 React Function Component（以下就简称为“RFC”） 和一个抽象的组件 instance 实例（对标微信小程序组件实例）构成，由 RFC 来做平台的桥接层（渲染、生命周期等），由 instance 对 RFC 来做能力的增强（响应式系统、渲染调度等）。

在微信小程序的设计规范里，父组件可以通过 this.selectComponent 方法获取子组件实例对象，这样就可以直接访问组件的任意数据和方法。

但是对于 RFC 来说是**一个纯函数，并没有组件实例的概念**。因此 Mpx2Rn 的场景当中我们通过抽象的 instance 来实现对标微信小程序的组件实例。

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

所以在自定义组件的场景当中，


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