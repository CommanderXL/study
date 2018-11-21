## Observable

Observable 是 Mobx 暴露出来的核心对象之一。你可以直接调用这个方法将 Object/Array/Map 数据结构转化为响应式的数据。这个方法上也挂载了：

* Observable.object (将对象转化为响应式的数据)
* Observable.arrays (将数组转化为响应式的数据)
* Observable.maps (将Map转化为响应式的数据)
* Observable.box (将原始值类型转化为响应式的数据)

接下来我们就通过`Observable.object`方法来揭开 Mobx 响应式系统的面纱。

首先看一个关于这个方法使用的简单的例子：

```javascript
import { Observable } from 'mobx'

const observable = Observable.object({
  name: 'John'
})

autoRun(() => {
  console.log(observable.name)
})

observable.name = 'Tom'
```

运行这段代码，首先会输出`John`，然后输出`Tom`。从 Api 命名上，可以猜想是代码运行后首先生成 observable 这个响应式数据的实例，然后立即执行 autoRun 当中的回调函数，然后当 observable 响应式数据发生变化的时候会再次执行 autoRun 当中的回调函数。