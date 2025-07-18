在我们使用 Mpx 进行开发的过程中，可以通过 Mpx 提供的增强能力 `wx:ref` 指令来获取模版上对应的基础节点或者自定义组件实例。

### 小程序的标准能力

微信小程序提供了用以获取平台基础节点和自定义组件实例的 api：

* createQuerySelector 及相关 api 用以获取平台提供的基础节点(view、button 等)；
* selectComponent/selectComponents 用以获取自定义组件实例；

Mpx 框架通过编译+运行时一系列的处理使得我们不用写平台底层的代码，而是提供了这一跨平台的抽象能力（wx:ref）来满足在跨小程序平台、web及现在的 RN 场景下获取节点诉求。

事实上 `wx:ref` 本身是一个语法糖，举个例子：

```javascript
<template>
  <view wx:ref="view">
    <child-component wx:ref="childComponent"></child-component>
  </view>
</template>
```

* this.$refs.view 的使用会被 Mpx 处理为使用小程序的 api this.createQuerySelector().select() 调用，那么也就可以获取到 `view` 基础节点；
* this.$refs.childComponent 的使用会被 Mpx 处理为使用小程序的 api this.selectComponent() 调用，也就可以获取到 `child-component` 自定义组件实例；

除了 `wx:ref` 这一指令外，在 Mpx2Rn 的场景下核心要解决的一个问题就是：**以微信小程序的能力范围为跨端标准来保持跨平台能力的一致性**。也就是说在微信小程序提供的底层 api 能力及框架的增强能力在 Mpx2Rn 的场景下也需要保持一致，这也就意味着我们需要在保证上层 api 一致的情况下，在 RN 实现对等小程序的能力。

具体到上面的例子就是：在 Mpx2Rn 的场景下 `this.$refs.view` 和 `this.$refs.childComponent` 同样可以分别获取到 `view` 基础节点和 `child-component` 的组件实例。

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
import { useRef, useImperativeHandle, createElement } from 'react'

// 父组件
const ParentComponent = () => {
  const ref = useRef(null)

  useEffect(() => {
    ref.current.show() // 调用子组件暴露的 api
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

  return createElement(View)
}
```

React 提供了获取平台基础节点的能力和父子组件间通讯的能力，直观上看 react 相关 api 的调用和设计和小程序平台还是有比较大的差异，所以接下来我们需要优先看清楚平台框架之间的设计差异性，才能找到对应的解决方案。

### 功能拆解

具体到 Mpx2Rn 的场景来看，对于一个 mpx 组件的 template 模版来说，在 Mpx2Rn 的场景下最终会被编译转化为一个 react 的 render 函数，我们在模版上定义的属性、指令也都被编译处理后注入到 render 函数中，最终这个 mpx 组件的渲染会交由 react 去接管。例如在模版上定义的 `wx:ref` 指令，最终是转化为 react 节点的 `ref` 属性，接下来就看对于编译转化后的代码是如何利用 react 的能力使得在当前页面/组件可以正确获取到对应的基础组件及组件实例。

Mpx2Rn 源码：

```javascript
<template>
  <view wx:ref="view">
    <child-component wx:ref="childComponent"></child-component>
  </view>
</template>
```

编译后生成的 render 函数

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

所以在自定义组件的场景当中如何通过 ref 获取组件实例呢？实际上就是把 RFC 当中创建的抽象的 instance 实例通过 `useImperativeHandle` 暴露出去即可，这样在父组件当中也就能获取到子组件的实例。

### 核心工作流程

在上文提到了 `wx:ref` 其实就是一个语法糖，它是通过框架的编译 + 运行时结合的方式来实现的。

#### 编译阶段

主要做两件事：

1. 收集并注入相关的 ref 信息；
2. 构造好运行时所提供的函数调用 (this.__getRefVal)；

```javascript
<template>
  <view wx:ref="view">
    <child-component wx:ref="childComponent"></child-component>
  </view>
</template>
```

编译后生成的 render 函数：

```javascript
createElement('view', {
  ref: this.__getRefVal('node', [['', 'view']], 'ref_fn_1')
}, createElement('child-component', {
  ref: this.__getRefVal('component', [['', 'childComponent']], 'ref_fn_2')
}))
```

   
最终产出的 render 函数代码会交由 react 接管进行渲染。

#### 运行时

1. 通过 mixin 的方式给每个组件实例混入 `__getRefVal` 方法，它的返回时一个函数，核心是通过这个函数建立起当前页面/组件和所需要获取的节点间对应关系：

```javascript
// @mpxjs/core/src/platform/builtInMixins/refsMixins.ios.js
export default function getRefsMixins () {
  return {
    [BEFORECREATE] () {
      this.__refCache = {}
      this.__refs = {}
      this.$refs = {}
      this.__getRefs()
    },
    methods: {
      __getRefs () {
        const refs = this.__getRefsData() || []
        const target = this
        refs.forEach(({ key, type, all }) => {
          Object.defineProperty(this.$refs, key, {
            enumerable: true,
            configurable: true,
            get () {
              if (type === 'component') {
                return all ? target.selectAllComponents(key) : target.selectComponent(key)
              } else {
                return createSelectorQuery().in(target).select(key, all)
              }
            }
          })
        })
      },
      __getRefVal (type, selectorsConf, refFnId) {
        if (!this.__refCache[refFnId]) {
          this.__refCache[refFnId] = (instance) => {
            selectorsConf.forEach((item = []) => {
              const [prefix, selectors = ''] = item
              if (selectors) {
                selectors.trim().split(/\s+/).forEach(selector => {
                  const refKey = prefix + selector
                  const refVal = { type, instance, refFnId }
                  this.__refs[refKey] = this.__refs[refKey] || []
                  if (instance) { // mount
                    this.__refs[refKey].push(refVal)
                  } else { // unmount
                    const index = this.__refs[refKey].findIndex(item => item.refFnId === refFnId)
                    if (index > -1) {
                      this.__refs[refKey].splice(index, 1)
                    }
                  }
                })
              }
            })
          }
        }
        return this.__refCache[refFnId]
      },
    }
  }
}
```

2. 自定义组件通过 useImperativeHandle 暴露相关的接口
3. 底层的 createSelectorQuery / NodeRef 实现就不展开说了；（补个代码实现链接）

### Some tips

<!-- * React 组件的 Ref
* 选择器的使用（wx:key）
* 底层 api 调用（__selectRef 等的使用），special case 调用底层的 api 去做一些查询工作
* 调用/获取时机不能过早，需要在 onMounted 之后 -->
1. selector 的使用限制

目前仅支持：

* id 选择器：#the-id
* class 选择器（可连续指定多个）：.a-class、.b-class.c-class

2. 跨组件获取基础节点/组件实例

在微信小程序的能力下，可通过 `>>>` 选择器来跨组件获取基础节点。因为在 Mpx2Rn 的场景下不支持 `>>>` 选择器，那么可通过获取子组件的实例后，再去通过子组件实例去获取对应的基础节点、自定义组件。


3. Mpx 混合使用 React 组件

....

4. RN 原始节点 ref 的获取：

部分场景，业务可能需要获取到原始的 RN 基础组件 ref，那么可以直接访问 NodesRef 实例：

```javascript
this.$refs.viewRef
  .nodeRefs[0].getNodeInstance().nodeRef
  .measure(function(x, y, width, height, pageX, pageY) {
  // do something
})
```

