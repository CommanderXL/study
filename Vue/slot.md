## slot插槽

在日常的开发过程当中，slot 插槽应该是用的较多的一个功能。Vue 的 slot 插槽可以让我们非常灵活的去完成对组件的拓展功能。接下来我们可以通过源码来看下 Vue 的 slot 插槽是如何去实现的。

Vue 提供了2种插槽类型：

* 普通插槽
* 作用域插槽


### 普通插槽

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

定义了一个 my-component 全局组件，这个组件内部包含了一个名字为 demo 的插槽。当页面开始渲染时，首先完成模板的编译功能，生成对应的 render 函数：

```javascript
(function anonymous() {
  with (this) {
    return _c('div', {
      attrs: {
        "id": "app"
      }
    }, [_c('my-component', [_c('template', {
      slot: "demo"
    }, [_c('div', [_v("this is demo slot")])])], 2)], 1)
  }
}
)
```

并由这个 render 函数生成对应的 VNode，其中在生成自定义组件 my-component 的时候，有其对应的children VNode，即在模板当中的 template 节点。最终在生成的 my-component 的 VNode当中，在 componentOptions 属性当中存储了 VNode 子节点的信息。

```javascript
function createComponent(
  Ctor,
  data,
  context,
  children,
  tag
) {
  ...
  var vnode = new VNode(
    ("vue-component-" + (Ctor.cid) + (name ? ("-" + name) : '')),
    data, undefined, undefined, undefined, context,
    { Ctor: Ctor, propsData: propsData, listeners: listeners, tag: tag, children: children }, // VNode 构造函数接受的第7个参数为 componentOptions 即保存了有关 VNode 进行实例化成 Vue 实例所需要的信息
    asyncFactory
  );
  ...
}
```

当整个 VNode 生成完毕后，开始递归将 VNode 渲染成真实的 DOM 节点，并挂载至文档对象中。在将 my-component 的 VNode 进行渲染的过程中：

```javascript
function initRender(vm) {
  ...
  var options = vm.$options;
  var parentVnode = vm.$vnode = options._parentVnode; // the placeholder node in parent tree
  var renderContext = parentVnode && parentVnode.context;
  vm.$slots = resolveSlots(options._renderChildren, renderContext);
  ...
}

function resolveSlots (
  children,
  context
) {
  var slots = {};
  if (!children) {
    return slots
  }
  for (var i = 0, l = children.length; i < l; i++) {
    var child = children[i];
    var data = child.data;
    // remove slot attribute if the node is resolved as a Vue slot node
    if (data && data.attrs && data.attrs.slot) {
      delete data.attrs.slot;
    }
    // named slots should only be respected if the vnode was rendered in the
    // same context.
    if ((child.context === context || child.fnContext === context) &&
      data && data.slot != null
    ) {
      var name = data.slot;   // 获取 slot 的名
      var slot = (slots[name] || (slots[name] = []));
      if (child.tag === 'template') {   // 如果 tag 是 template 的 slot，那么就会取 template 的 children 作为 slot 的实际内容
        slot.push.apply(slot, child.children || []);
      } else {
        slot.push(child);
      }
    } else {
      // 设置 slots 的默认名为 default
      (slots.default || (slots.default = [])).push(child);
    }
  }
  // ignore slots that contains only whitespace
  for (var name$1 in slots) {
    if (slots[name$1].every(isWhitespace)) {
      delete slots[name$1];
    }
  }
  return slots
}
```

在 initRender 函数当中，首先从 vm 实例上获取这个自定义组件模板当中嵌入的子节点(options._renderChildren)，然后通过 resolveSlots 方法获取子节点对应的 slot，其中会根据这个 slot 是否有单独定义插槽名返回不同的插槽内容，比如说例子当中提供的为具名 demo 的插槽，所以最终返回的为具名插槽：

```javascript
{
  demo: [VNode]
}
```

这里如果为非具名的插槽，那么会默认返回：

```javascript
{
  default: [VNode]
}
```

同时在模板当中定义的 template 的标签，最终不会渲染到真实的 DOM 节点当中，而是取其子节点进行渲染。当执行完 initRender 方法后，vue 实例上已经有相关 slot 对应的节点信息，接下来开始完成 my-component 的渲染工作。

首先完成对应 my-component 的模板的编译工作，并生成对应的 render 函数：

```javascript
(function anonymous() {
  with (this) {
    return _c('div', {
      on: {
        "click": test
      }
    }, [_v("this is my component "), _t("demo")], 2)
  }
}
)
```

render 函数执行后生成对应的 VNode，其中 `_t("demo")` 方法即完成 slot 的渲染工作：

```javascript
// 获取 slot
 function renderSlot (
  name,
  fallback,
  props,
  bindObject
) {
  // 首先获取scopedSlot
  var scopedSlotFn = this.$scopedSlots[name];
  var nodes;
  if (scopedSlotFn) { // scoped slot
    props = props || {};
    if (bindObject) {
      if ("development" !== 'production' && !isObject(bindObject)) {
        warn(
          'slot v-bind without argument expects an Object',
          this
        );
      }
      props = extend(extend({}, bindObject), props);
    }
    nodes = scopedSlotFn(props) || fallback;
  } else {
    var slotNodes = this.$slots[name];
    // warn duplicate slot usage
    if (slotNodes) {
      if ("development" !== 'production' && slotNodes._rendered) {
        warn(
          "Duplicate presence of slot \"" + name + "\" found in the same render tree " +
          "- this will likely cause render errors.",
          this
        );
      }
      slotNodes._rendered = true;
    }
    nodes = slotNodes || fallback;
  }

  var target = props && props.slot;
  if (target) {
    return this.$createElement('template', { slot: target }, nodes)
  } else {
    return nodes
  }
}
```

在 renderSlot 方法中首先判断是否为 scopedSlot，如果不是那么便获取 vue 实例上 $slots 所对应的具名 slot 的 VNode 并返回。后面的流程便是走正常的组件渲染的过程。不过需要注意的是这里获取到的 VNode 实际上在父组件的作用域当中就已经生成好了，即 slot 的作用域属于父组件。


### 作用域插槽

有时候我们希望插槽能在子组件的作用域中进行编译，这样自定义组件能获得更多的拓展功能。在讲作用域插槽前还是先看一个作用域插槽的相关例子：

```javascript
<div id="app">
  <my-component>
    <template name="demo" slot-scope="slotProps">
      <p>this is demo slot {{ slotProps.message }}</p>
    </template>
  </my-component>
</div>


Vue.component('myComponent', {
  template: '<div>this is my component <slot name="demo" :message="message"></slot></div>',
  data() {
    return {
      message: 'slot-demo'
    }
  }
})
```

在 my-component 组件当中传递了一个 message 属性进去，然后在 slot 当中通过 slotProps.message 去获取从父组件传递到插槽内部的属性值。

首先在模板编译成 render 函数的生成 VNode 的过程当中：

```javascript
(function anonymous() {
  with (this) {
    return _c('div', {
      attrs: {
        "id": "app"
      }
    }, [_c('my-component', {
      scopedSlots: _u([{
        key: "demo",
        fn: function(slotProps) {
          return [_c('div', [_v("this is demo slot " + _s(slotProps.message))])]
        }
      }])
    })], 1)
  }
}
)
```

作用域插槽在模板的编译过程当中，并非直接编译成生成 VNode，并挂载至自定义组件 my-component 的 children 当中，而是缓存至 my-component 的 data.scopedSlots 属性中：

```javascript
function resolveScopedSlots (
  fns, // see flow/vnode
  res
) {
  res = res || {};
  for (var i = 0; i < fns.length; i++) {
    if (Array.isArray(fns[i])) {
      resolveScopedSlots(fns[i], res);
    } else {
      res[fns[i].key] = fns[i].fn;
    }
  }
  return res
}
```

这个时候 slot 的 VNode 并没有生成，而是被一个函数包裹起来，缓存在 scopedSlots 属性上。接下来进行 my-component 组件的渲染，完成模板编译成 render 函数：

```javascript
(function anonymous() {
  with (this) {
    return _c('div', {
      on: {
        "click": test
      }
    }, [_v("this is my component"), _t("demo", null, {
      message: message
    })], 2)
  }
}
)
```

调用 _t（即 renderSlot）方法来完成对具名的作用域插槽的渲染，这里需要注意的是传入了在 my-component 作用域当中定义的 message，再回到上面的 renderSlot 方法，在作用域插槽生成 VNode 的过程当中，即接收来自父组件传入的数据，所以在作用域插槽当中能通过 slotProps.message 访问到父组件上定义的 message 属性的值。当作用域插槽在父组件作用域内完成 VNode 的生成后，接下来仍然就是组件的递归渲染了，在这里就不赘述了。


