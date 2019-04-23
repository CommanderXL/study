## 泛型

泛型的翻译为 Generics，把这个单词放到一个没有上下文的语境里面，就显得比较抽象。如果换种说法: type paramter，类型参数就比较好理解了，即表示参数类型的一个参数。在TS中，泛型主要是在编译环节完成参数类型的固化及校验的工作，在代码编译完成后，剔除掉了相关的参数类型代码，保持和js代码的兼容。


### 几种泛型类型

#### 泛型类

#### 泛型接口

#### 泛型约束

虽然使用泛型允许我们可以创建能兼容多种数据类型的模块，但是在实际的使用过程中，不同的模块/函数等在代码编译环节，并不知道你最终在运行时使用的数据类型，所以在写相关代码的时候是需要通过一定的申明或者是约束条件去保证参数类型的合理。例如下面的例子：

```javascript
function logLength<T>(arg: T): T {
  console.log(arg.length)
  return arg
}
```

泛型函数`logLength`内部希望打印出参数`arg`的`length`属性，但是TS在编译环节并不知道这个参数的具体类型，因此最终会报错。这个时候可以通过泛型约束来申明这个参数必须包含`length`属性：

```javascript
interface ILengthWise {
  length: number
}

function logLength<T extends ILengthWise>(arg: T): T {
  console.log(arg.length)
  return arg
}
```

在这里通过一个接口对泛型参数做了约束，即必须拥有`length`属性。