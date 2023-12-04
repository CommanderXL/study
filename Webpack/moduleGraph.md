## ModuleGraph

moduleGraph 实际是用来管理 module 与相关 dependency 之间的依赖的抽象，核心是要解决 module 和其 dependency 及这个 dependency 所对应的 module 之间的依赖关系（todo 画个关系图更清晰）。在整个编译构建流程当中都可以通过 moduleGraph 来获取 module/dependency-module 之间的依赖关系。

针对 moduleGraph 生成引入了另外的数据结构用以管理他们之间的依赖关系：

1. 

```javascript
class Compilation {
  constructor() {
    ...
    this.moduleGraph = new ModuleGraph()
  }
}

```

对于 ModuleGraph 而言，最为核心的就是 _moduleMap 数据结构：

```javascript
class ModuleGraph {
  constructor() {
    // 以 Dependency 为 key，用来管理 module，dependency 之间的依赖关系。例如对于入口模块来说
    this._dependencyMap = new WeakMap() // WeakMap<Dependency, ModuleGraphConnection>
    // 以 Module 为 key，用来管理当前这个 module 所有的内外部依赖关系；
    this._moduleMap = new Map() // Map<module, ModuleGroupModules>
  }

  setResolvedModule(originModule, dependency, module) {
    const connection = new ModuleGraphConnection(
      originModule,
      dependency,
      module,
      undefined,
      dependency.weak,
      dependency.getCondition(this)
    )
    const connections = this._getModuleGraphModule(module).incomingConnections
    connections.add(connection)
    if (originModule) {
			const mgm = this._getModuleGraphModule(originModule);
			if (mgm._unassignedConnections === undefined) {
				mgm._unassignedConnections = [];
			}
			mgm._unassignedConnections.push(connection);
			if (mgm.outgoingConnections === undefined) {
				mgm.outgoingConnections = new SortableSet();
			}
			mgm.outgoingConnections.add(connection);
		} else {
			this._dependencyMap.set(dependency, connection);
		}
  }

  // 依据 dependency 索引来定位模块之间的依赖关系
  getConnection(dependency) {
  
  }
}
```

通过 dependency 索引，既可找到对应的 module 实例（connection），又能找到 parentModule
而通过 module 是可以找到 incomingConnections（这个模块自身被依赖的关系）/outgoingConnections（这个模块所依赖的）（conntection），也就是所有的依赖关系。 todo：这里使用一个图会更加清晰


其中的 `ModuleGraphConnection` 数据结构用以记录当前的 module、dependency 和其父 module 之间的依赖关系，connection 实例是整个 moduleGraph 记录依赖关系的最小单元：

```javascript
class ModuleGraphConnection {
  constructor(
    originModule, // the referencing module
    dependency, // the referencing dependency
    module,  // the referenced module
    explanation, 
    weak = false, 
    condition = false
  ) {
    this.originModule = originModule
    this.resolvedOriginModule = originModule
    this.dependency = dependency
    this.resolvedModule = module
    this.module = module
    ...
  }
}
```

其中的 `ModuleGraphModule` 数据结构分别以：

* incommingConnections （可以通过 incommingConnections 找到产生引用关系的父模块，而父模块可能存在多个）
* outgoingConnections（记录了当前模块所引用的 dependency-module）


### module issuer 的使用场景

`setIssuerInUnset`

这个 module 初次被引入的模块（初次产生的依赖关系，并被加入到构建流程当中）。已经构建完成的 module 后续就不参加构建了。

一般可以通过 `module.issuer` 来寻找当前这个 module **最开始被引入到编译构建流程当中的父模块**。

和其他找寻模块的方法不一样的地方主要对应的使用场景。
