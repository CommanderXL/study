## Node.js几种创建子进程方法

* exec

其中`exec`可用于在指定的`shell`当中执行命令。不同参数间使用空格隔开，可用于复杂的命令。

```javascript
const { exec } = require('child_process')
exec('cat *.js bad_file | wc -l')
```

`exec`方法用于异步创建一个新的子进程，可以接受一个`callback`。

```javascript
exec('cat *.js bad_file | wc -l', (err, stdout, stderr) => {
  console.log(stdout)
})
```

传给回调的`stdout`和`stderr`参数会包含子进程的`stdout`和`stderr`的输出。

* execFile

```javascript
child_process.execFile(file[, args][, options][, callback])

```

```javascript
const { execFile } = require('child_process')
execFile('node', ['--version'], (err, stdout, stderr) => {
  console.log(stdout)
})
```

不是直接衍生一个`shell`。而是指定的可执行的文件直接创建一个新的进程。

* fork

```javascript
child_process.fork(modulePath[, args][, options])
```

创建一个新的`node`子进程。调用该方法后返回一个子进程的对象。通过`fork`方法创建出来的子进程可以和父进程通过内置的`ipc通道`进行通讯。

衍生的 `Node.js` 子进程与两者之间建立的 `IPC` 通信信道的异常是独立于父进程的。 每个进程都有自己的内存，使用自己的 `V8` 实例。 由于需要额外的资源分配，因此不推荐衍生大量的 `Node.js` 进程。

其中在`options`的配置信息当中：

* silent <Boolean>

父子进程间`stdin/stdout/stderr`之间的通讯。

如果置为`true`，那么子进程的标准输入输出都会被导流到父进程中：

```javascript
parent.js
const { fork } = require('child_process')
const fd = fork('./sub.js')

fd.stdout.on('data', data => console.log(data))

sub.js
console.log('this is sub process')
```

一般在子进程中如果有`stdin`的时候，可将`stdin`直接导入到父进程中，这样可进行`tty`和`shell`的交互。

如果置为`false`，那么子进程的标准输入输出都会继承父进程的。

* stdio 

关于这个的配置见下文。


* spawn



## 父子进程间的通讯