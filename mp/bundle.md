## bundle 处理策略

对于编译型的小程序框架来说，不管上层使用的 dsl 是什么，最终产出的小程序文件形式都需要符合小程序的规范，即每个页面/组件都需要包含 js/wxml/wxss/json 四个文件内容。

对于基于 webpack 作为构建工具的 Mpx 而言，在处理 js bundle 的时候就需要格外注意。

1. 分包的 bundle.js 输出（splitChunksPlugin）

2. 分包的 js 代码如何和分包/主包 bundle 建立起关系