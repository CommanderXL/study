## v-model的实现

`v-model`是`Vue`内部自己实现的一个指令。

// TODO: 总体的的概述
// 如何绑定/更新domProps
// 绑定原生的dom事件
// 和dom相关的attrs、domProps、原生的dom事件、style等，都是在将vnode渲染成真实的dom元素后，并关在到父dom节点后完成的。