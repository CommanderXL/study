## Js-interpreter

几个比较重要的类/方法：

1. Scope 作用域，通过 parentScope 建立起 scope 之间的联系，object 用以保存作用域上可访问的内容

```javascript
Interpreter.prototype.createScope = function(node, parentScope) {
  ...
  var object = this.createObjectProto(null)
  var scope = new Interpreter.Scope(parentScope, strict, object)
  if (!parentScope) {
    this.initGlobal(scope.object) // 初始化全局对象、方法等，挂载至 scope.object 上
  }
  this.populateScope_(node, scope) // 作用域上绑定 ast 可访问的 identifer(vars)/function
  return scope
}

Interpreter.Scope = function(parentScope, strict, object) {
  this.parentScope = parentScope // 父作用域
  this.strict = strict
  this.object = object // 作用域上可以访问的内容
}

Interpreter.prototype.populateScope_ = function(node, scope) {

}
```

2. stateStack 使用一个栈来保存当然访问到的 ast 节点以及作用域，同时在 string excute 阶段 state 还会拓展一些中间属性来记录当前代码执行的阶段：

```javascript
Interpreter.State = function(node, scope) {
  this.node = node
  this.scope = scope
}
```

对于接受到的源码字符串，统一使用 acorn 进行 parse 并获得 ast。

```javascript
Interpreter.prototype.run = function() {
  while(!this.paused_ && this.step()) {}
  return this.paused_
}

Interpreter.prototype.step = function() {
  var stack = this.stateStack
  var endTime = Date.now() + this['POLYFILL_TIMEOUT'];
  do {
    var state = stack[stack.length - 1];
    if (!state) {
      return false;
    }
    // 获取 ast node 节点类型，用以决定使用哪一个 stepFunction
    var node = state.node, type = node['type'];
    if (type === 'Program' && state.done) {
      return false;
    } else if (this.paused_) {
      return true;
    }
    // Record the interpreter in a global property so calls to toString/valueOf
    // can execute in the proper context.
    var oldInterpreterValue = Interpreter.currentInterpreter_;
    Interpreter.currentInterpreter_ = this;
    try {
      try {
        // 如果 stepFunction 有返回 nextState，那么将这个 state 入栈，继续进入到这个循环过程当中，开始处理这个 state -> 获取 node.type -> 匹配 stepFunction
        // 如果没有 nextState 返回，那么说明这个节点已经没有内容需要执行
        var nextState = this.stepFunctions_[type](stack, state, node);
      } catch (e) {
        // Eat any step errors.  They have been thrown on the stack.
        if (e !== Interpreter.STEP_ERROR) {
          // Uh oh.  This is a real error in the JS-Interpreter.  Rethrow.
          throw e;
        }
      }
    } finally {
      // Restore to previous value (probably null, maybe nested toString calls).
      Interpreter.currentInterpreter_ = oldInterpreterValue;
    }
    if (nextState) {
      stack.push(nextState);
    }
    if (this.getterStep_) {
      // Getter from this step was not handled.
      throw Error('Getter not supported in this context');
    }
    if (this.setterStep_) {
      // Setter from this step was not handled.
      throw Error('Setter not supported in this context');
    }
    // This may be polyfill code.  Keep executing until we arrive at user code.
  } while (!node['end'] && endTime > Date.now());
  return true;
}
```

具体 string 执行的流程可以通过 `Interpreter.prototype.stepCallExpression` 方法来看下（因为 Js-interpreter 是使用 acorn 来做 parser，所以在 string excute 环节匹配 ast node 类型时是和 acorn ast node 的类型是保持一致的，即 stepXXX 方法）