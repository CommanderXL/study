## Vue组件系统简析

Vue version: 2.5.16

`Vue`的组件系统是`Vue`最为核心的功能之一。它也是构建大型的复杂的web应用的基础能力。接下来就通过这篇文章去分析下`Vue`组件系统是如何工作的。这篇文章主要是讲组件系统的渲染。

### 组件注册

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
var Parent = {
  template: '<div>A custom component!<child></child></div>',
  components: {
    child: {
      template: '<p>This is child component</p>'
    }
  }
}

new Vue({
  // ...
  components: {
    'parent-component': Parent
  }
})
```

通过局部注册方式注册的`child`组件只能在`parent`组件内部使用。


### 全局组件

首先，我们来看下全局组件：

`Vue.component`方法提供了全局注册组件的能力，这也是`Vue`在初始化的过程中，通过内部的`initGlobalAPI`方法，在`Vue`这个全局唯一个根`constructor`上挂载的一个方法。



```javascript
function initGlobalAPI (Vue) {
  ...
  initAssetRegisters(Vue);
  ...
}

// ASSET_TYPES -> ['component', 'directive', 'filter']
function initAssetRegisters (Vue) {
  /**
   * Create asset registration methods.
   */
  ASSET_TYPES.forEach(function (type) {
    Vue[type] = function (
      id,
      definition
    ) {
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        ...
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id;
          // definition = Vue.extend(definition)
          definition = this.options._base.extend(definition);
        }
        ...
        // 在Vue.options的components属性上挂载组件实例的constructor
        this.options[type + 's'][id] = definition;
        return definition
      }
    };
  });
}

```

通过`Vue.component`方法注册的组件最终还是调用的`Vue.extend`方法来完成子组件对父组件的一系列的继承的初始化的工作。同时在根`constructor`的`options`属性上挂载这个全局子组件的`constructor`。`Vue.extend`方法在整个`Vue`组件系统中算是一个建立起父子组件之间联系的作用。

```javascript
Vue.extend = function (extendOptions) {
    extendOptions = extendOptions || {};
    var Super = this;
    var SuperId = Super.cid;
    // 给extendOptions设置_Ctor属性
    var cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {});
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }
    var name = extendOptions.name || Super.options.name;
    ...
    // 子组件实例的初始化函数
    var Sub = function VueComponent (options) {
      this._init(options);
    };
    Sub.prototype = Object.create(Super.prototype);
    Sub.prototype.constructor = Sub;
    Sub.cid = cid++;
    // 完成options合并的工作，同时建立起子组件options和Super options的原型链
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    );
    Sub['super'] = Super;

    ...
    
    // allow further extension/mixin/plugin usage
    Sub.extend = Super.extend;
    Sub.mixin = Super.mixin;
    Sub.use = Super.use;

    // create asset registers, so extended classes
    // can have their private assets too.
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type];
    });
    // enable recursive self-lookup
    if (name) {
      Sub.options.components[name] = Sub;
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    Sub.superOptions = Super.options;
    Sub.extendOptions = extendOptions;
    Sub.sealedOptions = extend({}, Sub.options);

    // cache constructor
    cachedCtors[SuperId] = Sub;
    return Sub
  };
```

大家可以看到在`Vue.extend`方法内部，实际上就是创建了一个`VueComponent`的`constructor`，同时还需完成这个构造函数和根`constructor`方法、原型链的继承工作，其中有一点关于`options`配置属性合并的工作。

```javascript
...
Sub.options = mergeOptions(
  Super.options,
  extendOptions
)
...
```

// TODO: 讲解下options合并的过程
调用`mergeOptions`方法，将根`constructor`(superCtor)的`options`属性和子`constructor`的`options`(subCtor)属性进行一次合并。就拿`components`属性来说，最终的结果就是`subCtor.options.components.prototype = superCtor.options.components`，同时通过`mixin`，使得`subCtor.options.components`可直接访问全局组件和局部组件。


这样调用`Vue.component`方法后完成全局组件的注册。`Vue`的局部组件和全局组件注册的方法还不太一样，首先在注册的阶段，局部组件并非和全局组件一样在代码初始化的阶段就完成了全局组件的注册，局部组件是在父组件在实例化的过程中动态的进行注册的(后面的内容会讲到这个地方)。

### VueComponent实例化

当全局组件在注册完毕后，开始根实例化的过程。(这篇文章主要将组件渲染过程，所以其他关于`Vue`的部分内容会略去不展开)


从一个实例开始：

```javascript
// 模板
<div id="app">
  <my-component></my-component>
  <p>{{appVal}}</p>
</div>

// script
Vue.component('my-component', {
  template: '<div>this is my component<child></child></div>',
  components: {
    'child': {
      template: '<p>hello</p>'
    }
  }
})

new Vue({
  el: '#app',
  data () {
    appVal: 'this is app val'
  }
})
```

首先进行根实例化，从`Vue.prototype._init`方法开始：

```javascript
Vue.prototype._init = function () {
  var vm = this

  ...
  initRender(vm)
  ...

  if (vm.$options.el) {
    vm.$mount(vm.$options.el)
  }
}
```

在这个内部，通过调用`initRender`方法给实例挂载生成vnode节点的方法：

```javascript
function initRender () {
  ...
  // 在内部render函数执行生成vnode的时候调用
  vm._c = function (a, b, c, d) { return createElement(vm, a, b, c, d, false); };
  ...
  // 供开发者调用的生成vnode的方法
  vm.$createElement = function (a, b, c, d) { return createElement(vm, a, b, c, d, true); };
  ...
}
```

接下来根据是否有`el`配置选项来将`vue component`挂载到真实`dom`节点上。


```javascript


// public mount method
Vue.prototype.$mount = function (
  el,
  hydrating
) {
  el = el && inBrowser ? query(el) : undefined;
  return mountComponent(this, el, hydrating)
};

var mount = Vue.prototype.$mount;

Vue.prototype.$mount = function (
  el,
  hydrating
) {
  el = el && query(el);

  var options = this.$options;
  // resolve template/el and convert to render function
  if (!options.render) {
    var template = options.template;
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          template = idToTemplate(template);
          /* istanbul ignore if */
          if ("development" !== 'production' && !template) {
            warn(
              ("Template element not found or is empty: " + (options.template)),
              this
            );
          }
        }
      } else if (template.nodeType) {
        template = template.innerHTML;
      } else {
        {
          warn('invalid template option:' + template, this);
        }
        return this
      }
    } else if (el) {
      // 获取真实dom元素的字符串内容
      template = getOuterHTML(el);
    }
    if (template) {
      // 获取到模板的字符串内容后，调用compileToFunctions方法将模板字符编译成render函数
      // 需要注意的是编译的时候只编译模板下的字符串，并不能直接编译当前模板的子组件的模板内容
      var ref = compileToFunctions(template, {
        shouldDecodeNewlines: shouldDecodeNewlines,
        shouldDecodeNewlinesForHref: shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this);
      // 生成render函数
      var render = ref.render;
      var staticRenderFns = ref.staticRenderFns;
      options.render = render;                    // 挂载render函数
      options.staticRenderFns = staticRenderFns;  // 挂载staticRenderFns函数
    }
  }
  return mount.call(this, el, hydrating)
}

```

在上面的实例当中，`Vue`的编译系统会将`html`模板内容转化为`render`函数：

```javascript
// html模板
<div id="app">
  <my-component></my-component>
  <p>{{appVal}}</p>
</div>

// render函数
(function() {
  with(this){
    return _c('div',  // 标签tag
      {
        attrs:{"id":"app"}  // 属性值
      },
      [                     // children节点
        _c('my-component'),
        _v(" "),
        _c('p',[_v(_s(appVal))])
      ], 1)}
})
```

完成模板编译，生成`render`函数后，接下来调用`mountComponent`方法：

**!!! 前方高能：**

```javascript
function mountComponent (
  vm,
  el,
  hydrating
) {
  vm.$el = el;
  if (!vm.$options.render) {
    ...
  }
  // 挂载前
  callHook(vm, 'beforeMount');

  var updateComponent;
  /* istanbul ignore if */
  if ("development" !== 'production' && config.performance && mark) {
    ...
  } else {
    updateComponent = function () {
      // vm._render首先构建完成vnode
      // 然后调用vm._update方法，更vnode挂载到真实的DOM节点上
      vm._update(vm._render(), hydrating);
    };
  }

  // we set this to vm._watcher inside the watcher's constructor
  // since the watcher's initial patch may call $forceUpdate (e.g. inside child
  // component's mounted hook), which relies on vm._watcher being already defined
  new Watcher(vm, updateComponent, noop, null, true /* isRenderWatcher */);
  hydrating = false;

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  if (vm.$vnode == null) {
    vm._isMounted = true;
    callHook(vm, 'mounted');
  }
  return vm
}
```

在`mountComponent`方法内部首先定义`updateComponent`方法，这个方法内部首先会调用`vm._render`，将模板编译后生成的渲染函数转化成`vnode`，然后再调用`vm._update`完成真实`dom`的更新，新实例化一个`watcher`，开始进行页面的渲染工作。

首先来看下`vm._render`是如何将渲染函数转化成`vnode`的：

```javascript
Vue.prototype._render = function () {
    var vm = this;
    var ref = vm.$options;
    var render = ref.render;  // 获取render函数
    var _parentVnode = ref._parentVnode;

    ...

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    vm.$vnode = _parentVnode;
    // render self
    var vnode;
    try {
      // 开始调用render函数，用以生成vnode
      vnode = render.call(vm._renderProxy, vm.$createElement);
    } catch (e) {
      handleError(e, vm, "render");
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      ...
    }
    // return empty vnode in case the render function errored out
    if (!(vnode instanceof VNode)) {
      ...
      vnode = createEmptyVNode();
    }
    // set parent
    vnode.parent = _parentVnode;
    return vnode
  };
}
```

在上面已经提到了关于最后关于编译生成的`render`函数：

```javascript
// render函数
(function() {
  with(this){
    return _c('div',  // 标签tag
      {
        attrs:{"id":"app"}  // 属性值
      },
      [                     // children节点
        _c('my-component'),
        _v(" "),
        _c('p',[_v(_s(appVal))])
      ], 1)}
})
```

在实际的执行过程当中，首先完成`children`节点的`vnode`的生成工作。这里首先生成`my-component`子组件的`vnode`，我们来看下`vm._c`方法，这个方法内部最终是调用`_createElement`方法来生成`vnode`：

```javascript
function _createElement (
  context,
  tag,
  data,
  children,
  normalizationType
) {
  ...
  // support single function children as default scoped slot
  if (Array.isArray(children) &&
    typeof children[0] === 'function'
  ) {
    data = data || {};
    data.scopedSlots = { default: children[0] };
    children.length = 0;
  }
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children);
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children);
  }
  var vnode, ns;
  if (typeof tag === 'string') {
    var Ctor;
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag);
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      // 如果是内置的元素标签
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      );
    } else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component
      // 如果是自己自定义标签元素
      // 首先resolveAsset从$options属性上获取components定义
      // 需要注意的是全局注册的component，最终得到的Ctor为一个function
      // 而局部注册的component，最终得到的Ctor为一个plain Object
      vnode = createComponent(Ctor, data, context, children, tag);
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      );
    }
  } else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children);
  }
  if (Array.isArray(vnode)) {
    return vnode
  } else if (isDef(vnode)) {
    if (isDef(ns)) { applyNS(vnode, ns); }
    if (isDef(data)) { registerDeepBindings(data); }
    return vnode
  } else {
    return createEmptyVNode()
  }
}
```

因此上面提到的`render`函数，最终生成一个`vnode`

```javascript
VNode {
  ...
  children: [VNode, VNode, VNode],
  tag: 'div',
  elm: div#app(dom元素),
  data: {
    attrs: {
      id: '#app'
    }
  },
  context: Vue
  ...
}
```

当根节点的`VNode`生成完毕后，让我们再回到`mountComponent`方法内部：

```javascript
updateComponent = function () {
  // vm._render首先构建完成vnode
  // 然后调用vm._update方法，更vnode挂载到真实的DOM节点上
  vm._update(vm._render(), hydrating);
};
```

当`vm._render`函数生成完`vnode`后，执行`vm._update(vnode)`，将`vnode`渲染为真实的`DOM`节点：

```javascript
Vue.prototype._update = function (vnode, hydrating) {
  var vm = this;
  if (vm._isMounted) {
    callHook(vm, 'beforeUpdate');
  }
  var prevEl = vm.$el;
  var prevVnode = vm._vnode;
  var prevActiveInstance = activeInstance;
  activeInstance = vm;
  vm._vnode = vnode;
  // Vue.prototype.__patch__ is injected in entry points
  // based on the rendering backend used.
  if (!prevVnode) {
    // initial render
    // 页面初始化渲染
    vm.$el = vm.__patch__(
      vm.$el, vnode, hydrating, false /* removeOnly */,
      vm.$options._parentElm,
      vm.$options._refElm
    );
    // no need for the ref nodes after initial patch
    // this prevents keeping a detached DOM tree in memory (#5851)
    vm.$options._parentElm = vm.$options._refElm = null;
  } else {
    // updates
    // 更新
    vm.$el = vm.__patch__(prevVnode, vnode);
  }
  ...
}
```

当页面进行首次渲染的时候：

```javascript
vm.$el = vm.__patch__(
  vm.$el, vnode, hydrating, false /* removeOnly */,
  vm.$options._parentElm,
  vm.$options._refElm
)
```

可查阅关于patch的方法：

```javascript
function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {
  ...
  if (isUndef(oldVnode)) {
    ...
  } else {
    // 是否是真实的dom节点
    var isRealElement = isDef(oldVnode.nodeType);
    if (!isRealElement && sameVnode(oldVnode, vnode)) {
      // patch existing root node
      patchVnode(oldVnode, vnode, insertedVnodeQueue, removeOnly);
    } else {
      ...
      // replacing existing element
      var oldElm = oldVnode.elm;
      var parentElm$1 = nodeOps.parentNode(oldElm);
      // create new node
      createElm(
        vnode,
        insertedVnodeQueue,
        // extremely rare edge case: do not insert if old element is in a
        // leaving transition. Only happens when combining transition +
        // keep-alive + HOCs. (#4590)
        oldElm._leaveCb ? null : parentElm$1,
        nodeOps.nextSibling(oldElm)
      );
    }
  }
}

function createElm (
  vnode,
  insertedVnodeQueue,
  parentElm,  // 父节点
  refElm,
  nested,
  ownerArray,
  index
) {
  vnode.isRootInsert = !nested; // for transition enter check
  // 实例化customer component，而非built in component
  // 和上面提到的_createElement方法不同的是，那个方法是会创建新的vnode，这里是将vnode实例化成一个vue component。
  if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
    return
  }

  // anchor
  var data = vnode.data;
  var children = vnode.children;
  var tag = vnode.tag;
  if (isDef(tag)) {
    ...

    // 创建真实的DOM节点
    vnode.elm = vnode.ns
      ? nodeOps.createElementNS(vnode.ns, tag)
      : nodeOps.createElement(tag, vnode);
    setScope(vnode);

    /* istanbul ignore if */
    {
      // 挂载根节点之前首先递归遍历children vnode，将children vnode渲染成真实的dom节点，并挂载到传入的vnode所创建的DOM节点下
      createChildren(vnode, children, insertedVnodeQueue);
      if (isDef(data)) {
        invokeCreateHooks(vnode, insertedVnodeQueue);
      }
      console.log('parentEle: ', parentElm)
      console.log('vnode.elm', vnode.elm)
      // 将vnode生成的dom节点插入到真实的dom节点当中
      insert(parentElm, vnode.elm, refElm);
    }
    if ("development" !== 'production' && data && data.pre) {
      creatingElmInVPre--;
    }
  } else if (isTrue(vnode.isComment)) {
    vnode.elm = nodeOps.createComment(vnode.text);
    insert(parentElm, vnode.elm, refElm);
  } else {
    vnode.elm = nodeOps.createTextNode(vnode.text);
    insert(parentElm, vnode.elm, refElm);
  }
}
```

