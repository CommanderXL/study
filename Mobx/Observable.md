## Observable

Observable 是 Mobx 暴露出来的核心对象之一。你可以直接调用这个方法将 Object/Array/Map 数据结构转化为响应式的数据。这个方法上也挂载了：

* Observable.object (将对象转化为相应式的数据)
* Observable.arrays (将数组转化为响应式的数据)
* Observable.maps (将Map转化为响应式的数据)
* Observable.box (将原始值类型转化为响应式的数据)

接下来我们就通过 Obserable.object 方法来揭开 Mobx 响应式系统的面纱。