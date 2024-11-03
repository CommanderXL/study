## mpx-rn-atomic-css 

### 待确认


1. __getAppClassMap() -> 全局样式类 -> （是）
2. 样式隔离；（否）
3. layer；（rn 当中没有 css 能力，因此在运行时过程中来处理 layer 的能力）
4. 是否支持 chunk；（否）
5. unocss-base：相关的配置能力；
6. webOptions -> rnOptions；
7. rpx 相关的单位（preset 相关的配置）-> 单位相关的确认，在 rn 场景下是没有 px 单位的；
8. .container 命中了 shortcuts 的策略；
9. 产物的注入；-> 全部收集完后才注入；
10. 小程序的场景是在 processAssets 阶段进行收集和处理；（why?）  web 阶段是在 loader pre 阶段，对于源码进行处理；react 也需要在 pre 阶段；


### 待学习

1. unplugin 
2. unocss 本身

### preset 相关

需要看下哪些配置需要保留，哪些不需要

todo :是否需要维护自己的 preset 规则（核心要考量的是上层的 css 规则，能否在跨平台的场景下android/ios 能保持统一） nativeWind?


background-color: rgb(74 222 128 / var(--un-bg-opacity));  // 是个啥？


// 禁用写法 preset: []

1. theme

```javascript
module.exports = function presetMpx (options = {}) {
  const uno = presetUno(options)
  const { baseFontSize = 37.5 } = options
  return {
    ...uno,
    name: '@mpxjs/unocss-base',
    theme: {
      ...uno.theme,
      preflightRoot: ['page,view,text,div,span,::before,::after'] // todo 应该不需要
    },
    postprocess: (util) => { // Postprocess the generate utils object.
      util.entries.forEach((i) => {
        const value = i[1]
        if (typeof value === 'string' && remRE.test(value)) {
          i[1] = value.replace(remRE, (_, p1) => process.env.MPX_CURRENT_TARGET_MODE === 'web'
            ? `${p1 * baseFontSize * (100 / 750).toFixed(8)}vw` // web 场景下转 vm
            : `${p1 * baseFontSize}rpx`) // 小程序场景下转 rpx
        }
      })
    }
  }
}
```
