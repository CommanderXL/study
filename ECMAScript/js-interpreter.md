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

3. object 对象构造函数，vm 当中所有的 Object 类型数据都是基于这个构造函数来实例化的。在 vm 当中定义的 object 类型数据 pseudo：

```javascript
Interpreter.Object = function(proto) {
  this.getter = Object.create(null)
  this.setter = Object.create(null)
  this.properties = Object.create(null)
  this.proto = proto
}
```

4. 初始化内置的构造函数，例如 `Array`:

```javascript
Interpreter.prototype.initArray = function(globalObject) {
  var thisInterpreter = this
  var wrapper
  // Array constructor
  wrapper = function Array(var_args) {
    if (thisInterpreter.calledWithNew()) { // 在代码解析执行阶段，获取通过数据共享获取当前执行方法
      // Called as `new Array()`
      var newArray = this
    } else {
      // Called as `Array()`
      var newArray = thisInterpreter.createArray()
    }
    var first = arguments[0]
    if (isNaN(Interpreter.legalArrayLength(first))) {
        thisInterpreter.throwException(thisInterpreter.RANGE_ERROR,
                                       'Invalid array length');
      }
      newArray.properties.length = first;
    else {
      for (var i = 0; i < arguments.length; i++) {
        newArray.properties[i] = arguments[i];
      }
      newArray.properties.length = i;
    }
  }
  this.ARRAY = this.createNativeFunction(wrapper, true) // 创建一个在宿主环境调用的函数 -> Array 构造函数
  this.ARRAY_PROTO = this.ARRAY.properties['prototype'] // 设置原型属性
  this.setProperty(globalObject, 'Array', this.ARRAY, Interpreter.NONENUMERABLE_DESCRIPTOR)

  wrapper = function isArray(obj) {
    return obj && obj.class === 'Array'
  }
  this.setProperty(this.ARRAY, 'isArray',
                   this.createNativeFunction(wrapper, false),
                   Interpreter.NONENUMERABLE_DESCRIPTOR);

  // Instance methods on Array.
  this.setProperty(this.ARRAY_PROTO, 'length', 0,
      {configurable: false, enumerable: false, writable: true});
  this.ARRAY_PROTO.class = 'Array';
  
  // 添加数组上的原型方法，例如 push、pop、shift 等等
  this.polyfills_.push(
    ...
  )
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

具体 string 执行的流程可以通过 `Interpreter.prototype.stepCallExpression` 方法来看下（因为 Js-interpreter 是使用 acorn 来做 parser，所以在 string excute 环节匹配 ast node 类型时是和 acorn ast node 的类型是保持一致的，即 stepXXX 方法）。

这个是 ArrayExpression 的解析执行：

```javascript
Interpreter.prototype.stepArrayExpression = function(stack, state, node) {
  var elements = node['elements']; // 获取数组所有的元素
  var n = state.n_ || 0; // 可以理解为当前处理的元素的索引
  if (!state.array_) {
    state.array_ = this.createArray(); // 这个 arrayExpression 最终执行完的值，createArray 实例化一个 array
    state.array_.properties.length = elements.length;
  } else {
    this.setProperty(state.array_, n, state.value);
    n++;
  }
  while (n < elements.length) { // 遍历数组开始解析执行每个元素
    // Skip missing elements - they're not defined, not undefined.
    if (elements[n]) {
      state.n_ = n; 
      return new Interpreter.State(elements[n], state.scope); // 构建一个新的 state 
    }
    n++;
  }
  stack.pop(); // 当所有的 elements 都解析执行完之后，将当前这个 ArrayExpression 推出栈，同时更新栈内最后一个 state.value 的值，其实就是对应到数组真实计算出来的值
  stack[stack.length - 1].value = state.array_;
}
```

vm 和宿主的交互：

1. `createNativeFunction` 创建一个对于宿主函数的引用(`nativeFunc`)。这个函数内部创建一个代理函数 func，最终在 vm 执行函数的过程中，都是通过访问 `func.nativeFunc` 来完成宿主函数的调用的：

```javascript
Interpreter.prototype.createNativeFunction = function(nativeFunc, isConstructor) {
  var func = this.createFunctionBase_(nativeFunc.length, isConstructor)
  func.nativeFunc = nativeFunc
  nativeFunc.id = this.functionCounter_++
  this.setProperty(func, 'name', nativeFunc.name, Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR)
  return func
}

Interpreter.prototype.createFunctionBase_ = function(argumentLength, isConstructor) {
  var func = this.createObjectProto(this.FUNCTION_PROTO) // 以 FUNCTION_PROTO 为原型创建一个函数实例
  if (isConstructor) { // 如果这个函数需要被当做构造函数来使用，那么需要建立起和 Object 之间的原型链关系，所以这里通过 OBJECT_PROTO 实例化一个 object 实例，同时设置 func.prototype = object，这样便建立起了 Function 和 Object 之间的继承关系，同时给这个函数设置 constructor 构造函数属性
    var proto = this.createObjectProto(this.OBJECT_PROTO)
    this.setProperty(func, 'prototype', proto, Interpreter.NONENUMERABLE_DESCRIPTOR)
    this.setProperty(func, 'constructor', func, Interpreter.NONENUMERABLE_DESCRIPTOR)
  } else {
    func.illegalConstructor = true
  }
  // 函数接受参数的个数
  this.setProperty(func, 'length', argumentLength, Interpreter.READONLY_NONENUMERABLE_DESCRIPTOR)
  func.class = 'Function'
  return func
}
```

2. `nativeToPseudo`: Converts from a native JavaScript object or value to a JS-Interpreter object.Can handle JSON-style values, regular expressions, dates and functions。主要是完成宿主当中的数据向 vm 转化，使得其在 vm 当中能被正常的使用。

```javascript
Interpreter.prototype.nativeToPseudo = function() {

}
```

3. `PseudoToNative`: Converts from a JS-Interpreter object to native JavaScript object.Can handle JSON-style values, regular expressions, and dates.Does handle cycles. 将原本在 vm 当中使用的数据通过这个方法完成转化，使得可以在宿主环境当中使用。

```javascript
Interpreter.prototype.pseudoToNative = function() {

}
```