* [跟我一些写 Makefile](https://seisman.github.io/how-to-write-makefile/overview.html)

* `.so`: shared libray (linux) | `dylib` (mac) | `dll` (windows)
* `.o`: object file
* `.bt`: bitecode file
* `.a`

Q：autoconf+automake 和 cmake 之间的区别？

-----

aclocal是一个perl 脚本程序，它的定义是：“aclocal - create aclocal.m4 by scanning configure.ac”。

autoconf 将 configure.ac (autoconf???) 生成 configure 脚本

automake 通过 Makefile.am 生成 Makefile.in 文件

configure.ac 配置文件用来描述 configure 需要做的事情；configure.ac 使用 m4sh 写，m4sh 是 m4 宏命令和 shell 脚本的组合。

Makefile.in （模板化的文件）、configure 根据系统参数去生成定制化的 Makefile

