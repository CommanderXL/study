* [跟我一些写 Makefile](https://seisman.github.io/how-to-write-makefile/overview.html)

* `.so`: 动态链接共享库 shared libray (linux) | `dylib` (mac) | `dll` (windows)
* `.a`: 静态库，其实就是把若干个 o 目标文件打包 (linux) | `.lib` (mac)
* `.o`: object file（编译的目标文件）
* `.bt`: bitecode file
* `lo`: 使用libtool编译出的目标文件，其实就是在 o 目标文件中添加了一些信息
* `la`: 使用libtool编译出的库文件，其实是个文本文件，记录同名动态库和静态库的相关信息

Q：autoconf+automake 和 cmake 之间的区别？

-----

aclocal是一个perl 脚本程序，它的定义是：“aclocal - create aclocal.m4 by scanning configure.ac”。

autoconf 将 configure.ac (autoconf???) 生成 configure 脚本

automake 通过 Makefile.am 生成 Makefile.in 文件

configure.ac 配置文件用来描述 configure 需要做的事情；configure.ac 使用 m4sh 写，m4sh 是 m4 宏命令和 shell 脚本的组合。

Makefile.in （模板化的文件）、configure 根据系统参数去生成定制化的 Makefile

