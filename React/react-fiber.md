1. createRoot // react-dom/src/client/ReactDOMRoot.js
  
```javascript
function createRoot() {
  ...
  const root = createContainer(container, ...args) // 创建一个 FiberRootNode 节点，并和 dom element 进行关联 
  // FiberRoot 和 Fiber 节点并不是同一种数据结构类型
  return new ReactDOMRoot(root)  // 返回一个 ReactDOMRoot 节点示例，暴露了 render 方法，可以接受 function component 进行渲染
}


initializeUpdateQueue

firstScheduledRoot = lastScheduledRoot = root

---
function ReactDOMRoot(internalRoot: FiberRoot) {
  this._internalRoot = internalRoot
}

ReactDOMRoot.prototype.render = function (children) {
  const root = this._internalRoot
  updateContainer(children, root, null, null)
}

```

1. createContainer