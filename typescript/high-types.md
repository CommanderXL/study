## 高级类型

### 索引类型

索引类型即指在通过索引去访问对象时，这些索引所支持的类型种类。在TS当中索引类型仅支持: `string`、`number`、`symbols`三种类型。其中**动态属性名也被称作为索引签名**

例如：

```javascript
const foo: {
  [index: string]: { message: string } // 索引签名
} = {}

foo.a = {
  message: 'a'
}

foo.b = { // Error，不符合索引签名申明的结构
  messages: 'b'
}

let b: number
b = foo.a.message // Error，不能将 string 赋值给 number 类型
```

当你使用索引签名时，其他所有明确的索引也必须满足这些索引签名：

```javascript
interface Foo1 {
  [key: number]: number
  x: number
  y: number
}

interface Foo2 {
  [key: number]: number
  x: number
  y: string // Error，这个索引类型
}
```

和索引类型相关的还有**索引类型查询操作符**和**索引访问操作符**2个概念：

#### 索引类型查询操作符

它属于类型**语法**：keyof T，对于任意类型 T，使用索引类型查询操作符 keyof 后，返回的结果为这个类型上所有的公共属性名的联合。

```javascript
interface Person {
  name: string
  age: number
}

let person: keyof Person // keyof 获取 Person 接口为 'name' 和 'age' 的联合类型 'name' | 'age'，因此 person 最终的类型为字符串字面量 'name' | 'age'
```

#### 索引访问操作符

它属于**类型语法**。通过一个例子来看下这个索引访问操作符的具体使用：

```javascript
function pluck<T, K extends keyof T>(o: T, names: K[]): T[K][] {
  return names.map(name => o[name])
}

interface Person {
  name: string
  age: number
}

let person: Person = {
  name: 'foo',
  age: '20'
}

let strings: string[] = pluck(person, ['name'])
```


### 映射类型

