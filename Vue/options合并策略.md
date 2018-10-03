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

这个方法接收 extendOptions 参数即为组件的定义，然后在方法内部调用 mergeOptions 方法(这个方法内部到底做了哪些工作后面会讲)，完成对于根 Vue 构造函数上的 options 属性的合并。这样便完成了组件 options 属性初始化的工作。通过`Vue.component`方法定义的全局组件，会在根 Vue 实例的 options 属性上挂载这个全局组件的构造函数。这也是为什么定义的全局组件如果要在组件当中使用时，不用在配置项里面去声明(这块的解释后面会讲)。