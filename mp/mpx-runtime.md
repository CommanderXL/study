# 业内小程序运行时框架技术细节剖析

### Kbone

#### Kbone vnode diff 更新策略

appendChild、removeChild、insertBefore、replaceChild 做了一层代理

```javascript
// dom 元素上的一些代理
class Element {
  appendChild() {
    ...
    if (hasUpdate) this.$_triggerMeUpdate() // 调用 $_triggerMeUpdate() 方法来触发
  }
  $_triggerMeUpdate() {
    if (!this.$_notTriggerUpdate) this.$trigger('$$childNodesUpdate')
  }

  /**
   * 监听 class 或 style 属性值变化
   */
  $_onClassOrStyleUpdate() {
    if (this.$__attrs) this.$_attrs.triggerUpdate()
    this.$_triggerParentUpdate()
  }
}

// 全局事件的监听
this.domNode.addEventListener('$$childNodesUpdate', this.onChildNodesUpdate, {$$namespace: 'root'}) // 子节点的更新
this.domNode.addEventListener('$$domNodeUpdate', this.onSelfNodeUpdate, {$$namespace: 'root'}) // 节点自身属性的更新


function onChildNodesUpdate() {
  ... // 一些子节点 diff 操作
  setData(...)
}

function onSelfNodeUpdate() {
  ... // 一些属性 diff 操作
  setData(...)
}
```

**在框架层面接管了 vnode 的 diff 和 patch 的操作。所以在 kbone 或者 rax 只需要在提供的 dom 层去代理相关的底层操作，搜集需要被更新的数据，然后再通过 setData 将数据更新到视图。**

**子组件根据 id 获取根树的 vdom 片段
根树 在递归渲染模板的阶段，会过滤掉子组件的 vdom，这部分统一交给 自定义组件 上下文当中去渲染。这样就可以做到局部更新。**

```javascript
// miniprogram-element/src/base.js
module.exports = Behavior({
	...
	attached () {
		// 获取这个节点的 id
		const nodeId = this.dataset.privateNodeId
		const pageId = this.dataset.privatePageId
		const data = {}

		this.nodeId = nodeId
		this.pageId = pageId

		// 记录 dom. -> 获取这个节点 id 在整个 tree 当中的 domNode (实际上就是 vdom 的子树)
		this.domNode = cache.getNode(pageId, nodeId)
		if (!this.domNode) return

		// 存储 document
		this.document = cache.getDocument(pageId)

		// 监听全局事件
		this.onChildNodesUpdate = tool.throttle(this.onChildNodesUpdate.bind(this))
		// 这个节点树上绑定事件监听
		this.domNode.$$clearEvent('$$childNodesUpdate', {$$namespace: 'root'})
		this.domNode.addEventListener('$$childNodesUpdate', this.onChildNodesUpdate, {$$namespace: 'root'})
		this.onSelfNodeUpdate = tool.throttle(this.onSelfNodeUpdate.bind(this))
		this.domNode.$$clearEvent('$$domNodeUpdate', {$$namespace: 'root'})
		this.domNode.addEventListener('$$domNodeUpdate', this.onSelfNodeUpdate, {$$namespace: 'root'})

		// 初始化
		this.init(data)

		// 初始化孩子节点
		const childNodes = _.filterNodes(this.domNode, DOM_SUB_TREE_LEVEL - 1, this)
		data.childNodes = _.dealWithLeafAndSimple(childNodes, this.onChildNodesUpdate)

		// 挂载该节点所处的自定义组件实例
		if (data.wxCompName) this.domNode._wxComponent = this

		// 执行一次 setData，初始化页面渲染
		if (Object.keys(data).length) this.setData(data)
	}
	...
})
```

#### 模板的构建

```javascript
// 子树
;<template name="subtree"></template>

// 叶子节点 (没有子元素的节点)
domInfo.isLeaf =
  !domInfo.isImage &&
  !domInfo.useTemplate &&
  domInfo.type === 'element' &&
  !child.children.length &&
  NEET_RENDER_TO_CUSTOM_ELEMENT.indexOf(child.tagName) === -1
```

### Taro

局部更新方案：

通过对于 Dom Node.ops 相关操作的代理，收集 vnode diff 相关的数据。统一在顶层派发 diff 数据后的 setData 操作。

**对于 `custom-wrapper` 性能优化的组件来说。和 `Kbone` 实现的方案不一致的地方是 diff 数据后，会对数据路径进行分析，找到 `custom-wrapper` 节点实例**。

```javascript
// packages/taro-runtime/src/dom/root.ts
export class TaroRootElement extends TaroElement {
	...
	public performUpdate(initRender = false, prerender: Func) {
		...
    // 收集数据更新
    while (this.updatePayloads.length > 0) {
      const { path, value } = this.updatePayloads.shift()!
      if (path.endsWith(Shortcuts.Childnodes)) {
        resetPaths.add(path)
      }
      data[path] = value
    }
    ...

    if (isFunction(prerender)) {
      prerender(data)
    } else {
      this.pendingUpdate = false
      const customWrapperUpdate: { ctx: any, data: Record<string, any> }[] = []
      const normalUpdate = {}
      if (!initRender) {
        for (const p in data) {
          const dataPathArr = p.split('.')
          let hasCustomWrapper = false
          // 遍历数据更新 path
          for (let i = dataPathArr.length; i > 0; i--) {
            const allPath = dataPathArr.slice(0, i).join('.')
            // nn: NodeName
            // 获取节点名，如果为 custom-wrapper，在当前上下文获取 custom-wrapper 的实例
            // 如果存在这个组件实例，序列化更新的数据 path，并推入到 customWrapperUpdate 更新队列里面。
            const getData = get(ctx.__data__ || ctx.data, allPath)
            if (getData && getData.nn && getData.nn === CUSTOM_WRAPPER) {
              const customWrapperId = getData.uid
              const customWrapper = ctx.selectComponent(`#${customWrapperId}`)
              const splitedPath = dataPathArr.slice(i).join('.')
              if (customWrapper) {
                hasCustomWrapper = true
                customWrapperUpdate.push({
                  ctx: ctx.selectComponent(`#${customWrapperId}`),
                  data: {
                    [`i.${splitedPath}`]: data[p]
                  }
                })
              }
              break
            }
          }
          if (!hasCustomWrapper) {
            normalUpdate[p] = data[p]
          }
        }
      }
      const updateArrLen = customWrapperUpdate.length
      if (updateArrLen) {
        const eventId = `${this._path}_update_${eventIncrementId()}`
        const eventCenter = this.eventCenter
        let executeTime = 0
        eventCenter.once(eventId, () => {
          executeTime++
          if (executeTime === updateArrLen + 1) {
            perf.stop(SET_DATA)
            if (!this.pendingFlush) {
              this.flushUpdateCallback()
            }
            if (initRender) {
              perf.stop(PAGE_INIT)
            }
          }
        }, eventCenter)
        // 遍历 customWrapperUpdate 完成自定义组件(在对应的上下文)的数据更新
        customWrapperUpdate.forEach(item => {
          if (process.env.NODE_ENV !== 'production' && options.debug) {
            // eslint-disable-next-line no-console
            console.log('custom wrapper setData: ', item.data)
          }
          item.ctx.setData(item.data, () => {
            eventCenter.trigger(eventId)
          })
        })
        // 在 root tree 的上下文当中完成数据的更新(和 custom-wrapper 不是同一个上下文)
        if (Object.keys(normalUpdate).length) {
          if (process.env.NODE_ENV !== 'production' && options.debug) {
            // eslint-disable-next-line no-console
            console.log('setData:', normalUpdate)
          }
          ctx.setData(normalUpdate, () => {
            eventCenter.trigger(eventId)
          })
        }
      } else {
        if (process.env.NODE_ENV !== 'production' && options.debug) {
          // eslint-disable-next-line no-console
          console.log('setData:', data)
        }
        ctx.setData(data, () => {
          perf.stop(SET_DATA)
          if (!this.pendingFlush) {
            this.flushUpdateCallback()
          }
          if (initRender) {
            perf.stop(PAGE_INIT)
          }
        })
      }
    }
	}
	...
}
```

### Rax
