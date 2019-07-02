# await 关键字

不知道大家在平时使用 async/await 语法进行异步 -> 同步操作过程有没有考虑过这样一个问题：

await 关键字后面可以使用 promise，当这个 promise 被 resolve 后，我们是可以直接获取到 resolve 的值。

```javascript
async function demo1() {
  const num = await Promise.resolve(1) // num 为1
}
```

但是在平时我们使用 promise 的过程中，由于 promise 是一个异步的操作，因此是无法直接其被 resolve 的值的，除非是在 promise.then 方法中传入的回调当中才能获取得到。

```javascript
const num = Promise.resolve(1) // num 此时为一个被 resolved 的 promise，而非 1

num.then(val => console.log(val)) // 输出1
```

async/await 语法规则就是这样定义的，在一些不支持 async/await 语法的浏览器当中如果想使用的话，必须借助 babel 这样的代码转化工具就能实现 async/await 所具备的功能。那么 babel 是如何实现这样的能直接获取到 await 关键字后面的 promise 被 resolve 后的值的呢？

我们首先来看个例子：

```javascript
const fetchData = data =>
  new Promise(resolve => setTimeout(resolve, 1000, data + 1))

const fetchValue = async function() {
  var value1 = await fetchData(1) 
  var value2 = await fetchData(value1)
  var value3 = await fetchData(value2)
  console.log(value3)
}

fetchValue()
// 大约 3s 后输出 4
```
