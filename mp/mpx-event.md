## 事件系统

`mpx` 整体还是基于小程序的原生事件系统进行相关功能的设计及增强的。在原生小程序的父子组件进行通讯的时候，统一调用 triggerEvent 来在子组件当中触发对应的事件，而在父组件的模板当中需要定义好响应事件的回调函数。具体参见[文档](https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html)。

`mpx` 对于原生的小程序的事件能力做了整体的增强，主要是包含了以下的几个方面：

* 事件处理内联传参;
* wx:model 双向绑定;
* wx:model-prop 双向绑定属性;
* wx:model-event 双向绑定事件;
* wx:model-value-path 双向绑定数据路径;
* wx:model-filter 双向绑定过滤器;

PS: 这里把 `wx:model` 的能力放到这里来说主要也是因为 `wx:model` 也是一种语法糖，内部实际还是利用了事件相关的能力来完成数据的双向绑定。

首先来看下事件处理内联传参的能力增强，基本的使用方法参见[文档](https://www.mpxjs.cn/guide/basic/event.html)。

```javascript
// 在 sfc 当中的模板
<button bindtap="handleTapInlineWithEvent('g', $event)">g</button>

// 经过编译后最终输出的模板内容
<button
  bindtap="__invoke"
  data-eventconfigs="{{
    { tap: [['handleTapInlineWithEvent', 'g', '__mpx_event__']] }
  }}"
>
  g
</button>
```

可以看到在最终输出的模板上 `bindtap` 绑定为一个 `__invoke` 事件，而非在源码里面写的 `handleTapInlineWithEvent` 方法。其实这里是 `mpx` 在运行时部分 `mixin` 了一个 `__invoke` 内部方法：

```javascript
// src/platform/builtInMixins/proxyEventMixin.js

export default function proxyEventMixin() {
  const methods = {
    __invoke ($event) {
      const type = $event.type
      const emitMode = $event.detail && $event.detail.mpxEmit
      if (!type) {
        throw new Error('Event object must have [type] property!')
      }
      let fallbackType = ''
      if (type === 'begin' || type === 'end') {
        // 地图的 regionchange 事件会派发 e.type 为 begin 和 end 的事件
        fallbackType = 'regionchange'
      }
      const target = $event.currentTarget || $event.target
      if (!target) {
        throw new Error(`[${type}] event object must have [currentTarget/target] property!`)
      }
      const eventConfigs = target.dataset.eventconfigs || {}
      const curEventConfig = eventConfigs[type] || eventConfigs[fallbackType] || []
      let returnedValue
      curEventConfig.forEach((item) => {
        const callbackName = item[0]
        if (emitMode) {
          $event = $event.detail.data
        }
        if (callbackName) {
          const params = item.length > 1 ? item.slice(1).map(item => {
            // 暂不支持$event.xxx的写法
            // if (/^\$event/.test(item)) {
            //   this.__mpxTempEvent = $event
            //   const value = getByPath(this, item.replace('$event', '__mpxTempEvent'))
            //   // 删除临时变量
            //   delete this.__mpxTempEvent
            //   return value
            if (item === '__mpx_event__') {
              return $event
            } else {
              return item
            }
          }) : [$event]
          if (typeof this[callbackName] === 'function') {
            returnedValue = this[callbackName].apply(this, params)
          } else {
            const location = this.__mpxProxy && this.__mpxProxy.options.mpxFileResource
            error(`Instance property [${callbackName}] is not function, please check.`, location)
          }
        }
      })
      return returnedValue
    }
  }
}
```

这里的 `__invoke` 方法其实就是做了一层事件的代理，当触发 `tap` 事件的时候，由 `__invoke` 方法来进行响应。在其内部首先会获取事件对象上挂载的 `eventconfigs` 对象。这个事件对象的配置是在编译阶段拼接好最终输出到模板当中的字符串。