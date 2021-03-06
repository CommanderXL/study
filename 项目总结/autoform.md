最近做了几个和表单类相关的项目，这篇文章算是一个是对配置化表单、页面的一些阶段性总结与思考。谈到配置化，各大厂应该都有自己内部开发的可视化的页面配置化平台，这些配置平台给使用人员提供一系列的配置化选项以快速完成一个页面的搭建。这些配置化的选项是对于页面的某个结构、组件等部件做的一层描述，配置人员仅仅需要了解这层描述能决定最终生成页面的样子即可快速完成页面的搭建，这样开发效率有了很大的提升、样式规范和交互流程方面也能保证统一。像这种从可视化的配置平台直出页面的方式可以简单的抽象为：

页面 -> 数据 -> 页面

的形式。然后这篇文章当中主要探讨的是从：

数据 -> 页面

这样的一个工作流程。简单点说就是通过一份自己定义设计好的组件(页面)描述配置去生成最终表单组件(页面)。那么这个描述配置如何去编写完全取决于这些表单组件是如何设计的。所以接下来先看下配置化表单组件设计相关的内容。

## 表单组件设计

### 表单组件的分类

从功能上来说一共有三类：

* 渲染容器根组件
* 布局容器组件
* 业务组件

这三种组件之间的逻辑关系可用如下的图来表示：


#### 业务组件

业务组件一般是以功能为最小核心单元的组件。对应到本文当中所谈到的表单业务组件的话，基本包含了2部分：

* 表单的标题组件
* 表单的交互组件

例如：


常用的表单交互组件有：input / picker / actionsheet / radio / image-upload 等等。在做配置化方案的时候，这些组件应该都是单独开发，单独维护，最终表单配置化单元的渲染工作也就是依据表单配置项完成这些基础的业务组件的渲染工作的。


#### 布局容器组件

在移动端我们常规的阅读习惯是从上至下，因此在表单配置单元内部的每个业务组件大多也是由上至下的排列顺序，当然部分场景还是可能会出现横向排列的情况。因此布局容器组件就是为了满足多样的表单配置单元的样式布局，实现表单组件的嵌套等相关的需求，布局容器组件不承载业务逻辑，而是完成包含于布局容器组件内部其他业务组件的渲染工作。

例如：



#### 渲染容器根组件

渲染容器根组件可理解为一个表单配置单元，每个表单配置单元即通过这个渲染容器去完成渲染工作，一个页面可包含多个表单配置单元。

```html
<template>
  <div class="form-page">
    <vue-auto-form :uiSchema="uiSchema1"></vue-auto-form>
    <vue-auto-form :uiSchema="uiSchema2"></vue-auto-form>
    <vue-auto-form :uiSchema="uiSchema3"></vue-auto-form>
  </div>
</template>
```

```javascript
export default {
  data() {
    return {
      uiSchema1: {},
      uiSchema2: {},
      uiSchema3: {}
    }
  }
}
```

这个渲染容器根组件实际上就是一个 render 函数，render 函数根据你所传入的表单组件的配置选项来实现表单配置单元的动态渲染。

### 表单描述文件

上面谈到了有关组件的分类以及设计，那么对应的表单描述文件也应该依托于此，因为表单描述文件就是表单组件的代码表达。就拿我所做的表单项目来说，设计同学给我定义好了表单类型的基础规范：

TODO: 补图

根据表单设计规范，我需要将表单设计稿转化为表单描述配置。我将每个表单配置单元拆解为2部分：

* 表头
* 表单操作项

每个表单配置单元包含一个表头，多个表单操作项。这样也有了一个初步的表单配置描述：

```javascript
export default {
  data() {
    return {
      formData: {
        name: '',
        highestEdu: 0
      },
      uiSchema: {
        uiHeader: {                            // 表头
          title: '身份证',                      // 标题
          text: '前往拍摄',                     // 操作区文案(可选)
          eventHandler: {                      // 操作区事件响应(可选)
            click() {
              // do something
            }
          }
        },
        uiItems: [                             // 表单操作项
          { 
            key: 'name',                       // 操作项对应字段
            title: '姓名',                      // 操作项标题
            widget: 'vue-autoform-input',      // 操作项使用的组件名
            widgetOption: {},                  // 每个组件的配置项
            eventHandler: {},                  // 事件处理
            disabled: false,                   // 是否禁用
            visiable: true,                    // 是否可见
            errMsg: '',                        // 错误文案
            className: '',                     // 拓展的 className
            children: []                       // 嵌套子组件
          },
          { 
            key: 'highestEdu',
            title: '最高学历',
            widget: 'vue-autoform-picker',
            widgetOption: {},
            eventHandler: {},
            disabled: false,
            visiable: true,
            errMsg: '',
            className: '',
            children: []
          }
        ]
      }
    }
  }
}
```

### 表单组件的通讯

表单组件的通讯仍然遵照 props / event 的形式进行。每个表单配置单元对外暴露了2个基础的 props：

* formData(使用`.sync`修饰符进行数据的双向绑定)
* uiSchema

其中 formData 属性包含了这个表单配置单元里面所有的表单字段，表单字段相关的数据变化都体现在 formData 当中，uiSchema 是对表单配置单元的描述。

```html
<template>
  <vue-autoform :formData.sync="formData" :uiSchema="uiSchema"></vue-autoform>
</template>
```

```javascript
export default {
  data() {
    return {
      formData: {},
      uiSchema: {}
    }
  }
}
```

### 表单组件的API

## 表单组件的拓展机制

在使用表单组件这块提供了注册的机制去拓展相关的插件

## 表单与表单之间的联动














我想大家在平时的业务过程中也会遇到这种从设计，交互，业务流程比较趋同的组件、页面，这个时候我们希望从开发工作效率、样式规范、交互流程等方面做一定程度的统一。这个时候就需要发挥你自己的主观能动性去推动PM、UX等相关的同学去拉齐相关的规范意见。



设计的流程：

页面 -> 数据 -> 页面


组件分类(从功能上)：

1. 渲染容器根组件(配置单元)
2. 布局容器组件
3. 业务组件

组件通讯：

1. 配置单元及配置单元通讯
2. 配置单元内部父子组件，及多层级父子组件通讯

一个配置化单元，使用一个渲染容器根组件去承载，