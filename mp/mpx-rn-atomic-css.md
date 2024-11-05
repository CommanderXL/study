## mpx-rn-atomic-css 

### 待确认


1. __getAppClassMap() -> 全局样式类 -> （是）
2. 样式隔离；（否）
3. layer；（rn 当中没有 css 能力，因此在运行时过程中来处理 layer 的能力）
   1. layer 本身是通过虚拟模块，先引入虚拟模块，匹配成功后创建虚拟模块，写入 getLayerPlaceholder 文本内容，在编译构建结束后，匹配 getLayerPlaceholder 的站位内容，然后再做文本的替换过程
   2. web 场景下是基于 layer 来进行样式替换和注入的；
   3. prefight、shortcuts、default（layer 排序过程）
   4. rn 本身是通过 map 去进行，那么是否还有优先级的问题？？？不是利用先后之间的权重关系；应该是利用先后匹配的优先级问题？
4. 是否支持 chunk；（否）
5. unocss-base：相关的配置能力；
6. webOptions -> rnOptions；
7. rpx 相关的单位（preset 相关的配置）-> 单位相关的确认，在 rn 场景下是没有 px 单位的；
8. .container 命中了 shortcuts 的策略；
9.  产物的注入；-> 全部收集完后才注入；
10. 小程序的场景是在 processAssets 阶段进行收集和处理(各个模块文件已经生成了)；（why?）  web 阶段是在 loader pre 阶段，对于源码进行处理（不能放到 processAssets 去收集，因为已经是转译后的代码？）；react 也需要在 pre 阶段；
11. 注入的 class string，需要映射成 class map；（编译阶段）
12. 颜色系统，unocss 默认使用 css 变量的方案（opacity）来实现的？

```javascript
.bg-red {
  --un-bg-opacity: 1;
  background-color: rgba(248, 113, 113, var(--un-bg-opacity));
}
```

13. MagicString 的使用？or escape 编码的处理；

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



//// 变量相关的能力全部剔除掉？

框架侧：

* 工作流程方面
  * 编译构建相关，复用 web 侧流程 -> （layer 相关的逻辑可以剔除掉）
  * 注入逻辑，全局注入； -> `__getAppClassMap`?
  * css class string -> css class map

* 运行时相关
  * 匹配的流程 -> `__getStyle`
    * 大部分静态数据 -> 直接匹配
    * 可能会涉及到计算相关的 -> 动态数据：media query、vh/vw，hover/focus：状态相关
    * 变量相关，父子关系，text-[--color-red]

引擎侧：

* Rule 相关（直接生成 rn 合法的的样式规则属性；） -> rn-preset
   1. 不能实现的；-> warn/error
   2. 换着法子实现的；
   3. 只能在部分平台生效的；

* Rules
  * flexs
  * spaces
  * background
  * ...
   
nativeWind 作为参考

1. container (media query)
2. vw/vh
3. px -> paddingLeft / paddingRight (驼峰)