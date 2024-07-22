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

对于 computed 模式而言，语言包和方法都会在逻辑线程当中。但是在微信的模版语法当中