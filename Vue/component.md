## Vue组件系统简析

Vue version: 2.5.16

`Vue`的组件系统是`Vue`最为核心的功能之一。它也是构建大型的复杂的web应用的基础能力。接下来就通过这篇文章去分析下`Vue`组件系统是如何工作的。这篇文章主要是讲组件系统的渲染。

在组件的注册使用过程当中，有2种使用方式：

* 全局组件

```javascript
Vue.component('component-name', {
  // options
})
```

通过全局方式注册的组件，可在模板根实例下使用。

* 局部组件

```javascript
var Child = {
  template: '<div>A custom component!</div>'
}

new Vue({
  // ...
  components: {
    // 只能在父级模板中使用 <my-component>
    'my-component': Child
  }
})
```

### 全局组件

首先，我们来看下全局组件：

`Vue.component`方法提供了全局注册组件的能力，这也是`Vue`在初始化的过程中，通过内部的`initGlobalAPI`方法，在`Vue`这个全局唯一个根`constructor`上挂载的一个方法。