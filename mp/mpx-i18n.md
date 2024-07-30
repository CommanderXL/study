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