## Vue组件系统简析

Vue version: 2.5.16

`Vue`的组件系统是`Vue`最为核心的功能之一。它也是构建大型的复杂的web应用的基础能力。接下来就通过这篇文章去分析下`Vue`组件系统是如何工作的。这篇文章主要是讲组件系统的渲染。

### 组件注册

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
          // definition = Vue.extend(definition)
          definition = this.options._base.extend(definition);
        }
        ...
        // 在Vue.options的components属性上挂载组件实例的constructor
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
    // 完成options合并的工作，同时建立起子组件options和Super options的原型链
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

大家可以看到在`Vue.extend`方法内部，实际上就是创建了一个`VueComponent`的`constructor`，同时还需完成这个构造函数和根`constructor`方法、原型链的继承工作，其中有一点关于`options`配置属性合并的工作。

```javascript
...
Sub.options = mergeOptions(
  Super.options,
  extendOptions
)
...
```

// TODO: 讲解下options合并的过程
调用`mergeOptions`方法，将根`constructor`(superCtor)的`options`属性和子`constructor`的`options`(subCtor)属性进行一次合并。就拿`components`属性来说，最终的结果就是`subCtor.options.components.prototype = superCtor.options.components`，同时通过`mixin`，使得`subCtor.options.components`可直接访问全局组件和局部组件。


这样调用`Vue.component`方法后完成全局组件的注册。`Vue`的局部组件和全局组件注册的方法还不太一样，首先在注册的阶段，局部组件并非和全局组件一样在代码初始化的阶段就完成了全局组件的注册，局部组件是在父组件在实例化的过程中动态的进行注册的(后面的内容会讲到这个地方)。

### VueComponent实例化

当全局组件在注册完毕后，开始根实例化的过程。(这篇文章主要将组件渲染过程，所以其他关于`Vue`的部分内容会略去不展开)

根实例化，从`Vue.prototype._init`方法开始：

```javascript
Vue.prototype._init = function () {
  var vm = this

  ...
  initRender(vm)
  ...

  if (vm.$options.el) {
    vm.$mount(vm.$options.el)
  }
}
```

在这个内部，通过调用`initRender`方法给实例挂载生成vnode节点的方法：

```javascript
function initRender () {
  ...
  // 供内部调用生成vnode的方法
  vm._c = function (a, b, c, d) { return createElement(vm, a, b, c, d, false); };
  ...
  // 供开发者调用的生成vnode的方法
  vm.$createElement = function (a, b, c, d) { return createElement(vm, a, b, c, d, true); };
  ...
}
```

接下来根据是否有`el`配置选项来将`vue component`挂载到真实`dom`节点上。


```javascript


// public mount method
Vue.prototype.$mount = function (
  el,
  hydrating
) {
  el = el && inBrowser ? query(el) : undefined;
  return mountComponent(this, el, hydrating)
};

var mount = Vue.prototype.$mount;

Vue.prototype.$mount = function (
  el,
  hydrating
) {
  el = el && query(el);

  var options = this.$options;
  // resolve template/el and convert to render function
  if (!options.render) {
    var template = options.template;
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          template = idToTemplate(template);
          /* istanbul ignore if */
          if ("development" !== 'production' && !template) {
            warn(
              ("Template element not found or is empty: " + (options.template)),
              this
            );
          }
        }
      } else if (template.nodeType) {
        template = template.innerHTML;
      } else {
        {
          warn('invalid template option:' + template, this);
        }
        return this
      }
    } else if (el) {
      // 获取真实dom元素的字符串内容
      template = getOuterHTML(el);
    }
    if (template) {
      // 获取到模板的字符串内容后，调用compileToFunctions方法将模板字符编译成render函数
      // 需要注意的是编译的时候只编译模板下的字符串，并不能直接编译当前模板的子组件的模板内容
      var ref = compileToFunctions(template, {
        shouldDecodeNewlines: shouldDecodeNewlines,
        shouldDecodeNewlinesForHref: shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this);
      // 生成render函数
      var render = ref.render;
      var staticRenderFns = ref.staticRenderFns;
      options.render = render;                    // 挂载render函数
      options.staticRenderFns = staticRenderFns;  // 挂载staticRenderFns函数
    }
  }
  return mount.call(this, el, hydrating)
}

```

完成模板编译，生成`render`函数后，接下来调用`mountComponent`方法：

