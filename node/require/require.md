## Require源码粗读

最近一直在用node.js写一些相关的工具，对于node.js的模块如何去加载，以及所遵循的模块加载规范的具体细节又是如何并不是了解。这篇文件也是看过node.js源码及部分文章总结而来：

在es2015标准以前，js并没有成熟的模块系统的规范。Node.js为了弥补这样一个缺陷，采用了CommonJS规范中所定义的[**模块规范**](http://wiki.commonjs.org/wiki/Modules/1.1.1)，它包括：

1.require

`require`是一个函数，它接收一个模块的标识符，用以引用其他模块暴露出来的`API`。

2.module context

`module context`规定了一个模块当中，存在一个require变量，它遵从上面对于这个`require`函数的定义，一个`exports`对象，模块如果需要向外暴露API，即在一个`exports`的对象上添加属性。以及一个`module object`。

3.module Identifiers

`module Identifiers`定义了`require`函数所接受的参数规则，比如说必须是小驼峰命名的字符串，可以没有文件后缀名，`.`或者`..`表明文件路径是相对路径等等。

具体关于`commonJS`中定义的`module`规范，可以参见[wiki文档](http://wiki.commonjs.org/wiki/Modules/1.1.1)
