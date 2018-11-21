## Observable

Observable 是 Mobx 暴露出来的核心对象之一。你可以直接调用这个方法将 Object/Array/Map 数据结构转化为响应式的数据。这个方法上也挂载了：

- Observable.object (将对象转化为响应式的数据)
- Observable.arrays (将数组转化为响应式的数据)
- Observable.maps (将 Map 转化为响应式的数据)
- Observable.box (将原始值类型转化为响应式的数据)

接下来我们就通过`Observable.object`方法来揭开 Mobx 响应式系统的面纱。

首先看一个关于这个方法使用的简单的例子：

```javascript
import { Observable } from 'mobx'

const obExample = Observable.object({
  name: 'John'
})

autoRun(() => {
  console.log(obExample.name)
})

obExample.name = 'Tom'
```

运行这段代码，首先会输出`John`，然后输出`Tom`。从 Api 命名上，可以猜想是代码运行后首先生成 obExample 这个响应式数据的实例，然后立即执行 autoRun 当中的回调函数，然后当 obExample 响应式数据发生变化的时候会再次执行 autoRun 当中的回调函数。

接下来我们看下这一系列的过程当中发生了什么事情。

```javascript
const observableFactories: IObservableFactories = {
  object<T = any>(
    props: T,
    decorators?: { [K in keyof T]: Function },
    options?: CreateObservableOptions
  ): T & IObservableObject {
    if (typeof arguments[1] === "string") incorrectlyUsedAsDecorator("object")
    const o = asCreateObservableOptions(options)
    if (o.proxy === false) {
      return extendObservable({}, props, decorators, o) as any
    } else {
      const defaultDecorator = getDefaultDecoratorFromObjectOptions(o)
      const base = extendObservable({}, undefined, undefined, o) as any
      const proxy = createDynamicObservableObject(base)
      extendObservableObjectWithProperties(proxy, props, decorators, defaultDecorator)
      return proxy
    }
  },
}
```

在上面提供的例子当中，我们使用 proxy 代理的模式。在这个方法内部需要注意 defaultDecorator，这个变量作为默认的装饰器会对我们传入的对象进行相应的处理(后文会讲到)，例子当中我们给`Observable.object`传入的 options 为 undefined，最终使用的 defaultDecorator 为 deepDecorator。extendObservable 方法主要是用于在传入的对象上添加 $mobx（Symbol("mobx administration")） 属性，其值为一个`ObservableObjectAdministration`对象(后文会讲到)的实例。这个过程进行完后，调用 createDynamicObservableObject 方法去创建一个 proxy 实例：

```javascript
export function createDynamicObservableObject(base) {
  const proxy = new Proxy(base, objectProxyTraps)
  base[$mobx].proxy = proxy
  return proxy
}
```

之后调用 extendObservableObjectWithProperties 方法去完成对 proxy 实例的改造，最终返回这个 proxy 实例。因此在我们提供的例子当中 obExample 即一个 proxy 实例。(看到这里我想大家心里应该大致有些感觉了，因为 ES6 提供的 proxy 功能可以说是非常强大了，它算是可以实现对于js元编程的一种能力)

接下来我们深入到 extendObservableObjectWithProperties 方法内部对于 proxy 实例做了哪些处理：

```javascript
export function extendObservableObjectWithProperties(
    target,
    properties,
    decorators,
    defaultDecorator
) {
    ...
    // 开启事务
    startBatch()
    try {
        for (let key in properties) {
            const descriptor = Object.getOwnPropertyDescriptor(properties, key)!
            ...
            const decorator =
                decorators && key in decorators
                    ? decorators[key]
                    : descriptor.get
                        ? computedDecorator
                        : defaultDecorator
            ...
            const resultDescriptor = decorator!(target, key, descriptor, true)
            if (
                resultDescriptor // otherwise, assume already applied, due to `applyToInstance`
            )
                Object.defineProperty(target, key, resultDescriptor)
        }
    } finally {
        // 结束事务
        endBatch()
    }
}

```

遍历传入的 properties 数据，调用 decorator 装饰器方法对 proxy 及 每个 key 做处理。之前我们也提到了 defaultDecorator 使用的是 deepDecorator，那么接下来我们看下 deepDecorator 做了哪些事情：


`src/api/observable.ts`:

```javascript
export const deepDecorator = createDecoratorForEnhancer(deepEnhancer)
```

`src/api/observabledecorator.ts`:

```javascript
export function createDecoratorForEnhancer(enhancer: IEnhancer<any>): IObservableDecorator {
    ...
    const decorator = createPropDecorator(
        true,
        (
            target: any,
            propertyName: string,
            descriptor: BabelDescriptor | undefined,
            _decoratorTarget,
            decoratorArgs: any[]
        ) => {
            ...

            const initialValue = descriptor
                ? descriptor.initializer
                    ? descriptor.initializer.call(target)
                    : descriptor.value
                : undefined
            asObservableObject(target).addObservableProp(propertyName, initialValue, enhancer)
        }
    )
    const res: any =
        // Extra process checks, as this happens during module initialization
        typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production"
            ? function observableDecorator() {
                  // This wrapper function is just to detect illegal decorator invocations, deprecate in a next version
                  // and simply return the created prop decorator
                  if (arguments.length < 2)
                      return fail(
                          "Incorrect decorator invocation. @observable decorator doesn't expect any arguments"
                      )
                  return decorator.apply(null, arguments)
              }
            : decorator
    res.enhancer = enhancer
    return res
}
```
