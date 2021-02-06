* Namespaces are a TypeScript-specific way to organize code.Namespaces are simply named JavaScript objects in the global namespace. On the organization front, namespaces are handy for grouping together logically-related objects and types in the global scope. 

* Modules, on the other hand, are already present in a file system, necessarily. We have to resolve them by path and filename, so there’s a logical organization scheme for us to use. We can have a /collections/generic/ folder with a list module in it.


* We call declarations that don’t define an implementation “ambient”. Typically these are defined in .d.ts files. If you’re familiar with C/C++, you can think of these as .h files：

1. **ambient namespace**
2. **ambient module**