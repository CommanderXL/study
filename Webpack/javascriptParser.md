
HookMap 的使用：首先预定义一个 Hook Name(hooks.xxx.for('xxx').tap)，在具体使用时触发当前这个 Hook(hooks.xxx.get)


```javascript
if (this.hooks.program.call(ast, comments) === undefined) {
  this.detectMode(ast.body)
  // 只是做基本的数据收集、相关的 Hook 的触发
  this.preWalkStatements(ast.body)
  this.prevStatement = undefined
  this.blockPreWalkStatements(ast.body)
  this.prevStatement = undefined
  this.walkStatements(ast.body)
}

```
module sourceType -> javascript/auto、javascript/esm 等？

range：loc.start -> loc.end