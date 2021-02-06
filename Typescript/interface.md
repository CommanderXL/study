## 接口

接口可以被类（class）去实现（implement），同时也可用于对对象的描述。

```javascript
interface Person {
  name: string
  age?: number
}

// 用于对对象的描述
let tom: Person = {
  name: 'Tom',
  age: 25
}
```

需要注意在写 interface 时有关函数的类型定义：

```javascript
interface PersonalIntl {
  f1(): any

  f2 = () => any
}

// 接口被类（class）所实现（implement）
class Person implements PersonalIntl {
  f1 () {   // 最终这个方法是挂在原型链上的
    console.log(this)
  }

  f2 () {   // 这个方法是挂在实例上的，this 始终和当前这个实例绑定在一起
    console.log(this)
  }
}
```


1. However, TypeScript takes the stance that there’s probably a bug in this code. Object literals get special treatment and undergo excess property checking when assigning them to other variables, or passing them as arguments. If an object literal has any properties that the “target type” doesn’t have, you’ll get an error:


有一些内部隐式的类型检查策略: https://www.typescriptlang.org/docs/handbook/interfaces.html#excess-property-checks