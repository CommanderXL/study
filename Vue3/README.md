1. [Vue组合式API](https://composition-api.vuejs.org/zh/#%E6%A6%82%E8%BF%B0)


### 渲染器相关

* [Vue3 Compiler 优化细节，如何手写高性能渲染函数](https://zhuanlan.zhihu.com/p/150732926)

1. PatchFlags: 在 template 转 ast 的过程中，根据是否为动态节点及动态节点的类型去添加 PatchFlags 标记

```javascript
// packages/shared/src/patchFlags.ts

export const enum patchFlags = {

}
```

2. dynamicChildren: 存储一个节点下所有子代动态（带有 PatchFlags 标记的 VNode 节点）节点的数组

3. Block & Block Tree & Fragment

Block 首先是一个 VNode，带有一些特殊的属性。

Block Tree 在 diff 过程当中所带来的优势主要体现在：

4. hoistStatic 静态节点提升，是以树为单位的。

```javascript
// 除了根节点 div 作为 block 不可被提升外，section 元素及子代节点都会被提升
<div>
	<section>
		<p>
			<span>abc</span>
		</p>
	</section>
</div>

// section 为根节点的子树不会被提升、但是 p 标签及其子代都是静态的会被提升
<div>
  <section>
    {{ dynamicText }}
    <p>
      <span>abc</span>
    </p>
  </section >
</div>
```

5. Cache Event Handler(`cacheHandlers`)

* [渲染器](http://hcysun.me/vue-design/zh/renderer-advanced.html#%E8%87%AA%E5%AE%9A%E4%B9%89%E6%B8%B2%E6%9F%93%E5%99%A8%E7%9A%84%E5%BA%94%E7%94%A8)

1. Fragment -> 抽象元素

2. Portal -> 用以标识 DOM 节点可以被渲染到指定的目标元素下

```javascript
<template>
  <Portal target="#app-root">
    <div class="overlay"></div>
  </Portal>
</template>
```