## 声明文件

声明文件即存放你声明的地方，声明包括命名空间、类型及值这三类。

在我们使用TS进行项目开发的时候会定义各种类型、变量、函数、对象等内容。这些内容有可能仅仅是作为项目内部来用，但是当你的项目是作为其他TS项目的依赖来使用的话，其他项目需要引用你的项目并调用相关模块或者方法进行开发。但是这些项目却不能很好的利用你内部的类型来做类型检查，所以你需要做的一项工作就是将相关的类型、变量、函数等给暴露出来，让其他项目在编译TS代码的时候，使用相关的类型去更好的做类型检查。简单点理解就是别人的TS项目在使用你所提供的TS项目时，别人的项目如果想做类型检查，那么就需要在你的项目当中通过声明文件将相关类型暴露出去。这就是声明文件最终的作用。

声明文件以`.d.ts`的后缀结尾。 

### 全局声明 vs 模块声明

如果某个文件遵循 ES Module/CommonJS/AMD 等模块书写规范的声明文件即为模块声明。如果这个文件没有出现相关模块规范的书写形式，而是仅仅有顶级的声明语句，那么这个文件即为全局声明文件。

全局声明文件里面的声明可以在其他任意的TS文件当中进行使用，而不用单独的导入。而模块声明如果需要被其他模块文件使用的话就需要进行相关的导入操作了。

### TS编译器寻找声明文件路径

当你使用 npm 包的形式去引入模块。

```javascript
import foo from 'foo'
```

* `node_modules/@types/foo`
* `node_modules/foo/index.d.ts`
* `node_modules/foo/package.json` 当中定义的`typing`或者`types`2个字段中的一个
* `node_modules/foo/package.josn` 当中定义的`main`入口文件相同文件名的声明文件，例如`index.js / index.d.ts`，如果`typings`或者`types`存在的话，是不会去找`main`入口当中同文件名的声明文件的


此外，如果这个 npm 包没有提供声明文件，那么这个时候就需要自己去写声明文件。推荐大家在自己项目目录里面单独建一个`types`文件夹来存放相关的声明文件。但是依据上面的规则，TS是没法找到我们给这个 npm 包书写的声明文件的。所以需要通过`tsconfig.json`文件进行指定：

```javascript
{
  "compilerOptions": {
    "baseUrl": "./",  // 解析的基础目录
    "paths": {
      "*": ["types/*"]
    }
  }
}
```

通过这样的配置后(具体有关`baseUrl`和`paths`字段的配置请参考[文档](https://www.tslang.cn/docs/handbook/module-resolution.html#path-mapping))，`foo`模块的声明文件除了会去`node_modules`目录下找，还会去当前项目的`types/foo`目录下去找：

```javascript
projectRoot
├── src
│   └── index.ts
├── types
│   └── foo
│       └── index.d.ts
└── tsconfig.json
```

### 发布方式

1. 将声明文件随着 npm 包一起发布；
2. 将声明文件发布到 @types organization 下面

### 相关语法

* `declare` 关键字

这个关键字就是告诉TS的编译系统，在这里我声明了一个类型、变量等内容，非常的语义化。它可以使用到TS的 runtime 代码当中：

```javascript
// index.ts
declare class Foo {
  constructor() {}
}

const foo = new Foo()
```

最终`declare`关键字不会输出到编译后的文件当中的。在这里你不使用`declare`关键字也是没有问题的。

当然你也可以在声明文件当中使用`declare`关键字：

```javascript
declare namespace Memo {
  export class M {
    constructor(str: string)
  }
}
```

在声明文件当中还是推荐使用`declare`关键字，这样语义化更好，也更加清晰。

* `import xxx = require('...')`

在网上找了一圈有关这个语法的说明，说是遵循 CommonJs 规范的 npm 包在书写声明文件的时候需要使用`export =` 这个语法去完成声明的导出。然后在你的业务代码中，如果需要引入这个 npm 包，就需要使用`import xxx = require('...')`这种TS独创的语法。

但是在我实际写代码的过程中（TS版本为3.x）发现，就算是遵循 CommonJs 规范的 npm 包，在书写声明文件的时候也是可以不用`export =`这种语法的，而可以使用 Es Module 的导出语法`export`，同时你的业务代码引入这个 npm 包的时候，也可以直接使用 Es Module 的导入语法`import xxx from 'xxx'`，TS编译器也会加载对应的声明文件来完成类型检查。

有关这个问题我也查阅了相关的资料，都是指出 CommonJs 规范的模块在写声明文件的时候需要使用`export =`这样的语法来完成：

https://stackoverflow.com/questions/35706164/typescript-import-as-vs-import-require
https://github.com/Microsoft/TypeScript/issues/7185
https://tasaid.com/blog/2019022017450863.html
https://tasaid.com/blog/20171102225101.html#import-dao-ru-he-export-dao-chu

TODO: ts-node repl

* `export as namespace xxx`

这个语法主要是为了解决一些库即可以通过模块的形式去引入，也可以通过`<script>`标签的形式全局引入(一般这些库的设计都是定义一个独有的全局变量，通过对这个全局变量进行拓展)，即被称为`UMD`库。当你通过`<script>`标签这种形式引入的话，那么就需要一个声明文件进行一个全局的声明。为了解决这个问题，TS提供了`export as namespace`这个语法，可以将这个 namespace 名声明为全局的，其内部声明的其他的类型、函数、变量等都为这个 namespace 的子属性。

具体有关内容可参见[文档](https://www.typescriptlang.org/docs/handbook/modules.html#umd-modules)
