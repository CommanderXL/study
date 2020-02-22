## Vue 的演进与 Typescript

1. 类型推导
2. 自动补全
3. 结构性的类型系统

读这篇文章之前，大家可以看下尤大有关`Typescript是否使用于Vue开发`这个问题在知乎上的一个回答。

* [issue1](https://www.zhihu.com/question/46397274?sort=created)
* [issue2](https://www.zhihu.com/question/310485097?sort=created)

Vue3.0 即将来临之际，也简单的了解了下 Vue2.x 在使用 Typescript 进行开发的一些局限性，以及针对这个问题 vue 团队所进行的考虑。同时 Vue3.0 在使用 Typescript 进行重构后对于我们未来使用 vue 进行开发所带来的一些改变。

大家都清楚 Vue2.x 的设计是 options-based 的，一个包含了描述组件选项的对象，这个对象上包含了描述类型包括：data、props、mixins、computed、methods 等等。Vue 创建组件的方式通过 Vue.extend 方法去完成的，当然内部还是基于原型链的形式去完成的。那么基于 Vue.extend 方法内部的这种原型链的这种设计方式在我们使用 TS 进行业务代码的开发当中主要会遇到什么问题呢？

首先需要知道的一点就是在 TS 从一定程度上来说就是 Js 的语法糖，借助 IDE 能实现类型推导，自动提示的功能，同时借助编译器完成向 Js 代码的编译转化工作，最终在宿主环境当中去运行。TS 在语言设计当中提供了类，使用类进行继承、实例化。这个是在 Js 当中没有的(虽然 es6 提供了 Class 其实也是通过 prototype 来实现继承和实例化)，从这个点来说，TS 语言设计层面采用的是更加传统的 OO 的编程范式(Class)，而非基于原型的编程范式。当然 TS 当中的类(Class)最终编译到 Js 后还是通过原型继承的方式来工作的。

Vue 组织业务代码中有一点比较爽的就是，在 SFC 的 `<script>` block 中组织代码的方式如下：

```javascript
export default {
  props: {},
  data() {
    return {}
  },
  mixins: [],
  computed: {},
  methods: {}
}
```

你通过在 props、data、mixins、computed、methods 当中定义的属性、方法或者混入直接通过 this 就可以访问到了（当然很多人觉得这种通过 options-based 然后在内部将这些内容挂载到 this 上的设计方式感觉很魔幻）。不过也正是因为这样的设计，导致一开始有人想用 TS 来组织代码 Vue 代码的时候，IDE 很难去完成类型推导，自动补全等功能。关于 Vue 和 TS 的结合在 Vue 的 [issue](https://github.com/vuejs/vue/issues/478) 有过非常详细的讨论以及社区对于 Vue 和 TS 的结合所做的一些改进和衍变。

那么如果 Vue 想要和 TS 更好的结合。那么在组织 Vue 的代码过程中就需要向 Class-based 进行靠近(这是因为 TS 就是设计成这样的)。所以在代码组织上：

1. Prototypally inheriting Vue
2. Pass configuration to instance not via constructor.


it's because ES6 class in its current state is insufficient and awkward for defining components. There are no static properties, so you either have to use static get xxx () { return ... }, or attach them outside of the class declaration, or use decorators (stage 1 proposal). In reality I never extend components more than one levels deep, and always export plain object options, so I don't even use Vue.extend explicitly at all.