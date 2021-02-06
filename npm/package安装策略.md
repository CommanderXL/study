* Doc: https://docs.npmjs.com/configuring-npm/folders.html

* npm 工程化实践: https://juejin.cn/post/6914508615969669127

* Phantom Dependency

在项目当中显示声明安装了依赖 A，依赖 A 本身会依赖 B 和 C，但是在项目当中并没有显示声明安装 B 和 C。最终还是在项目当中可以直接引入 B 和 C，B 和 C 这2个依赖就被称为 `Phantom Dependency`。