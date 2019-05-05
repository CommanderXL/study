## 接口

需要注意在写 interface 时有关函数的类型定义：

```javascript
interface PersonalIntl {
  f1(): any

  f2 = () => any
}

class Person implements PersonalIntl {
  f1 () {   // 最终这个方法是挂在原型链上的
    console.log(this)
  }

  f2 () {   // 这个方法是挂在实例上的，this 始终和当前这个实例绑定在一起
    console.log(this)
  }
}
```
