**Custom Hooks let you share stateful logic but not state itself. Each call to a Hook is completely independent from every other call to the same Hook**

----

Start by choosing your custom Hook’s name. If you struggle to pick a clear name, it might mean that your Effect is too coupled to the rest of your component’s logic, and is not yet ready to be extracted.

Ideally, your custom Hook’s name should be clear enough that even a person who doesn’t write code often could have a good guess about what your custom Hook does, what it takes, and what it returns:

✅ useData(url)
✅ useImpressionLog(eventName, extraData)
✅ useChatRoom(options)

----

A good custom Hook makes the calling code more declarative by constraining what it does.

### LifeCycle of Reactive Effects

An Effect describes how to synchronize an external system to the current props and state. As your code changes, synchronization will need to happen more or less often.

----
 
Previously, you were thinking from the component’s perspective. When you looked from the component’s perspective, it was tempting to think of Effects as “callbacks” or “lifecycle events” that fire at a specific time like “after a render” or “before unmount”. This way of thinking gets complicated very fast, so it’s best to avoid.

Instead, always focus on a single start/stop cycle at a time. It shouldn’t matter whether a component is mounting, updating, or unmounting. All you need to do is to describe how to start synchronization and how to stop it. If you do it well, your Effect will be resilient to being started and stopped as many times as it’s needed.

----

All values inside the component (including props, state, and variables in your component’s body) are reactive. Any reactive value can change on a re-render, so you need to include reactive values as Effect’s dependencies.

In other words, Effects “react” to all values from the component body.

### Seperating Events from Effects

Logic inside Effects is reactive. If your Effect reads a reactive value, you have to specify it as a dependency. Then, if a re-render causes that value to change, React will re-run your Effect’s logic with the new value.



----


### Removing Effect Dependency


Each Effect should represent an independent synchronization process. 


----




对于 Effects 而言，从表现上来看是组件 mount 之后会触发 Effects 函数的执行，但是实际上使用 Effect 的关注点不应该在生命周期和 Effects 之前的关系，而是在如何使用 Effects 来完成外部系统和 React 组件间的状态更新和同步（Effect 'react' to reactive values）。官方使用一个 chatRoom 的例子来说明

[依赖的管理问题](https://react.dev/learn/removing-effect-dependencies#why-is-suppressing-the-dependency-linter-so-dangerous)



文档当中出现比较的 reative values 如何去理解？

Reactive values include props and all variables and functions declared directly inside of your component

核心想表达的意思是 props/state <-> effect 之间的联系，如果 effect 依赖了一些数据，那么当这些数据发生变化的时候会重新触发组件的渲染进而看 effect 是否需要重新执行。