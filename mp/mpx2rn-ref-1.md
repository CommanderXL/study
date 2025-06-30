
* Vue 能力（抽象）-> 跨平台（$ref）

提供了跨平台（mp、web、rn）、一致性（基础节点、自定义节点）的获取节点实例的**语法糖**。
  
### 小程序的标准能力

微信小程序提供了底层 api：

* createQuerySelector 用以获取平台提供的基础节点(view、button 等)；
* selectComponent/selectComponents 用以获取自定义组件实例；

那么对于 ref 语法糖来说，最终通过编译+运行时结合的方案去...

* this.$refs.a => this.createQuerySelector().select('#a') => 获取节点的布局等信息等；
* this.$refs.b => this.selectComponent('#b') => 访问自定义组件实例的方法等；

### React 能力

React 也提供了获取基础节点的，


那么在实现 Mpx2Rn 的 Ref 能力的过程中，核心要解决的问题是：


Mpx2Rn 要实现小程序的标准规范

核心要解决的问题：



* 自定义组件 Ref
* 基础节点 Ref


* React 组件的 Ref
* 底层 api 调用（__selectRef 等的使用），special case 调用底层的 api 去做一些查询工作
* 调用/获取时机不能过早，需要在 onMounted 之后