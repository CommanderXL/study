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


1. del 函数接受 number 类型的参数，不写这个函数的返回类型的时候，那么TS会自己推荐返回的数据类型也为 number:

```javascript
function del(a: number, b: number) {
  return a - b
}
```

2. 有时候我们通过赋值去定义一个函数：

```javascript
let del = function(a: number, b: number) {
  return a - b
}

// 一个完整的函数类型定义应该是：
let del: (a1: number, a2: number) => number = function(a: number, b: number): number {
  return a - b
}
```

再例如，我们先定义这个函数类型，然后通过 myDel 添加类型注解，就算在函数定义的时候没有给参数/返回值添加类型注解，那么TS也会根据函数类型去推断相关的参数/返回值的类型。

```javascript
let Del: (a1: number, a2: number) => number
// 或者通过类型别名
type Del = (a1: number, a2: number) => number

let myDel: Del = function(a, b) {
  return a - b
}
```

在一些宿主环境提供的方法或者对象上进行类型推断（这些方法或者对象是有内置的类型注解的），例如：

```javascript
window.onmousedown = function(mouseEvent) {
  console.log(mouseEvent.button)
  console.log(mouseEvent.kangaroo) // 报错
}
```

TS会根据 window.onmousedown 这个函数的类型自动推断出赋值的函数所接受的参数类型，这里 mouseEvent 参数上是包含 button 属性的，但是不包含 kangaroo 属性的，因此在编译阶段会报错。

在这里举的宿主环境提供的方法有类型推断的例子和上面一个先定义函数类型，然后通过添加函数类型的例子是一样的，这种类型的推断的方式也被称为“上下文归类”。


https://jkchao.github.io/typescript-book-chinese/typings/typeInference.html#%E8%B5%8B%E5%80%BC 示例
https://juejin.im/post/5bc6b7a25188255c9e0300fa 类型推断技巧
