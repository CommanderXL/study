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

那么1s后，页面可以渲染出 `obj.b` 的内容。这是因为在 set 方法内部，首先会获取 `(target).__ob__` 属性，即这个 key 所对应的 plain object 的 observer 观察者，通过 `defineReactive(ob.value, key, val)`方法，将新传入的值变更为响应式的数据后调用 ob.dep.notify() 方法去遍历所有收集起来的观察者(watcher)，并触发观察者的更新，如果这个 watcher 是 render watcher，那么就能完成视图的更新。