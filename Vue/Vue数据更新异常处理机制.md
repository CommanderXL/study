## Vue数据更新异常处理机制

Vue 数据根据异常处理机制主要是聊下关于 Vue 对于 Object 类型的响应式数据添加属性，以及对于 Array 类型数据变更的监测。由于Vue 是使用 Object.defineProperty 来做数据劫持，当被劫持的 key 所对应的 value 为基本类型时，那么每次对这个 key 的 value 做修改的时候，都会调用这个 key 所定义的 setter 函数，这样也就能触发相关的订阅者的更新。但是如果 key 所对应的 value 为引用类型，例如 plain object，这个时候如果你直接改变了引用类型的地址，那么会触发 key 对应的 setter 函数，使得相关的订阅者进行更新。但是如果你对 plain object 进行 增加/删除 属性的操作的话，这个时候是无法触发 key 所对应的 setter 函数的，那么也就无法更新相关的 watcher。
