## 类型推论

在TS编译代码的环节当中，是以类型系统为基础的，即你定义一个变量，一个函数，这个函数接收的参数类型，返回值类型等等在编译环节都是有具体类型的。当然在你写代码的环节当中，可能并没有指定具体的类型，但是在实际的编译环节TS有一套有关类型推断的规则。例如，定义一个变量：

```javascript
let foo = 3
```

你定义这个变量的时候，并没有直接标识这个变量的具体使用类型(number)：

```javascript
let foo: number = 3
```

在编译环节TS便会默认将`foo`的类型定义为 number。如果要对这个变量再次进行赋值的话，就必须是 number 类型的值，否则编译环节就会报错。这种推断发生在初始化变量和成员，设置默认参数值和决定参数返回值时。

接下来我们就看下TS当中其他类型推论的例子。

https://jkchao.github.io/typescript-book-chinese/typings/typeInference.html#%E8%B5%8B%E5%80%BC 示例
https://juejin.im/post/5bc6b7a25188255c9e0300fa 类型推断技巧
