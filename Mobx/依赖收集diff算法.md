## Mobx 响应式数据依赖收集的diff算法

在 Mobx 响应式数据进行依赖收集的过程中，例如：

```javascript
import { Observable, autoRun } from 'mobx'

const obExample = Observable.object({
  name: 'John'
})

autoRun(() => {
  console.log(obExample.name)
})

obExample.name = 'Tom'
```

`autoRun`方法执行 reaction 的过程中完成相关依赖的收集工作，对应于源码当中`src/core/derivation.ts`当中的`bindDependencies`方法。我们来看下整个收集的过程是如何进行的。