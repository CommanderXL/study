# Typescript 类型与值

## 类型

在 ts 的静态编译阶段可以当做类型使用的变量，有如下的声明的方式：

* 通过 type alias 进行的声明：`type sn = number | string`

* 通过 interface 进行的声明：`interface I { x: number[] }`

* 通过 class 进行的声明：`class C {}`

* 通过 enum 进行的声明：`enum E { A, B, C }`

* 通过 import 引用的 type 类型

以上这些声明形式都创建了一个新的**类型名称**

## 值

在 js 的 runtime 阶段可以被引用的变量。例如 `let x = 5`，就创建了一个值为5的变量 x，包含了如下的声明的方式：

* `let`、`const`、`var` 声明

* 包含了值的 `namspace` 或者 `module` 的声明

* `enum` 声明

* `class` 声明

* `import` 引用的值声明

* `function` 函数声明

## 一个变量名，多种含义

需要注意的是 class (`class C`)声明有2层含义：

1. 创建了类的实例的 interface 描述；

2. 类的构造函数 C (运行时使用，即可以使用 `new C()` 去创建对应的实例)


----

那么依据这个变量被声明和使用的形式，在 ts 的静态编译阶段和 js 的 runtime 阶段，这些变量所起的作用也不一样。

例一：

```javascript
class C {}

namespace C {
  export let x: number
}

let y = C.x // OK
```

这个例子就是作为值变量来进行使用的，因此可以被赋值给变量 y。

例二：

```javascript
class C {}

namespace C {
  export interface D {}
}

let y: C.D // OK
```

这个例子就是作为类型变量来使用的。

例三：

```javascript
namespace X {
  export interface Y {}
  export class Z {}
}

// ... elsewhere ...
namespace X {
  export var Y: number;
  export namespace Z {
    export class C {}
  }
}
type X = string;
```

这个例子就比较特殊了，它包含了如下的值变量、类型变量的声明：

在第一个 namespace X 的声明当中：

* 值变量X（因为 namespace 声明当中包含了值变量 Z 的声明）: `let x = X.Z`

* 类型变量X（因为 namespace 声明包含了类型变量 Y 的声明）：`let x: X.Y`

* 类型变量X 包含了类型变量 Y：`let x: X.Y`

* 类型变量X 包含了类型变量 Z(Z 作为 class 实例的 interface 描述)：`let x: X.Z`

* 值变量X 包含了值变量Z (Z 作为 constructor function of class)：`let x = X.Z`

在第二个 namespace X 的声明当中：

* 值变量 X 存在值变量 Y：`let x = X.Y`

* namespace 类型变量 X

* 值变量 X 存在值变量 Z：`let x = X.Z`

* 类型变量 C 属于 X.Z 的 namespace：`let x:X.Z.C`

* 值变量 X.Z 存在值变量 C：`let x = X.Z.C`

* 类型变量 X

这些所包含的声明形式也决定了这些类型、值变量最终的使用方式和场景。

### 相关文档 

* [deep-dive](https://www.typescriptlang.org/docs/handbook/declaration-files/deep-dive.html)

* [Types for classes as values in TypeScript](https://2ality.com/2020/04/classes-as-values-typescript.html)