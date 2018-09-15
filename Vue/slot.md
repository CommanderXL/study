## slot插槽

在日常的开发过程当中，slot 插槽应该是用的较多的一个功能。Vue 的 slot 插槽可以让我们非常灵活的去完成对组件的拓展功能。接下来我们可以通过源码来看下 Vue 的 slot 插槽是如何去实现的。

Vue 提供了2种插槽类型：

* 普通插槽
* 作用域插槽

首先来看一个简单的例子：

```javascript
<div id="app">
  <my-component>
    <template name="demo">
      <p>this is demo slot</p>
    </template>
  </my-component>
</div>


Vue.component('myComponent', {
  template: '<div>this is my component <slot name="demo"></slot></div>'
})
```

定义了一个 my-component 全局组件，这个组件内部包含了一个名字为 demo 的插槽。