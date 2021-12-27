## 主题样式系统

1. 基础定义
   
颜色，字号，字体排版，字重(font-weight)，圆角，间距

2. 主题

依赖基础定义抽象出来的主题风格

* 颜色（主色、副色、功能色）
* 字体排版（标题、副标题、文本、提示文案）

----

基础定义和主题之间的区别：是否做了二次抽象？


3. 组件变量

值的来源：主题风格(更多) or 基础定义(更少)

组件是依附于主题风格。结构样式等表现层的内容有一套上层的规范基础。主题风格都是基于这一套的规范基础搭建起来。

----

行为
maskClick
open/close  confirm/cancel

// 重载 or 单独实现对于 a, b 参数的处理函数
fn(a?, b?)

----

一些资料：

* [W3C web Accessibility](https://www.w3.org/WAI/standards-guidelines/wcag/)
* [Design Better](https://www.designbetter.co/)
* [more-meaningful-typograph](https://alistapart.com/article/more-meaningful-typography/)