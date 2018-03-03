## Node.js Writable Stream的实现简析

可写流是对数据写入“目的地”的一种抽象，可作为可读流的一种消费者。数据源可能多种多样，如果使用了可写流来完成数据的消费，那么就有可写流的内部机制来控制数据在生产及消费过程中的各状态的扭转等。

首先来看下可写流内部几个比较关键的状态：

```javascript
function WritableState(options, stream) {
  options = options || {};

  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream.
  // These options can be provided separately as readableXXX and writableXXX.
  var isDuplex = stream instanceof Stream.Duplex;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (isDuplex)
    this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var writableHwm = options.writableHighWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;

  if (hwm || hwm === 0)
    this.highWaterMark = hwm;
  else if (isDuplex && (writableHwm || writableHwm === 0))
    this.highWaterMark = writableHwm;
  else
    this.highWaterMark = defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // if _final has been called
  this.finalCalled = false;

  // drain event flag.
  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // has it been destroyed
  this.destroyed = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  // 不是真实buffer的长度，而是等待被写入文件或者socket等的数据的长度
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  // onwrite偏函数，stream始终作为一个参数
  this.onwrite = onwrite.bind(undefined, stream);

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  // 缓存池中的头结点
  this.bufferedRequest = null;
  // 缓存池中的尾结点
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;

  // count buffered requests
  this.bufferedRequestCount = 0;

  // allocate the first CorkedRequest, there is always
  // one allocated and free to use, and we maintain at most two
  var corkReq = { next: null, entry: null, finish: undefined };
  corkReq.finish = onCorkedFinish.bind(undefined, corkReq, this);
  this.corkedRequestsFree = corkReq;
}
```

在实现的可写流当中必须要定义一个`write`方法，在可写流内部，这个方法会被赋值给一个内部`_write`方法，主要是在数据被消费的时候调用：

```javascript
const { Writable } = require('stream')

const ws = new Writable({
  write (chunk, encoding, cb) {
    // chunk 即要被消费的数据
    // encoding为编码方式
    // cb为内部实现的一个onwrite方法，上面说的状态定义里面有关于这个说明，主要是在完成一次消费后需要手动调用这个cb方法来扭转内部状态，下面会专门讲解这个方法
  }
})
```

可写流对开发者暴露了一个`write`方法，这个方法用于接收数据源的数据，同时来完成数据向消费者的传递或者是将数据暂存于缓冲区当中。

让我们来看下一个简单的例子：

```javascript
function writeOneMillionTimes(writer, data, encoding, callback) {
  let i = 1000000;
  write();
  function write() {
    let ok = true;
    do {
      i--;
      if (i === 0) {
        // 最后 一次
        writer.write(data, encoding, callback);
      } else {
        // 检查是否可以继续写入。 
        // 这里不要传递 callback， 因为写入还没有结束！ 
        ok = writer.write(data, encoding);
      }
    } while (i > 0 && ok);
    if (i > 0) {
      // 不得不提前停下！
      // 当 'drain' 事件触发后继续写入  
      writer.once('drain', write);
    }
  }
}

const { Writable } = require('stream')
const ws = new Writable({
  write (chunk, encoding, cb) {
    // do something to consume the chunk
  }
})

writeOneMillionTimes(ws, 'aaaaaa', 'utf8', function () {
  console.log('this is Writable')
})
```

程序开始后，首先可写流调用`writer.write`方法，将数据`data`传入到可写流当中，然后可写流内部来判断将数据是直接提供给数据消费者还是暂时先存放到缓冲区。

```javascript
Writable.prototype.write = function (data, encoding, callback) {
  var state = this._writableState;
  // 是否可向可写流当中继续写入数据
  var ret = false;
  var isBuf = !state.objectMode && Stream._isUint8Array(chunk);

  // 转化成buffer
  if (isBuf && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
    chunk = Stream._uint8ArrayToBuffer(chunk);
  }

  // 对于可选参数的处理
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  // 编码
  if (isBuf)
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = nop;

  // 如果已经停止了向数据消费者继续提供数据
  if (state.ended)
    writeAfterEnd(this, cb);
  else if (isBuf || validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    // 是将数据直接提供给消费者还是暂时存放到缓冲区
    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
  }

  return ret;
}

function writeOrBuffer (stream, state, isBuf, chunk, encoding, cb) {
  ...
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  // 如果state.length长度大于hwm，将needDrain置为true，需要触发drain事件，开发者通过监听这个事件可以重新恢复可写流对于数据源的获取
  if (!ret)
    state.needDrain = true;

  // state.writing 代表现在可写流正处于将数据传递给消费者使用的状态
  // 或 当前处于corked状态时，就将数据写入buffer缓冲区内
  // writeable的buffer缓冲区也是链表结构
  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = {
      chunk,
      encoding,
      isBuf,
      callback: cb,
      next: null
    };
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    // 将数据写入底层数据即传递给消费者
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}


function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  // chunk的数据长度
  state.writelen = len;
  // chunk传递给消费者后的回调函数
  state.writecb = cb;
  // 可写流正在将数据传递给消费者的状态
  state.writing = true;
  // 同步态
  state.sync = true;
  // 如果定义了writev批量写入数据数据的就调用此方法
  if (writev)
    stream._writev(chunk, state.onwrite);
  else
  // 这个方法即完成将数据传递给消费者，并传入onwrite回调，这个onwrite函数必须要调用来告知写数据是完成还是失败
  // 这3个参数也对应着上面提到的在自定义实现可写流时需要定义的write方法所接受的3个参数
    stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}
```





