# 业内小程序运行时框架技术细节剖析

### Kbone

#### Kbone vnode diff 更新策略

appendChild、removeChild、insertBefore、replaceChild 做了一层代理

```javascript
// dom 元素上的一些代理
class Element {
  appendChild() {
    ...
    if (hasUpdate) this.$_triggerMeUpdate() // 调用 $_triggerMeUpdate() 方法来触发
  }
  $_triggerMeUpdate() {
    if (!this.$_notTriggerUpdate) this.$trigger('$$childNodesUpdate')
  }

  /**
   * 监听 class 或 style 属性值变化
   */
  $_onClassOrStyleUpdate() {
    if (this.$__attrs) this.$_attrs.triggerUpdate()
    this.$_triggerParentUpdate()
  }
}

// 全局事件的监听
this.domNode.addEventListener('$$childNodesUpdate', this.onChildNodesUpdate, {$$namespace: 'root'}) // 子节点的更新
this.domNode.addEventListener('$$domNodeUpdate', this.onSelfNodeUpdate, {$$namespace: 'root'}) // 节点自身属性的更新


function onChildNodesUpdate() {
  ... // 一些子节点 diff 操作
  setData(...)
}

function onSelfNodeUpdate() {
  ... // 一些属性 diff 操作
  setData(...)
}
```

**在框架层面接管了 vnode 的 diff 和 patch 的操作。所以在 kbone 或者 rax 只需要在提供的 dom 层去代理相关的底层操作，搜集需要被更新的数据，然后再通过 setData 将数据更新到视图。**

子组件根据 id 获取根树的 vdom 片段
根树 在递归渲染模板的阶段，会过滤掉子组件的 vdom，这部分统一交给 自定义组件 上下文当中去渲染。这样就可以做到局部更新。


#### 模板的构建

```javascript
// 子树
<template name="subtree"></template>

// 叶子节点 (没有子元素的节点)
domInfo.isLeaf = !domInfo.isImage && !domInfo.useTemplate && domInfo.type === 'element' && !child.children.length && NEET_RENDER_TO_CUSTOM_ELEMENT.indexOf(child.tagName) === -1
```


### Taro

### Rax