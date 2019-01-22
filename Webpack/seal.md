## seal 阶段

当 module 的依赖分析完后进入 seal 阶段。


开始对每个 module 单独做处理，例如生成 moduleId，同时开始创建最终需要输出的 chunk，每一个入口文件对应一个 chunk，同时根据你的 webpack 配置看是否需要单独输出 runtime 的 chunk，以及生成 hash。