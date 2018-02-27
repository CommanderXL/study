## Node.js Readable Stream的实现简析

`Readable Stream`是对数据源的一种抽象。它提供了从数据源获取数据并缓存，以及将数据提供给数据消费者的能力。

接下来分别通过`Readable Stream`的2种模式来学习下可读流是如何获取数据以及将数据提供给消费者的。

### Flowing模式

在`flowing`模式下，可读流自动从系统的底层读取数据，并通过`EventEmitter`接口的事件提供给消费者。如果不是开发者需要自己去实现可读流，大家可使用最为简单的`readable.pipe()`方法去消费数据。

接下来我们就通过一个简单的实例去具体分析下`flowing`模式下，可读流是如何工作的。

```javascript
const { Readable } = require('stream')

// 实例化一个可读流
const rs = new Readable()

let c = 97 - 1

// 定义可读流实例的_read方法
rs._read = function (hwm) {
  if (c >= 'z'.charCodeAt(0)) return rs.push(null)

  setTimeout(() => {
    // 向可读流中推送数据
    rs.push(String.fromCharCode(++c))
  }, 100)
}

// 将可读流的数据pipe到标准输出并打印出来
rs.pipe(process.stdout)

process.on('exit', () => {
  console.error('\n_read() called ' + (c - 97) + ' times')
})
```

首先我们先来看下`Readable`构造函数的实现：

```javascript
function Readable(options) {
  if (!(this instanceof Readable))
    return new Readable(options);

  // _readableState里面保存了关于可读流的不同阶段的状态值，下面会具体的分析
  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options) {
    // 重写内部的_read方法，用以自定义从数据源获取数据
    if (typeof options.read === 'function')
      this._read = options.read;

    if (typeof options.destroy === 'function')
    // 重写内部的_destory方法
      this._destroy = options.destroy;
  }

  Stream.call(this);
}
```
`ReadableState`构造函数中定义了很多关于可读流的不同阶段的状态值：

```javascript
function ReadableState(options, stream) {
  options = options || {};

  ...

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  // 是否为对象模式，如果是的话，那么从缓冲区获得的数据为对象
  this.objectMode = !!options.objectMode;

  if (isDuplex)
    this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  // 高水位线，一旦buffer缓冲区的数据量大于hwm时，就会停止调用从数据源再获取数据
  var hwm = options.highWaterMark;
  var readableHwm = options.readableHighWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;  // 默认值

  if (hwm || hwm === 0)
    this.highWaterMark = hwm;
  else if (isDuplex && (readableHwm || readableHwm === 0))
    this.highWaterMark = readableHwm;
  else
    this.highWaterMark = defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // A linked list is used to store data chunks instead of an array because the
  // linked list can remove elements from the beginning faster than
  // array.shift()
  // readable可读流内部的缓冲区
  this.buffer = new BufferList();
  // 缓冲区数据长度
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  // flowing模式的初始值
  this.flowing = null;
  // 是否已将源数据全部读取完毕
  this.ended = false;
  // 是否触发了end事件
  this.endEmitted = false;
  // 是否正在从源数据处读取数据到缓冲区
  this.reading = false;

  // a flag to be able to tell if the event 'readable'/'data' is emitted
  // immediately, or on a later tick.  We set this to true at first, because
  // any actions that shouldn't happen until "later" should generally also
  // not happen before the first read call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;

  // has it been destroyed
  this.destroyed = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // 在pipe管道当中正在等待drain事件的写入流
  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}
```
