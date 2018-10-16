## Vue数据更新异常处理机制

Vue 数据根据异常处理机制主要是聊下关于 Vue 对于 Object 类型的响应式数据添加属性，以及对于 Array 类型数据变更的监测。由于Vue 是使用 Object.defineProperty 来做数据劫持，当被劫持的 key 所对应的 value 为基本类型时，那么每次对这个 key 的 value 做修改的时候，都会调用这个 key 所定义的 setter 函数，这样也就能触发相关的订阅者的更新。但是如果 key 所对应的 value 为引用类型，例如 plain object，这个时候如果你直接改变了引用类型的地址，那么会触发 key 对应的 setter 函数，使得相关的订阅者进行更新。但是如果你对 plain object 进行 增加/删除 属性的操作的话，这个时候是无法触发 key 所对应的 setter 函数的，那么也就无法更新相关的 watcher。如果遇到这种场景的话，那应该怎么处理呢？

Vue 提供了全局 Vue.set/Vue.del 和实例上的 vm.$set/vm.$del 方法去完成 plain object 属性的添加和删除：

```javascript
function set (target, key, val) {
  if ("development" !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(("Cannot set reactive property on undefined, null, or primitive value: " + ((target))));
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key);
    target.splice(key, 1, val);
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val;
    return val
  }
  var ob = (target).__ob__;
  if (target._isVue || (ob && ob.vmCount)) {
    "development" !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    );
    return val
  }
  if (!ob) {
    target[key] = val;
    return val
  }
  defineReactive(ob.value, key, val);
  ob.dep.notify();
  return val
}
```

```javascript
<template>
  <p>{{ obj.a }}</p>
  <p>{{ obj.b }}</p>
</template>

<script>
  export default {
    data () {
      return {
        obj: {
          a: 'text'
        }
      }
    },
    created () {
      setTimeout(() => {
        this.obj.b = 'textttt'
      }, 1000)
    }
  }
</script>
```

页面渲染出来后，`obj.b`的文本内容是无法显示出来的，具体的原因我上面也说了，这时如果在定时器内部调用：

```javascript
this.$set(this.obj, b, 'textttt')
```

那么1s后，页面可以渲染出 `obj.b` 的内容。这是因为在 set 方法内部，首先会获取 `(target).__ob__` 属性，即这个 key 所对应的 plain object 的 observer 观察者，通过 `defineReactive(ob.value, key, val)`方法，将新传入的值变更为响应式的数据后调用 ob.dep.notify() 方法去遍历所有收集起来的观察者(watcher)，并触发观察者的更新，如果这个 watcher 是 render watcher，那么就能完成视图的更新。那么在这个组件的生命周期中，这个 key 所对应的 observer 是在什么时候收集到 render watcher 的呢？

```javascript
function defineReactive (
  obj,
  key,
  val,
  customSetter,
  shallow
) {
  var dep = new Dep();    // 每一个 key 所对应的 dep 依赖

  ...

  // 递归的去将 object 的深层次数据变成响应式数据
  var childOb = !shallow && observe(val);   // 获取 key 对应的 value 值(如果是 object 类型，那么会返回一个对应的 observer)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      var value = getter ? getter.call(obj) : val;
      if (Dep.target) {
        dep.depend();
        if (childOb) {    // 如果 key 对应的 value(如果是 object)的 observe，即将当前的 watcher 加入到这个 value 的依赖当中
          childOb.dep.depend();
          if (Array.isArray(value)) {
            dependArray(value);
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      ...
    }
  });
}
```

事实上在组件初始化的 initData 阶段，将 data 变成响应式数据的过程中，对应到本实例就是将 obj 的值(`{ a: 'text' }`)变成响应式的过程中，首先获取 obj 的值(为 plain object)的 observer 观察者实例，然后形成一个闭包。当组件实例化进入 $mount 阶段将 VNode 转化为真实的 dom 时，会调用 obj 的 getter 函数，这个时候首先完成 obj 的依赖的添加，将 render watcher 添加到 obj 的 dep 数组当中，同时因为 obj 的值的 observer 存在，那么同时将这个 render watcher 添加到 observer 的 dep 依赖当中。这样就完成了依赖的收集，那么在实际使用过程中调用实例的 this.$set 方法去给 obj 添加属性，在这个方法内部会获取 obj 的值(`{ a: 'text' }`)的 `__ob__` 属性，即 `{ a: 'text' }` 的 observer，同时在 set 方法内部最终会调用 `ob.dep.notify()` 方法去通知所有 watcher 去完成更新。如果你要删除一个响应式数据上的 key，那么需要调用 `Vue.del/vm.$del` 方法去完成，相关的内容大家可以阅读对应的源码。

以上是 plain object 在数据更新时需要注意的情况。另外还需要注意的就是当你的响应式数据类型为数组的时候，如何正确的去处理数组项的变更，同时去完成页面的渲染。我们首先来看个例子：

```javascript

```