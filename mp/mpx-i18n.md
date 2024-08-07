# I18n 能力

## 编译环节

如果在模版的表达式 `{{ xxx }}` 当中扫描到使用了 `i18n` 相关的工具方法，那么会标记 `hasI18n = true`，在当前的模版处理完后依据标记来注入运行时相关的代码。

```javascript
if (hasI18n) {
  if (i18nInjectableComputed.length) { // 如果是走 computed 模式，最终也就通过 computed 的注入策略来注入代码
    meta.computed = (meta.computed || []).concat(i18nInjectableComputed)
  } else { // 如果是走 `wxs` 处理，最终 i18n 相关的功能函数也就会被注入到 wxs 当中：
    injectWxs(meta, i18nModuleName, i18nWxsRequest)
  }
}
```

### wxs 模式

首先在 wxs 模式下，依据小程序的平台能力，需要引入对应的 wxs 模块，同时在模版当中调用对应 wxs 模块上所暴露出来的对应方法。

不过我们在源码当中肯定只会调用基本的 i18n 函数，并不会去手动定义 wxs 模块，所以在 template 编译环节的一个工作就是在模版当中注入 wxs 模块并将原始的方法替换为挂载到 i18n 模块下所暴露出来的方法调用：

```javascript
const funcNameREG = new RegExp(`(?<![A-Za-z0-9_$.])${i18nFuncName}\\(`, 'g')

exp = exp.replace(funcNameREG, `${i18nModuleName}.$1(null, _l, _fl, `)
```


### computed 模式

可以通过 `webpack-plugin` 的 `i18n.useComputed` 配置开启使用。对于 computed 模式而言，和 wxs 模式最大的不同在于语言包和方法都会在逻辑线程当中，因此代码的体积相较于 wxs 模式更小，但是文本的替换处理都是在逻辑线程当中，当语言包发生变化后，变化的数据会被传递到渲染线程当中，因此有一定的性能开销。

但是在微信的模版语法当中是不支持函数执行获取返回值的：

```javascript
// foo 函数执行的返回值并不能在模版当中渲染出来
<view>{{ foo() }}</view>
```

那么我们在使用 i18n 的能力的时候，模版当中的源码就是使用的 `<view>$t('message.name', { name: 'hello' })</view>` 函数调用的形式，理论上这个翻译函数是需要返回对应的翻译文案，但是目前在微信的模版语法规范当中，很显然是无法满足诉求的。

那么在使用 computed 模式下这个问题通过什么形式来解决呢？mpx 在模版编译的环节扫描到翻译函数的时候会直接将翻译函数替换为一个注入的 computed 数据：

```javascript
for (const i18nFuncName of i18nFuncNames) {
  ...
  if (i18n.useComputed || !i18nFuncName.startsWith('\\$')) {
    const i18nInjectComputedKey = `_i${i18nInjectableComputed.length + 1}` // 替换为表达式
    i18nInjectableComputed.push(`${i18nInjectComputedKey} () {\n return ${exp.trim()}}`) // 最终会被注入到运行时代码当中的 computed 数据
    exp = i18nInjectComputedKey
  } else {
    ...
  }
}
```

这样也就完成了将模版当中函数调用的语法转换为最终模版上的表达式的写法。

此外，还有一个需要关注的点，在 i18n 的能力当中如果在运行时阶段直接切换语言类型 `locale` 是需要重新完成页面的文本替换，也就是页面的更新。这里会自然联想到 mpx 的 render 函数，它是建立响应式数据和模版更新的桥梁。

这里在 mpx 运行时当中内置了一个 `i18nMixin`：

```javascript
export default function i18nMixin () {
  return {
    _l () {
      return i18n.global.locale.value || DefaultLocale
    },
    _fl () {
      return i18n.global.fallbackLocale.value || DefaultLocale
    }
  }
}
```

通过给每个组件实例注入全局的语言字段 `_l`、`_fl`。再回到 wxs 模式当中，模版编译过程将原本的翻译函数替换为 wxs 函数访问形式，同时也注入了通过 mixin 混入的语言数据：

```javascript
exp = exp.replace(funcNameREG, `${i18nModuleName}.$1(null, _l, _fl, `)
```

这样在模版编译生成 render 函数的过程中也就能扫描到模版当中访问了 `_l`、`_fl`，最终这两个字段的访问也会被注入到 render 函数当中，从而建立起语言类型 `locale` 和模版更新之间的联系：当在运行时阶段动态更新语言字段，也就会重新触发 render 函数的执行，也就意味着重新访问计算对应语言下的文本内容，在这个阶段完成最终渲染数据的收集工作后即可调用 setData 完成最终的视图更新。

当然另外还有一种场景，就是在运行时环节对于语言集 `messages` ({ 'en-US': {}, 'zh-CN': {} })的更新同样需要重新渲染视图。首先对于框架而言，接受到的数据是纯静态的，在框架内部会将这些纯静态的语言集合转化为 `shallowRef` 数据类型（见下方 createComposer 实现），当在运行时代码需要更新语言集：`setLocaleMessage`：

```javascript
// core/src/platform/builtMixins/i18nMixin.js

const setLocaleMessage = (local, message) => {
  messages.value[local] = message
  triggerRef(messages) // 设置语言集，会调用 triggerRef 方法来触发对应的翻译字段更新，进而触发 render 函数的执行和视图的渲染
}
```



一个实际的例子：

```javascript
<view>this {{$t('message.hello', { message: { hello: '你好' } })}}</view>


// 编译环节动态注入的 computed 数据
__webpack_require__.g.currentInject.injectComputed = {
  _i1() { // 最终编译产出的模版上访问的数据字段
    return this.$t('message.hello', {
      message: {
        hello: '你好'
      }
    });
  }
};
```

实际上在访问 computed 字段 `_i1` 过程中，也就建立起了 `_i1` 和响应式数据 `messages` 之间的联系。因此当语言集发生更新的时候，也就进而触发视图的更新。

视图更新流程：setLocalMessage -> _i1 -> render Fn -> 视图重新渲染

### 翻译函数在两种模式下的复用

默认情况下翻译函数是通过 wxs 模块的形式注入的，但是如果使用 computed 模式的话，翻译函数需要被注入到逻辑线程当中。那么在这种场景当中：一个独立的模块如何被注入到 mpx 运行时当中。

在这部分的实现当中，翻译函数的导出最终会被挂载至全局对象 `global.i18n` 当中：

```javascript
// webpack-plugin/lib/runtime/i18n.wxs
module.exports = {
  t: function() {},
  tc: function() {},
  te: function() {},
  tm: function() {}
}

if (!__mpx_wxs__) {
  if (!global.i18n) {
    global.i18n = {
      locale: getLocale(),
      fallbackLocale: getFallbackLocale(),
      messages: getMessages(),
      methods: module.exports // i18n.wxs 模块的翻译函数的导出最终会在运行时阶段挂载到每个组件实例上
    }
  }
}
```

那么在 mpx 框架初始化的阶段，如果发现 `global.i18n` 存在，那么也就会初始化 i18n 相关的模块内容，将 `global.i18n` 上挂载的翻译函数方法注入到每个组件实例当中。

```javascript
// core/src/index.js
if (__mpx_mode__ !== 'web') {
  if (global.i18n) {
    Mpx.i18n = createI18n(global.i18n)
  }
}
```

```javascript
// core/src/platform/builtMixins/i18nMixin.js
export function createI18n (options) {
  ...
}

function createComposer (options) {
  ...
  // 响应式数据 locale
  const locale = ref(
    __root && inheritLocale
     ? __root.locale.value
     : (options.locale || DefaultLocale) 
  )

  // 响应式数据 fallbackLocale
  const fallbackLocale = ref(
    __root && inheritLocale
      ? __root.fallbackLocale.value
      : (options.fallbackLocale || DefaultLocale)
  )

  const messages = shallowRef(
    isPlainObject(options.messages)
      ? options.messages
      : { [locale]: {} }
  )

  ...
}

export default function i18nMixin () {
  if (i18n) {
    return {
      computed: {
        _l() {
          return i18n.global.locale.value || DefaultLocale
        },
        _fl() {
          return i18n.global.fallbackLocale.value || DefaultLocale
        }
      },
      [BEFORECREATE] () {
        ...
        Object.keys(i18nMethods).forEach(methodName => {
          this['$' + methodName] = (...args) => {
            if (methodName === 'tc') methodName = 't'
            return i18n.global[methodName](...args)
          }
        })
      }
    }
  }
}
```