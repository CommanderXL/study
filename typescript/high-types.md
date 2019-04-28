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


### 映射类型