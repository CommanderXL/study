# 类型操作符

## & 操作符

交叉类型操作符。主要用于将多种类型合并为一个类型

```javascript
type TypeA = {
  ...
}

type TypeB = {
  ...
}

type TypeC = {
  ...
}

type A = TypeA & TypeB & TypeC
```

## keyof 操作符

用以获取一个类型的所有键值。最终得到的是一个联合类型的类型：

```javascript
type Person = {
  name: string,
  age: number
}

type TypeA = keyof Person // TypeA 的类型即为字符串字面量联合类型 'name' | 'age'

type TypeB = keyof any
// => string | number | symbol
```

再比如一个例子：

```javascript
const color = {
  red: 'red',
  blue: 'blue'
}

type Colors = keyof typeof color // 首先通过 typeof 类型操作符获取 color 变量的类型，然后通过 keyof 获取这个类型的所有键值，即字符串字面量联合类型 'red' | 'blue'
let color: Colors
color = 'red' // ok
color = 'blue' // ok
color = 'yellow' // Error 不能被赋值为 yellow
```

## typeof 操作符

用以获取**变量**的类型。因此**这个操作符的后面接的始终是一个变量，且需要运用到类型定义当中**。

```javascript
type TypeA = {
  name: string,
  age: number
}

let person: TypeA = {
  name: 'foo',
  age: 18
}

type TypeB = typeof person // 通过 typeof 类型操作符去获取变量 person 的类型
```

## in 操作符

主要用以申明索引签名。

```javascript
// 例1：
type Index = 'a' | 'b' | 'c' 
type FromIndex = { [K in Index]?: number }

const good: FromIndex = { b: 1, c: 2 } // OK
const bad: FromIndex = { b: 1, c: 2, d: 3 } // Error. 不能添加 d 属性


// 例2：
type FromSomeIndex<K extends string> = { [key in K]: number } // 在这里使用泛型限制了 K 的类型为 string，因此可以作为索引签名
```

再比如一些TS内置的映射类型当中：

```javascript
type Readonly<T> = {
  readonly [K in keyof T]: T[K] // 首先通过 keyof 操作符获取类型 T 上的字符串联合类型，然后通过 in 操作符遍历这个联合类型，并依次将联合类型当中每个值绑定到这个映射类型的属性上
}
```

## extends 操作符

类型继承操作符。

[extends和implements操作符之间的区别](https://stackoverflow.com/questions/38834625/whats-the-difference-between-extends-and-implements-in-typescript)

## ? 条件类型操作符

`U extends K ? X : Y` 如果类型 U 能赋值给类型 K，那么最终的类型为 X，否则为 Y。

例如几个内置的TS条件类型：

```javascript
type Exclude<T, U> = T extends U ? never: T

type Extract<T, U> = T extends U ? T : never

type NonNullable<T> = T extends null | undefined ? never : T
```

需要注意的是，如果待检查的类型 U 为联合类型，那么最终为衍变成分布式的条件类型，`U extends K ? X : Y`，其中类型 U 为联合类型：`A | B | C`，那么最终会被解析为`(A extends K ? X : Y) | (B extends K ? X : Y) | (C extends K ? X : Y)`例如：

```javascript
type BoxedValue<T> = { value: T }
type BoxedArray<T> = { array: T[] }
type Boxed<T> = T extends any[] ? BoxedArray<T[number]> : BoxedValue<T>

type b1 = Boxed<string> // BoxedValue<string>
type b2 = Boxed<number[]> // BoxedArray<number>
type b3 = Boxed<string | number[]> // BoxeValue<string> | BoxedArray<number>
```