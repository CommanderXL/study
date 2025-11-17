## Mpx2Rn 异步分包


在 Mpx2RN 整个链路当中，涉及两个编译构建流程：

* mpx app -> webpack -> js bundle
* js bundle -> metro -> HBC

在 Mpx2RN 的场景下是**以微信小程序的异步分包为规范在 RN 平台下完成同等能力的实现**，具体体现在：

* wx.onLazyLoad

等。

在实际进入到 Mpx2RN 分包能力分享之前，先简单聊下 Mpx 在跨其他平台的场景当中是如何去实现异步分包的能力。从平台视角来看主要是分为小程序平台（wx/ali/tt 等），web 以及 RN。在小程序的平台场景下，由平台提供异步分包的底层的能力(编译+运行时)，对于上层的小程序应用来说完全是黑盒的，Mpx 在跨小程序平台的场景下只需要保证最终的代码符合分包输出规范，再交由不同的宿主小程序平台去完成最终的分包代码的编译构建和输出。

但是对于 Mpx2Web 的场景来说，宿主是浏览器，浏览器提供了动态插入 script 标签异步加载并执行 js 代码的能力。那么 Mpx2Web 的场景下...

再回到 Mpx2RN 的场景，宿主是 RN...



* 非常有技术复杂度的一个项目
* 问题分析(mpx、rn、微信平台能力设计)
  * 微信平台能力标准的解读
  * webpack 的能力
  * mpx2rn 的差异
  * react 相关的能力
  * 和容器如何交互（RN 提供了 lazy api）
  * 当前的编译构建过程（webpack -> metro）
* 技术架构设计
  * 分包策略 - 和小程序的异同（async-common 等）
  * 编译 -> mpx compile -> webpack split chunk
  * 运行时 -> webpackRuntimeModule
* mpx2rn（mpx & drn 交互）
* 一些问题（ExternalModule）
  * ExternalModule
  * RetryModule