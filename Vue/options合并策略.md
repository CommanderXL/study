## 组件实例化的 options 合并策略

options 的合并应该说是 Vue 生命周期当中非常重要的一环。Vue 的组件实例化都是通过调用对应的构造函数完成相关实例化的工作。而在组件真正由 VNode 实例化成 vue 组件之前有关组件的相关定义都是挂载在组件的构造函数的 options 属性上。例如，我们定义一个全局的组件：

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

这里通过判断`options._isComponent`属性是进行内部子组件的实例化还是根组件的实例化。当是根组件的实例化的时候进入`else`的流程，调用`mergeOptions`方法完成 options 合并之前，首先调用 resolveConstructorOptions 方法获取构造函数上的 options 配置(这里不讨论单独通过Vue.extend方法完成继承的情况)。因为没有继承关系，所以这个方法最终还是返回这个构造函数上的 options 配置。第二个参数为外部传入的 options 配置，第三个参数为这个 vm 实例。最终将得到的 options 配置赋值给 vm 实例的 $options 属性上，并由这个 $options 属性去接着完成 vm 实例化。

接下来我们看下`mergeOptions`方法内部到底做了些什么工作。

```javascript
/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance. 
 */
// mergeOptions Anchor
function mergeOptions (
  parent,
  child,
  vm
) {
  {
    checkComponents(child);
  }

  if (typeof child === 'function') {
    child = child.options;  // 获取子组件构造函数上的 options 属性
  }

  // 将子child的props属性统一设置为Object-based的类型
  normalizeProps(child, vm);
  normalizeInject(child, vm); // inject 属性
  normalizeDirectives(child); // directive 指令属性
  var extendsFrom = child.extends;  // extends 继承
  if (extendsFrom) {
    parent = mergeOptions(parent, extendsFrom, vm);
  }
  if (child.mixins) { // 混入
    for (var i = 0, l = child.mixins.length; i < l; i++) {
      parent = mergeOptions(parent, child.mixins[i], vm);
    }
  }
  var options = {};
  var key;
  // 遍历父 options 的 key 值，并完成不同类型的 mergeField 操作
  for (key in parent) {
    mergeField(key);
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key);
    }
  }
  function mergeField (key) {
    var strat = strats[key] || defaultStrat;
    // 合并父组件和子组件上的各种定义属性
    options[key] = strat(parent[key], child[key], vm, key);
  }
  return options
}
```

我们特别关注下经常用到的 mixins 混入。mixins 可以算做我们去实现 HOC 的一种常用的手段。一个组件可以接受一个 mixins 数组。

