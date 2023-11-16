## ModuleGraph

moduleGraph 实际是用来管理 module 与相关 dependency 之间的依赖的抽象

针对 moduleGraph 生成引入了另外的数据结构用以管理他们之间的依赖关系：

1. 

```javascript
this._moduleMap = new Map() // Map<module, ModuleGroupModules>
```