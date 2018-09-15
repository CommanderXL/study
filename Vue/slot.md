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

同时在模板当中定义的 template 的标签，最终不会渲染到真实的 DOM 节点当中，而是取其子节点进行渲染。

