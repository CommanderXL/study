## options-merge 策略

对于 Mpx 的运行时而言，第一个需要解决的问题就是如何做 options—merge 操作，最终所要达到的结果就是：

* Hook 到小程序的生命周期钩子，由 MpxProxy 来接管页面/组件实例；
* 用户传入的 Options 配置收敛至 Mpx 内部来做处理；

这也是运行时阶段前置的工作之一。

```javascript
// @mpxjs/core/src/platform/patch/index.js

export default function createFactory(type) {
  ...

  let getDefaultOptions = getWxDefaultOptions

  // 第一次的 transferOptions 操作已经将用户注入的 mixins 全部抽离进行了合并，因此处理过后的 rawOptions 已经没有了 mixins
  const { rawOptions, currentInject } = transferOptions(options, type)

  // 获取在不同平台下 Mpx 注入的内置的 mixin
  rawOptions.mixins = getBuiltInMixins(rawOptions, type)

  // 再次进行 mixins 的合并处理，用以保证 mixin 的合并顺序以及最终代码的执行顺序
  const defaultOptions = getDefaultOptions(type, { rawOptions, currentInject })

  ...
  return ctor(defaultOptions)
}
```

```javascript
// @mpxjs/core/src/core/transferOptions.js

export default function transferOptions(options, type) {
  // 收集全局注入的 mixins，原生模式下不进行注入，这个时候仅做收集，还未做 mixins 各项的合并操作
  /**
   * mpx.injectMixins([
   *   {
   *     data: {
   *       customData: 123     
   *     }
   *   }
   * ])
   */
  if (!options.__nativeRender__) {
    options = mergeInjectedMixins(options, type)
  }

  ...

  // !!! 在 mergeOptions 方法当中进行实际的 mixins 各项合并的操作
  const rawOptions = mergeOptions(options, type)

  ...

  return {
    rawOptions,
    currentInject
  }
}
```

```javascript
// @mpxjs/core/src/core/mergeOptions.js

export default function mergeOptions(options = {}, type, needConvert = true) {
  ...

  // 声明一个新的 options 变量用以接收合并 mixins 各项的配置
  const newOptions = {}
  extractMixins(newOptions, options, needConvert)
}

function extractMixins(mergeOptions, options, needConvert) {
  ...
  if (options.mixins) {
    for (const mixin of options.mixins) {
      // 递归进行 mixin 的配置合并
      extractMixins(mergeOptions, mixin, needConvert)
    }
  }

  // 抽离 lifetimes 至 root 层级
  options = extractLifetimes(options)
  options = extractPageHooks(options)
  if (needConvert) {
    options = extractObservers(options)
  }
  // 进入到 options 具体每项的配置合并策略当中，最终的结果就是该 mixin 当中的每项配置都进行合并完
  mergeMixins(mergeOptions, options)
  return mergeOptions
}

function mergeMixins(parent, child) {
  for (let key in child) {
    if (currentHooksMap[key]) {
      // 生命周期项的合并
      mergeHooks(parent, child, key)
    } else if (/^(data|dataFn)$/.test(key)) {
      mergeDataFn(parent, child, key)
    } else if (/^(computed|properties|props|methods|proto|options|relations)$/.test(key)) {
      // 将对应 key 的值合并
      mergeShallowObj(parent, child, key)
    } else if (/^(watch|observers|pageLifetimes|events)$/.test(key)) {
      // 合并后最终转为数组形式
      mergeToArray(parent, child, key)
    } else if (/^behaviors|externalClasses$/.test(key)) {
      mergeArray(parent, child, key)
    } else if (key !== 'mixins' && key !== 'mpxCustomKeysForBlend') {
      ...
    }
  }
}
```

通过 Mixin 的方式添加对于小程序页面/组件生命周期 Hook，利用这些核心的 Hook 来实例化 MpxProxy 实例。此外再次调用 `mergeOptions` 方法完成刚才 mixin 进来的页面/组件的生命周期 Hook。

```javascript
// @mpxjs/core/src/platform/patch/wx/getDefaultOptions.js

export function getDefaultOptions(type, { rawOptions = {}, currentInject }) {
  let hookNames = ['attched', 'ready', 'detached']

  if (rawOptions.__pageCtor__) {
    hookNames = ['onLoad', 'onReady', 'onUnload']
  }
  const rootMixins = [{
    [hookNames[0]]() {
      initProxy(this, rawOptions, currentInject)
    },
    [hookNames[1]]() {
      if (this.__mpxProxy) this.__mpxProxy.mounted()
    },
    [hookNames[2]]() {
      if (this.__mpxProxy) this.__mpxProxy.unmounted()
    }
  }]
  rawOptions.mixins = rawOptions.mixins ? rootMixins.concat(rawOptions.mixins) : rootMixins
  rawOptions = mergeOptions(rawOptions, type, false)
  return filterOptions(rawOptions)
}
```
