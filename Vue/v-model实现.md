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

示例当中是在`input`元素上绑定的`v-model`指令，它是属于`built in elements`，因此不同于自定义`component`创建`VNode`过程中还需要进行获取`props`属性，自定义事件，初始化钩子函数等，而`attrs`，`domProps`，`on`属性最终都会绑定到`dom`元素上。

当调用`_c`方法完成后，即`VNode`都已经生成完毕，开始将`VNode`渲染成真实的`dom`节点并挂载到`document`中去：

```javascript
function mountComponent (
  vm,
  el,
  hydrating
) {
  ...
  updateComponent = function () 
    // vm._render首先构建完成vnode
    // 然后调用vm._update方法，更vnode挂载到真实的DOM节点上
    vm._update(vm._render(), hydrating);
  };
  ...
  new Watcher(vm, updateComponent, noop, null, true /* isRenderWatcher */);
  ...
}
```

在页面初始化的阶段：

```javascript
function createElm (
  vnode,
  insertedVnodeQueue,
  parentElm,  // 父节点
  refElm,
  nested,
  ownerArray,
  index
) {

  ... 
  var data = vnode.data;          // 描述VNode属性的数据
  var children = vnode.children;  // VNode的子节点
  var tag = vnode.tag;            // VNode标签

  // 实例化自定义component vnode
  if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
    return
  }

  ...
  vnode.elm = vnode.ns
    ? nodeOps.createElementNS(vnode.ns, tag)
    : nodeOps.createElement(tag, vnode);
  setScope(vnode);

  /* istanbul ignore if */
  {
    // 挂载子节点，vnode为父级vnode
    createChildren(vnode, children, insertedVnodeQueue);
    // 触发内部的create钩子函数
    if (isDef(data)) {
      invokeCreateHooks(vnode, insertedVnodeQueue);
    }
    // 将vnode生成的dom节点插入到真实的dom节点当中
    insert(parentElm, vnode.elm, refElm);
  }
  ...
}
```

// TODO: 递归如何描述

在渲染`VNode`过程当中，如果是自定义的`component VNode`，那么首先完成`component`的`vm`实例化，接下来递归的对子节点进行实例化

注意当子节点全部实例化，并挂载到父节点后，开始调用`invokeCreateHooks`方法，触发`dom`节点`create`阶段所包含的钩子函数来完成对`dom`节点添加`attrs`，`domProps`，`dom事件`等。

```javascript
function invokeCreateHooks (vnode, insertedVnodeQueue) {
  for (var i$1 = 0; i$1 < cbs.create.length; ++i$1) {
    cbs.create[i$1](emptyNode, vnode);
  }
  i = vnode.data.hook; // Reuse variable
  if (isDef(i)) {
    if (isDef(i.create)) { i.create(emptyNode, vnode); }
    if (isDef(i.insert)) { insertedVnodeQueue.push(vnode); }
  }
}
```

在这里我们只关心和`v-model`相关的`domProps`和`dom事件`的钩子函数，首先来看下更新`domProps`的钩子函数：

```javascript
function updateDOMProps (oldVnode, vnode) {
  if (isUndef(oldVnode.data.domProps) && isUndef(vnode.data.domProps)) {
    return
  }
  var key, cur;
  var elm = vnode.elm;
  var oldProps = oldVnode.data.domProps || {};
  var props = vnode.data.domProps || {};
  // clone observed objects, as the user probably wants to mutate it
  if (isDef(props.__ob__)) {
    props = vnode.data.domProps = extend({}, props);
  }

  for (key in oldProps) {
    if (isUndef(props[key])) {
      elm[key] = '';
    }
  }
  for (key in props) {
    cur = props[key];
    ...
    // 如果是input的value属性
    if (key === 'value') {
      // store value as _value as well since
      // non-string values will be stringified
      elm._value = cur;
      // avoid resetting cursor position when value is the same
      var strCur = isUndef(cur) ? '' : String(cur);
      if (shouldUpdateValue(elm, strCur)) {
        // 更新dom对应的value值
        elm.value = strCur;
      }
    } else {
      elm[key] = cur;
    }
  }
}
```

在`dom`初次创建的过程中，通过`updateDOMProps`方法完成`dom`的`value`的初始化。

接下来看下是如何绑定`dom`事件的：

```javascript
// 更新dom绑定的事件
function updateDOMListeners (oldVnode, vnode) {
  if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
    return
  }
  var on = vnode.data.on || {};
  var oldOn = oldVnode.data.on || {};
  // 设置全局的dom target$1对象
  target$1 = vnode.elm;
  normalizeEvents(on);
  updateListeners(on, oldOn, add$1, remove$2, vnode.context);
  target$1 = undefined;
}

// 注意add$1方法，它完成了向dom target$1绑定事件的功能。相应的remove$2方法是将对应的事件从dom节点上删除
function add$1 (
  event,
  handler,
  once$$1,
  capture,
  passive
) {
  handler = withMacroTask(handler);
  if (once$$1) { handler = createOnceHandler(handler, event, capture); }
  target$1.addEventListener(
    event,
    handler,
    supportsPassive
      ? { capture: capture, passive: passive }
      : capture
  );
}
```

在本例当中，即向`input`节点绑定`input`事件：

```javascript
input.addEventListener('input', function (e) {
  if ($event.target.composing)
    return;
  val = $event.target.value 
})
```

当改变`input`输入框的内容时，触发`input`事件执行对应的回调函数，这个时候便会改变响应式数据`val`的值，即调用`val`的`setter`方法。



// 创建`VNode`环节
// 渲染的环节
// 绑定dom


// TODO: 总体的的概述
// 如何绑定/更新domProps
// 绑定原生的dom事件
// 和dom相关的attrs、domProps、原生的dom事件、style等，都是在将vnode渲染成真实的dom元素后，并关在到父dom节点后完成的。