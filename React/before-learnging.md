作为初学者，读完官方文档后的一些记录

1. 有关 Jsx

表达式的嵌入；

2. 合成事件

3. 函数组件和 Class 组件

函数组件是无状态的，渲染主要是需要靠父组件传入的 props 进行渲染。如果组件是有状态的需要通过 Class 组件来进行实现。

4. 受控组件

5. Props

组件可以接受任意 props，包括基本数据类型，React 元素以及函数。其中 React 元素：

```javascript
function SplitPane(props) {
  return (
    <div className="SplitPane">
      <div className="SplitPane-left">
        {props.left}
      </div>
      <div className="SplitPane-right">
        {props.right}
      </div>
    </div>
  )
}

function App() {
  return (
    <SplitPane 
      left={ <Contacts /> }
      right={ <Chat /> }
    />
  )
}

// <Contacts /> 和 <Chat /> 之类的 React 元素本质就是对象（object）
```

6. Render Prop

可以理解为插槽，在子组件当中接受来自父组件的 render function。render function 即可以接受外部的数据，也可以接受来自子组件的数据，最终返回的数据满足 Jsx 的合法表达式即可，例如返回 React 元素。