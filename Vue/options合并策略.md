## 组件实例化的 options 合并策略

options 的合并应该说是 Vue 生命周期当中非常重要的一环。Vue 的组件实例化都是通过调用对应的构造函数完成相关实例化的工作。而在组件真正由 VNode 实例化成 vue 组件之前有关组件的相关定义都是挂载在组件的构造函数的 options 属性上。


### 通过new Vue实例化的组件 options 合并

我们定义一个全局的组件：

```javascript
Vue.component('myComponent', {
  template:
    '<div @click="test">this is my component<slot name="demo" :message="message"></slot></div>',
  props: {
    obj: Object
  },
  data() {
    return {
      message: 'demo-slot'
    }
  },
  methods: {
    test() {
      this.$emit('test')
    }
  },
  components: {
    child: {
      template: '<p>hello</p>'
    }
  }
})
```

`Vue.component`方法内部实际上是调用的 `Vue.extend` 方法，在这个方法内部完成这个组件的 options 的初始化的工作：

```javascript
Vue.extend = function (extendOptions) {
  ...
  var Super = this;
  var SuperId = Super.cid;

  ...
  var Sub = function VueComponent (options) {
    this._init(options);
  };

  Sub.options = mergeOptions(
    Super.options,
    extendOptions
  );

  ...

  return Sub
}
```

这个方法接收 extendOptions 参数即为组件的定义，然后在方法内部调用 mergeOptions 方法(这个方法内部到底做了哪些工作后面会讲)去完成对于根 Vue 构造函数上的 options 属性的合并，并将合并后的 options 属性赋值给子组件的构造函数 options 属性。这样便完成了组件 options 属性初始化的工作。通过`Vue.component`方法定义的全局组件，会在根 Vue 实例的 options 属性上挂载这个全局组件的构造函数。这也是为什么定义的全局组件如果要在组件当中使用时，可直接在模板当中进行书写，而不用在配置项里面去注册声明(这块的解释后面会讲)。

当组件真正进行实例化（new Vue）的阶段时，这里要分情况讨论了，首先让我们来看下根组件进行实例化:

```javascript
Vue.prototype._init = function(options) {
  ...

  if (options && options._isComponent) {
    // optimize internal component instantiation
    // since dynamic options merging is pretty slow, and none of the
    // internal component options needs special treatment.
    initInternalComponent(vm, options)
  } else {
    // 在vm实例上挂载的 $options
    vm.$options = mergeOptions(
      resolveConstructorOptions(vm.constructor), // 获取构造函数上的options
      options || {},
      vm
    )
  }

  ...
}
```

这里通过判断`options._isComponent`属性是进行内部子组件的实例化还是根组件的实例化。当是根组件的实例化的时候进入`else`的流程，调用`mergeOptions`方法完成 options 合并之前，首先调用 resolveConstructorOptions 方法获取构造函数上的 options 配置(这里不讨论单独通过 Vue.extend 方法完成继承的情况)。因为没有继承关系，所以这个方法最终还是返回这个构造函数上的 options 配置。第二个参数为外部传入的 options 配置，第三个参数为这个 vm 实例。最终将得到的 options 配置赋值给 vm 实例的 $options 属性上，并由这个 $options 属性去接着完成 vm 实例化。

接下来我们看下`mergeOptions`方法内部到底做了些什么工作。

```javascript
/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
// mergeOptions Anchor
function mergeOptions(parent, child, vm) {
  {
    checkComponents(child)
  }

  if (typeof child === 'function') {
    child = child.options // 获取子组件构造函数上的 options 属性
  }

  // 将子child的props属性统一设置为Object-based的类型
  normalizeProps(child, vm)
  normalizeInject(child, vm) // inject 属性
  normalizeDirectives(child) // directive 指令属性
  var extendsFrom = child.extends // extends 继承
  if (extendsFrom) {
    parent = mergeOptions(parent, extendsFrom, vm)
  }
  if (child.mixins) {
    // 混入
    for (var i = 0, l = child.mixins.length; i < l; i++) {
      parent = mergeOptions(parent, child.mixins[i], vm)
    }
  }
  var options = {}
  var key
  // 遍历父 options 的 key 值，并完成不同类型的 mergeField 操作
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField(key) {
    var strat = strats[key] || defaultStrat
    // 合并父组件和子组件上的各种定义属性
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}
```

首先遍历构造函数上的 options 的 key，执行 mergeField 方法，然后遍历实例化组件的过程中传入的 options 的 key，并执行 mergeField 方法。其中 mergeField 方法内部就是关于 options 当中各个字段预设的合并策略。

- 关于 el 和 propsData 属性的合并

会调用 defaultStrat 方法进行默认的合并策略：

```javascript
var defaultStrat = function(parentVal, childVal) {
  return childVal === undefined ? parentVal : childVal
}
```

关于 el 和 propsData 属性的合并还有一些限制就是：只允许通过`new Vue`(Vue 为根构造函数)这种形式去实例化一个 Vue 的实例。子组件的实例化过程当中是不允许传入这 2 个字段的。

- 关于 data 属性的合并

在实例化非组件实例时，并没有直接返回合并后的 data 的值，返回而是一个 mergedInstanceDataFn 函数：

```javascript
function mergedInstanceDataFn() {
  // instance merge
  var instanceData =
    typeof childVal === 'function' ? childVal.call(vm, vm) : childVal
  var defaultData =
    typeof parentVal === 'function' ? parentVal.call(vm, vm) : parentVal
  if (instanceData) {
    return mergeData(instanceData, defaultData)
  } else {
    return defaultData
  }
}
```

当实例化的阶段进入 initState 时，才会实际执行这个 mergedInstanceDataFn 函数，且是在传入的 vm 实例的作用域下执行的。然后通过 mergeData 方法将需要继承的 data 和 实例化传入的 data 进行合并。


- 关于生命周期钩子函数的合并

```javascript
function mergeHook (
  parentVal,
  childVal
) {
  return childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
}

LIFECYCLE_HOOKS.forEach(function (hook) {
  strats[hook] = mergeHook;
});
```

会将每个生命周期的钩子函数都置为一个数组。


- 关于 components, filter, directives 的合并策略

```javascript
function mergeAssets (
  parentVal,
  childVal,
  vm,
  key
) {
  var res = Object.create(parentVal || null);
  if (childVal) {
    "development" !== 'production' && assertObjectType(key, childVal, vm);
    // 对实例进行拓展，将子 assets 属性和父 assets 属性建立引用关系
    return extend(res, childVal)
  } else {
    return res
  }
}

// components, filter, directives 的合并策略，通过原型继承来合并
ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets;
});
```

有关这三者的合并策略是通过原型继承的方式去实现的。

- 有关 watch 的合并策略

```javascript
strats.watch = function (
  parentVal,
  childVal,
  vm,
  key
) {
  ...

  /* istanbul ignore if */
  if (!childVal) { return Object.create(parentVal || null) }
  {
    assertObjectType(key, childVal, vm);
  }
  if (!parentVal) { return childVal }
  var ret = {};
  extend(ret, parentVal);
  for (var key$1 in childVal) {
    var parent = ret[key$1];
    var child = childVal[key$1];
    if (parent && !Array.isArray(parent)) {
      parent = [parent];
    }
    ret[key$1] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child];
  }
  return ret
};
```

如果实例没有 watch，那么直接通过原型继承的方式返回构造函数上的 watch，如果构造函数上没有 watch，且实例有 watch，那么就直接返回实例的 watch。当两者都有的时候，那么需要将每个 key 对应的 watch 转化为数组，且先执行被继承来的 watch 函数。


- 关于 props, methods, inject, computed属性的合并策略

```javascript
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal,
  childVal,
  vm,
  key
) {
  if (childVal && "development" !== 'production') {
    assertObjectType(key, childVal, vm);
  }
  if (!parentVal) { return childVal }
  var ret = Object.create(null);
  extend(ret, parentVal);
  if (childVal) { extend(ret, childVal); }
  return ret
};
```

有关这四者的合并策略即：如果没有需要继承值，那么直接返回实例传入的值，否则通过覆盖的形式去完成值的合并的过程。

在 mergeOptions 方法里面有个地方没有提到，就是关于 mixins 混入。mixins 可以算做我们去实现 HOC 的一种常用的手段。一个组件可以接受一个 mixins 数组。mergeOptions 方法首先会遍历 mixins 数组，依次将每个 mixin 混入到构造函数的 options 属性上，然后再完成和实例中传入的 options 的合并。

### 全局组件 options 合并

### 局部组件 options 合并

首先局部组件在创建 VNode 的过程中：

```javascript
function createComponent (
  Ctor,
  data,
  context,  // 限制作用域
  children,
  tag
) {
  if (isUndef(Ctor)) {
    return
  }
  // Vue 的根构造函数
  var baseCtor = context.$options._base;

  // plain options object: turn it into a constructor
  // 即局部组件的注册
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor);
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  if (typeof Ctor !== 'function') {
    {
      warn(("Invalid Component definition: " + (String(Ctor))), context);
    }
    return
  }

  ...

  // return a placeholder vnode
  var name = Ctor.options.name || tag;
  // 子vnode的id使用vue-component及对应的id来进行标识
  var vnode = new VNode(
    ("vue-component-" + (Ctor.cid) + (name ? ("-" + name) : '')),
    data, undefined, undefined, undefined, context,
    // 这个参数为 componentOptions，即用于创建 componentInstance 实例
    { Ctor: Ctor, propsData: propsData, listeners: listeners, tag: tag, children: children },
    asyncFactory
  );

  ...
  
  return vnode
}
```

创建 VNode 之前，首先通过`baseCtor.extend(Ctor)`方法获取这个局部组件的构造函数，在这个方法内部会完成构造函数的 options 和这个局部组件配置 options 选项的合并工作，并将 options 属性挂载至这个局部组件的构造函数上。当进入到 VNode 实例化的过程中：

```javascript
function createComponentInstanceForVnode (
  vnode, // we know it's MountedComponentVNode but flow doesn't
  parent, // activeInstance in lifecycle state
  parentElm,
  refElm
) {
  var options = {
    _isComponent: true,   // 实例化一个内部的component的标识
    parent: parent,
    _parentVnode: vnode,
    _parentElm: parentElm || null,
    _refElm: refElm || null
  };
  
  ...

  return new vnode.componentOptions.Ctor(options)
}
```

这个时候会调用`Vue.prototype._init`方法开始子组件的实例化：

```javascript
Vue.prototype._init = function(options) {
  ...

  if (options && options._isComponent) {
    // optimize internal component instantiation
    // since dynamic options merging is pretty slow, and none of the
    // internal component options needs special treatment.
    initInternalComponent(vm, options)
  } else {
    // 在vm实例上挂载的 $options
    vm.$options = mergeOptions(
      resolveConstructorOptions(vm.constructor), // 获取构造函数上的options
      options || {},
      vm
    )
  }

  ...
}
```

这时便会调用`initInternalComponent`方法去完成子组件的 options 合并：

```javascript
function initInternalComponent (vm, options) {
  // 将 constructor 构造函数上绑定的 options 属性转到 vm.$options 上。即在 component 通过 Vue.extend 方法生成构造函数所生成的最终的 options
  var opts = vm.$options = Object.create(vm.constructor.options);
  // doing this because it's faster than dynamic enumeration(动态列举？).
  var parentVnode = options._parentVnode;
  opts.parent = options.parent;
  opts._parentVnode = parentVnode;  // 这里的 parentVnode 即为需要创建 VNode 对应的实例的 VNode。也是在这里通过 parentVnode 将 VNode 和 vm 进行关联起来的，之后在 vm 实例化的过程当中，会将 parentVNode 绑定到 vm.$vnode 上
  opts._parentElm = options._parentElm;
  opts._refElm = options._refElm;

  // 在创建 VNode 的时候传进来的 componentOptions 属性, 参见创建 VNode 时所调用的构造函数
  var vnodeComponentOptions = parentVnode.componentOptions;
  opts.propsData = vnodeComponentOptions.propsData;         // props属性
  opts._parentListeners = vnodeComponentOptions.listeners;  // 获取父component传递下来的listeners
  opts._renderChildren = vnodeComponentOptions.children;
  opts._componentTag = vnodeComponentOptions.tag;

  if (options.render) {
    opts.render = options.render;
    opts.staticRenderFns = options.staticRenderFns;
  }
}
```

在这个方法内部，通过原型继承的方法完成子组件实例的 $options 配置的初始化的过程。同时根据传入的 options 配置项去完成 VNode 在最终渲染前的配置工作。


### 总结

在 Vue 进行实例化之前，组件 options 配置选项的继承始终是通过实例的构造函数去完成，构造函数的 options 合并是完成组件实例化的先行任务。

其中组件的实例化和直接通过`new Vue`去完成的实例化的 options 合并过程有有些区别。组件的实例化之前，会首先在 Vue.extend 方法内部调用 mergeOptions 去完成构造函数 options 的合并，开始实例化后(`Vue.prototype._init`方法)，调用`initInternalComponent`方法，**通过继承的方法初始化实例的 $options 选项**。

而通过`new Vue`的方式直接完成实例化时，是在实例化开始后，调用`mergeOptions`方法去初始化实例的 $options 配置选项。