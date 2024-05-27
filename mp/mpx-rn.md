* 模版编译
  * 指令
  * render function 生成
* 组件渲染
  * react 渲染流程接管
* 组件系统
  * memo 目前看起来有点鸡肋，主要每次 props 传的都是一个新的，而不是通过 useMemo/useCallback 这些 hooks 生成的缓存的数据；
* 事件系统
  * 组件的自定义事件
  * 基础组件的原生事件