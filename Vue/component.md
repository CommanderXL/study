## Vue组件系统简析

Vue version: 2.5.16

`Vue`的组件系统是`Vue`最为核心的功能之一。它也是构建大型的复杂的web应用的基础能力。接下来就通过这篇文章去分析下`Vue`组件系统是如何工作的。这篇文章主要是讲组件系统的渲染。

在组件的注册使用过程当中，有2种使用方式：

* 全局组件

```javascript
Vue.component('component-name', {
  // options
})
```

通过全局方式注册的组件，可在模板根实例下使用。

* 局部组件

```javascript
var Parent = {
  template: '<div>A custom component!<child></child></div>',
  components: {
    child: {
      template: '<p>This is child component</p>'
    }
  }
}

new Vue({
  // ...
  components: {
    'parent-component': Parent
  }
})
```

通过局部注册方式注册的`child`组件只能在`parent`组件内部使用。


### 全局组件

首先，我们来看下全局组件：

`Vue.component`方法提供了全局注册组件的能力，这也是`Vue`在初始化的过程中，通过内部的`initGlobalAPI`方法，在`Vue`这个全局唯一个根`constructor`上挂载的一个方法。



```javascript
function initGlobalAPI (Vue) {
  ...
  initAssetRegisters(Vue);
  ...
}

// ASSET_TYPES -> ['component', 'directive', 'filter']
function initAssetRegisters (Vue) {
  /**
   * Create asset registration methods.
   */
  ASSET_TYPES.forEach(function (type) {
    Vue[type] = function (
      id,
      definition
    ) {
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        ...
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id;
          definition = this.options._base.extend(definition);
        }
        ...
        // 在Vue.options的components属性上挂载组件
        this.options[type + 's'][id] = definition;
        return definition
      }
    };
  });
}

```

通过`Vue.component`方法注册的组件最终还是调用的`Vue.extend`方法来完成子组件对父组件的一系列的继承的初始化的工作。同时在根`constructor`的`options`属性上挂载这个全局子组件的`constructor`。`Vue.extend`方法在整个`Vue`组件系统中算是一个建立起父子组件之间联系的作用。

```javascript
Vue.extend = function (extendOptions) {
    extendOptions = extendOptions || {};
    var Super = this;
    var SuperId = Super.cid;
    // 给extendOptions设置_Ctor属性
    var cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {});
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }
    var name = extendOptions.name || Super.options.name;
    ...
    // 子组件实例的初始化函数
    var Sub = function VueComponent (options) {
      this._init(options);
    };
    Sub.prototype = Object.create(Super.prototype);
    Sub.prototype.constructor = Sub;
    Sub.cid = cid++;
    // 完成options合并的工作
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    );
    Sub['super'] = Super;

    ...
    
    // allow further extension/mixin/plugin usage
    Sub.extend = Super.extend;
    Sub.mixin = Super.mixin;
    Sub.use = Super.use;

    // create asset registers, so extended classes
    // can have their private assets too.
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type];
    });
    // enable recursive self-lookup
    if (name) {
      Sub.options.components[name] = Sub;
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    Sub.superOptions = Super.options;
    Sub.extendOptions = extendOptions;
    Sub.sealedOptions = extend({}, Sub.options);

    // cache constructor
    cachedCtors[SuperId] = Sub;
    return Sub
  };
```

以上就是调用`Vue.component`方法对全局组件进行注册后`Vue`内部所做的工作。接下来看下局部组件的是如何注册的