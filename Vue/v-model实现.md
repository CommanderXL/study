## v-model的实现

`v-model`是`Vue`内部实现的一个指令。它所提供的基本功能是在一些表单元素上实现数据的双向绑定。基本的使用方法就是：

```javascript

<div id="app">
  <input v-model="val">
</div>

new Vue({
  el: '#app',
  data () {
    return {
      val: 'default val'
    }
  },
  watch: {
    val (newVal) {
      console.log(newVal)
    }
  }
})
```

页面初次渲染完成后，`input`输入框的值为`default val`，当你改变`input`输入框的值的时候，你会发现控制台也打印出了输入框当中新的值。接下来我们就来看下`v-model`是如何完成数据的双向绑定的。

首先第一步，在这个`vue`实例化开始后，首先将`data`属性数据变成响应式的数据。接下来完成页面的渲染工作的时候，首先编译`html`模板：

```javascript
(function() {
  with (this) {
    return _c('div', {
      attrs: {
          "id": "app"
      }
    }, [_c('input', {
      directives: [{
        name: "model",
        rawName: "v-model",
        value: (val),
        expression: "val"
      }],
      attrs: {          // 最终绑定到input的type属性上
        "type": "text"
      },
      domProps: {       // 最终绑定到input的value属性上，设定input的value初始值
        "value": (val)
      },
      on: {             // 最终会给input元素添加的dom事件
        "input": function($event) {
          if ($event.target.composing)
            return;
          val = $event.target.value   // 响应input事件，同时获取到输入到Input输入框当中的值，并修改val的值
        }
      }
    })])
  }
}
)
```

接下来我们深入细节的看下整个绑定的过程，以及在页面当中修改`input`输入框中的值后，如何使得模型数据也发生变化。

// 创建`VNode`环节
// 渲染的环节
// 绑定dom


// TODO: 总体的的概述
// 如何绑定/更新domProps
// 绑定原生的dom事件
// 和dom相关的attrs、domProps、原生的dom事件、style等，都是在将vnode渲染成真实的dom元素后，并关在到父dom节点后完成的。