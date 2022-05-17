# Tailwindcss

`Tailwindcss` 的定位应该是助力业务开发的一套 `css` 书写工具，框架本身提供了一套 `DSL` 语法。框架本身是作为一个 `postcss` 的 `plugin` 而被日常的使用。

整个的工作流是...

核心的思想：Utility-First

### 响应式设计

核心所要解决的问题还是不同屏幕尺寸下的样式问题。框架本身提供了5种 `breakpoints`，不过这里需要理解的一点是：`sm` 代表的不是在 `小屏幕手机` 上，而是在 `small breakpoint` 这个节点上。因为整个响应式工具都是基于 `min-width` 这个尺寸来进行设计的，而非 `max-width`，即 `sm` -> `@media (min-width: 640px) { ... }`

### 工具

主要是分为了以下的几大类：

1. Layout（布局）
2. FlexBox And Grid （弹性盒子和栅格）
3. Space（间距）
4. Sizing（尺寸）
5. TypoGraphy（）
6. Backgrounds（背景）
7. Borders（盒子边）
8. Effects（效果）
9. Filters（）
10. Tables（表格）
11. Transition And Animation（动画）
12. Transforms（转化）
13. Interactivity（交互）
14. SVG
15. Accessibility（可访问性）