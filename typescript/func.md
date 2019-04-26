## 函数


### 函数类型

函数的类型包含了2部分，第一部分为参数类型，第二部分为返回值的类型。因为在写函数的类型的时候，参数都是形参。第二部分为返回值的类型，必须要指定，如果这个函数没有返回值，那么需要指定返回类型为 void。

```javascript
let add: (a: number, b: number) => number

let myAdd: add = function (a: number, b: number) {
  return a + b
}
```