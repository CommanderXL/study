1. 预读范围收敛(*.runtime.mpx -> alias 拓展)

2. attrsList 遍历 -> 生成 vnode data

(
* moduleId
* hidden
* slot
* slotTarget
* style 
* mpxShow
* class
* eventconfigs
* bindAttrs
)

3. 支持wxs -> js 添加 wxs 依赖 (class、style) -> i18n 支持 (done)

(
  injectWxs 注入 (删除 core/renderHelperMixin.js 有关 __ss, __sc 代码)
)

4. wx:if 流程

(
  processIfCondition 只能在 postProcessIf 里面处理，如果是在 processIf 里面处理会直接删除这个 node，导致其子节点会跳过处理的流程
  目前遵照 mpx processIf/postProcessIf 走全流程，做到静态节点的优化，只不过在 postProcessIf 最后特殊处理一下，用以运行时的渲染
)


5. app.json 全局组件的声明(基础渲染模板内的元素) -> 多插一层element上下文渲染

wxss 收集的工作 -> 只要命中了运行时组件都需要注入到 element 当中去

组件的声明都放到 element 组件内部（运行时组件应该是不需要 usingComponents 声明的，mpx-custom-element 注入到全局配置当中去
(
  都注入到 mpx-custom-component
)

原因：slot 需要注入到组件内部渲染，所以产生了一些依赖关系 -> 基础模板使用的组件是全局的



1. absolutePath（mpx-custom-element 单独走一次编译流程）  ->  componentsMap 访问文件信息映射

(
  mpx.hooks 来将 mpx 的处理流程给暴露出去
)

7. bindThis 不需要改流程(done)   ->  不需要 _c / needCollect -> false

(
  bindThis 判断依据是一个独立的变量 xxx，添加 this._c('xxx', this.xxx)，可以在 compiler 生成 render 函数自己添加 this，或者是针对 babel-plugin 做一些拓展
)

1. mpx-custom-element (element 组件)作为全局组件使用


-----



模板优化:
1. id={{i.data.moduleId}} 不需要都生成(static-view/pure-view)
2. 


## 基础用法

```javascript
<template>
	<custom-component wx:bind="{{ props }}"></custom-component>
<template>

<script lang="json">
{
	runtimeCompile: true,
	usingComponents: {
		"custom-component": "../path"
	}
}
</script>
```

## 编译

1. mpx-loader resolve 环节差异，会将当前页面/组件依赖的组件进行 resolve及读取操作，用以获取依赖的组件是否为运行时组件(`runtimeCompile`)。

* this.resolve -> 解析依赖路径
* this.fs.readFile -> 读取文件
* parseComponent -> parse sfc
* getJSONContent -> json 配置 -> 判断是否为运行时组件

将依赖的运行时组件名作为 resourcePath 的 query 参数拼接，以供后面编译环节的消费

(getJSONContent 方法有做拓展)

2. template-compiler

2.1 wxml 编译阶段

* wxml ast

对于原有的 node 节点属性做增强 -> el.xxx 属性用以生成 render 函数

* process 流程

processBindProps -> wx:bind
processRuntime -> el.isRuntimeCompile
prrocessSlotContent -> slot 处理，生成 render 函数，传参的形式
processSlotOutlet
postProcessRuntime -> 收集需要被注入到基础模板的节点

其他不同指令 `wx:class`、`wx:style`、`wx:show` 添加对应的 el.xxx 属性

* genElement -> render 函数字符串拼接

2.2 生成运行时注入代码 `global.currentInject.xxx`

* bindThis -> render 辅助函数

* slot 通过 `global.currentInject` 单独注入(非运行组件嵌套运行时组件使用)

```javascript
global.currentInject.runtimeSlots = function () {
	...
}
```

* ref 拓展

有一定的改动，模板各种混合使用的情况（运行时 ref 获取是惰性且有缓存）

```javascript
global.currentInject.getRefsData = function (needRuntimeRef) {
	...
}
```

运行时处理

3. json-compiler

收集各组件 hashName 及对应产出路径(最终需要输出至 app.json)。

processComponent 方法的接口参数有拓展

4. style-compiler


## 运行时

1. 如果为运行时组件，则合并 properties/props 为 computed 数据，同时新增 `bigAttrs` 属性用于接收 `wx:bind` 指令传入的大对象。

```javascript
export default function transferOptions(options, type) {
	....
	if (currentInject && currentInject.runtimeCompile) {
		composePropsToComputed(type, rawOptions)
	}
	...
}
```

添加 `bigAttrs`、`slots` 属性

2. 对 renderHelperMixin 做增强用以 render 函数生成 vnode，新增：

```javascript
export default function renderHelperMixin() {
	return {
		methods: {
			_i() {},
			_c() {},
			_r() {},
			// 以上为原有 render 函数使用的方法
			__c() {}, // createElement
			__v() {}, // createTextVNode
			__e() {}, // createEmptyVNode
			__t() {}, // resolveSlot
			__sc() {}, // stringifyClass
			__ss() {}, // stringifyStyle
		}
	}
}
```

3. 对 refsMixin.js 做增强用以支持在运行时条件下的 refs 获取

4. 对 proxy.js 做增强配合 render 函数用以支持运行时页面/组件的渲染和局部更新：

```javascript
export default class MPXProxy {
	...
	renderWithData (vnode) {
		if (vnode) {
			return this.doRenderWithVNode(vnode)
		}
		...
	}

	doRenderWithVNode (vnode) {
		if (!this._vnode) {
			// 全量渲染
			this.target.__render({ r: vnode })
		} else {
			// 局部渲染
			let diffPath = diffAndCloneA(vnode, this._vnode).diffData
			...
			this.target.__render(diffPath)
		}
	}
	...
}
```

## 事件系统

统一走事件代理 `__invoke` (`data-eventconfig`)

## Render 函数增强

`Render` 函数执行返回一个 `VNode`，传入 `this._render(vnode)` 完成页面/组件渲染

## 文件产出

通过正则匹配找出对应的文件名，动态注入在编译阶段收集、生成的节点和模板内容

* app.json
* mpx-render-base.wxml
* mpx-custom-element.wxss
* mpx-custom-element.json

## 模板引擎

`@mpxjs/template-engine` 独立的 `npm package`

`compilation.hooks.beforeModuleAssets` 阶段，通过模板引擎驱动在编译环节收集的需要被注入到基础模板里面的节点信息(`injectComponentConfig`)来生成最终的基础模板。
