## Webpack Loader 详解

前2篇文章主要通过源码分析了 loader 的配置，匹配和加载，执行等内容，这篇文章会通过具体的实例来学习下如何去实现一个 loader。

这里我们来看下 [vue-loader(v15)](https://vue-loader.vuejs.org/zh/#vue-loader-%E6%98%AF%E4%BB%80%E4%B9%88%EF%BC%9F) 内部的相关内容，这里会讲解下有关 vue-loader 的大致处理流程，不会深入特别细节的地方。首先我们都知道 vue-loader 配合 webpack 给我们开发 vue 应用提供了非常大的便利性，允许我们在 SFC(single file component) 中去写我们的 template/script/style，同时 v15 版本的 vue-loader 还允许开发在 sfc 当中写 custom block。最终一个 vue sfc 通过 vue-loader 的处理，会将 template/script/style/custom style 拆解为独立的 block，每个 block 还可以再交给对应的 loader 去做进一步的处理。因此可以说 vue-loader 对于 sfc 来说是一个入口。