## Node.js Readable Stream的实现简析

`Readable Stream`是对数据源的一种抽象。它提供了从数据源获取数据并缓存，以及将数据提供给数据消费者的能力。

接下来分别通过`Readable Stream`的2种模式来学习下可读流是如何获取数据以及将数据提供给消费者的。

### Flowing模式

在`flowing`模式下，可读流自动从系统的底层读取数据，并通过`EventEmitter`接口的事件提供给消费者。如果不是开发者需要自己去实现可读流，大家可使用最为简单的`readable.pipe()`方法去消费数据。

接下来我们就通过一个简单的实例去具体分析下`flowing`模式下，可读流是如何工作的。

```javascript
const { Readable } = require('stream')

let c = 97 - 1
// 实例化一个可读流
const rs = new Readable({
  read () {
    if (c >= 'z'.charCodeAt(0)) return rs.push(null)

    setTimeout(() => {
      // 向可读流中推送数据
      rs.push(String.fromCharCode(++c))
    }, 100)
  }
})

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
在我们创建可读流实例时，传入了一个`read`方法，用以自定义从数据源获取数据的方法，**如果是开发者需要自己去实现可读流，那么这个方法一定需要去自定义，否则在程序的运行过程中会报错**。`ReadableState`构造函数中定义了很多关于可读流的不同阶段的状态值：

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
  // 编码方式
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

在上面的例子中，当实例化一个可读流`rs`后，调用可读流实例的`pipe`方法。这正式开始了可读流在`flowing`模式下从数据源开始获取数据，以及`process.stdout`对数据的消费。


```javascript
Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this
  var state = this._readableState
  ...

  // 可读流实例监听data，可读流会从数据源获取数据，同时数据被传递到了消费者
  src.on('data', ondata)
  function ondata (chunk) {
    ...
    var ret = dest.write(chunk)
    ...
  }

  ...
}
```

Node提供的可读流有3种方式可以将**初始态**`flowing = null`的可读流转化为`flowing = true`：

* 监听`data`事件
* 调用`stream.resume()`方法
* 调用`stream.pipe()`方法

事实上这3种方式都回归到了一种方式上:`strean.resume()`，通过调用这个方法，将可读流的模式改变为`flowing`态。继续回到上面的例子当中，在调用了`rs.pipe()`方法后，实际上内部是调用了`src.on('data', ondata)`监听`data`事件，那么我们就来看下这个方法当中做了哪些工作。

```javascript
Readable.prototype.on = function (ev, fn) {
  ...
  // 监听data事件
  if (ev === 'data') {
    // 可读流一开始的flowing状态是null
    // Start flowing on next tick if stream isn't explicitly paused
    if (this._readableState.flowing !== false)
      this.resume();
  } else if (ev === 'readable') {
    ...
  }

  return res;
}
```

可读流监听`data`事件，并调用`resume`方法：

```javascript
Readable.prototype.resume = function() {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    // 置为flowing状态
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    process.nextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    // 开始从数据源中获取数据
    stream.read(0);
  }

  state.resumeScheduled = false;
  // 如果是flowing状态的话，那么将awaitDrain置为0
  state.awaitDrain = 0;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading)
    stream.read(0);
}
```

`resume`方法会判断这个可读流是否处于`flowing`模式下，同时在内部调用`stream.read(0)`开始从数据源中获取数据(其中stream.read()方法根据所接受到的参数会有不同的行为)：

TODO: 这个地方可说明stream.read(size)方法接收到的不同的参数

```javascript
Readable.prototype.read = function (n) {
  ...
  
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    // 如果缓存中没有数据且处于end状态
    if (state.length === 0 && state.ended)
    // 流状态结束
      endReadable(this);
    else
    // 触发readable事件
      emitReadable(this);
    return null;
  }

  ...

  // 从缓存中可以读取的数据
  n = howMuchToRead(n, state);

  // 判断是否应该从数据源中获取数据
  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  // 如果buffer的长度为0或者buffer的长度减去需要读取的数据的长度 < hwm 的时候，那么这个时候还需要继续读取数据
  // state.length - n 即表示当前buffer已有的数据长度减去需要读取的数据长度后，如果还小于hwm话，那么doRead仍然置为true
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    // 继续read数据
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  // 如果数据已经读取完毕，或者处于正在读取的状态，那么doRead置为false表明不需要读取数据
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  } else if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    // 如果当前缓冲区的长度为0，首先将needReadable置为true，那么再当缓冲区有数据的时候就触发readable事件
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    // 从数据源获取数据，可能是同步也可能是异步的状态，这个取决于自定义_read方法的内部实现，可参见study里面的示例代码
    this._read(state.highWaterMark);
    state.sync = false;
    // If _read pushed data synchronously, then `reading` will be false,
    // and we need to re-evaluate how much data we can return to the user.
    // 如果_read方法是同步，那么reading字段将会为false。这个时候需要重新计算有多少数据需要重新返回给消费者
    if (!state.reading)
      n = howMuchToRead(nOrig, state);
  }

  // ret为输出给消费者的数据
  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  } else {
    state.length -= n;
  }

  if (state.length === 0) {
    // If we have nothing in the buffer, then we want to know
    // as soon as we *do* get something into the buffer.
    if (!state.ended)
      state.needReadable = true;

    // If we tried to read() past the EOF, then emit end on the next tick.
    if (nOrig !== n && state.ended)
      endReadable(this);
  }

  // 只要从数据源获取的数据不为null，即未EOF时，那么每次读取数据都会触发data事件
  if (ret !== null)
    this.emit('data', ret);

  return ret;
}
```

这个时候可读流从数据源开始获取数据，调用`this._read(state.highWaterMark)`方法，对应着例子当中实现的`read()`方法：

```javascript
const rs = new Readable({
  read () {
    if (c >= 'z'.charCodeAt(0)) return rs.push(null)

    setTimeout(() => {
      // 向可读流中推送数据
      rs.push(String.fromCharCode(++c))
    }, 100)
  }
})
```

在`read`方法当中有一个非常中的方法需要开发者自己去调用，就是`stream.push`方法，这个方法即完成从数据源获取数据，并供消费者去调用。

```javascript
Readable.prototype.push = function (chunk, encoding) {
  ....
  // 对从数据源拿到的数据做处理
  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
}

function readableAddChunk (stream, chunk, encoding, addToFront, skipChunkCheck) {
  ... 
  // 是否添加数据到头部
      if (addToFront) {
        // 如果不能在写入数据
        if (state.endEmitted)
          stream.emit('error',
                      new errors.Error('ERR_STREAM_UNSHIFT_AFTER_END_EVENT'));
        else
          addChunk(stream, state, chunk, true);
      } else if (state.ended) { // 已经EOF，但是仍然还在推送数据，这个时候会报错
        stream.emit('error', new errors.Error('ERR_STREAM_PUSH_AFTER_EOF'));
      } else {
        // 完成一次读取后，立即将reading的状态置为false
        state.reading = false;
        if (state.decoder && !encoding) {
          chunk = state.decoder.write(chunk);
          if (state.objectMode || chunk.length !== 0)
            // 添加数据到尾部
            addChunk(stream, state, chunk, false);
          else
            maybeReadMore(stream, state);
        } else {
          // 添加数据到尾部
          addChunk(stream, state, chunk, false);
        }
      }
  ...

  return needMoreData(state);
}

// 根据stream的状态来对数据做处理
function addChunk(stream, state, chunk, addToFront) {
  // flowing为readable stream的状态，length为buffer的长度
  // flowing模式下且为异步读取数据的过程时，可读流的缓冲区并不保存数据，而是直接获取数据后触发data事件供消费者使用
  if (state.flowing && state.length === 0 && !state.sync) {
    // 对于flowing模式的Reabable，可读流自动从系统底层读取数据，直接触发data事件，且继续从数据源读取数据stream.read(0)
    stream.emit('data', chunk);
    // 继续从缓存池中获取数据
    stream.read(0);
  } else {
    // update the buffer info.
    // 数据的长度
    state.length += state.objectMode ? 1 : chunk.length;
    // 将数据添加到头部
    if (addToFront)
      state.buffer.unshift(chunk);
    else
    // 将数据添加到尾部
      state.buffer.push(chunk);

    // 触发readable事件，即通知缓存当中现在有数据可读
    if (state.needReadable)
      emitReadable(stream);
  }
  maybeReadMore(stream, state);
}
```

在`addChunk`方法中完成对数据的处理，这里需要注意的就是，在`flowing`态下，数据被消耗的途径可能还不一样：

1. 从数据源获取的数据可能进入可读流的缓冲区，然后被消费者使用;
2. 不进入可读流的缓冲区，直接被消费者使用。

这2种情况到底使用哪一种还要看开发者的是同步还是异步的去调用`push`方法，对应着`state.sync`的状态值。

当`push`方法被异步调用时，即`state.sync`为`false`：这个时候对于从数据源获取到的数据是直接通过触发`data`事件以供消费者来使用，而不用存放到缓冲区。然后调用`stream.read(0)`方法重复读取数据并供消费者使用。

当`push`方法是同步时，即`state.sync`为`true`：这个时候从数据源获取数据后，就不是直接通过触发`data`事件来供消费者直接使用，而是首先上数据缓冲到可读流的缓冲区。这个时候你看代码可能会疑惑，将数据缓存起来后，那么在`flowing`模式下，是如何流动起来的呢？事实上在一开始调用`resume_`方法时：

```javascript
function resume_() {
  ...
  // 
  flow(stream);
  if (state.flowing && !state.reading)
    stream.read(0); // 继续从数据源获取数据
}

function flow(stream) {
  ...
  // 如果处理flowing状态，那么调用stream.read()方法用以从stream的缓冲区中获取数据并供消费者来使用
  while (state.flowing && stream.read() !== null);
}
```

在`flow`方法内部调用`stream.read()`方法取出可读流缓冲区的数据供消费者使用，同时继续调用`stream.read(0)`来继续从数据源获取数据。


以上就是在flowing模式下，可读流是如何完成从数据源获取数据并提供给消费者使用的大致流程。


### paused模式

在`pasued`模式下，消费者如果要获取数据需要手动调用`stream.read()`方法去获取数据。

举个例子:

```javascript
const { Readable } = require('stream')

let c = 97 - 1

const rs = new Readable({
  highWaterMark: 3,
  read () {
    if (c >= 'f'.charCodeAt(0)) return rs.push(null)
    setTimeout(() => {
      rs.push(String.fromCharCode(++c))
    }, 1000)
  }
})

rs.setEncoding('utf8')
rs.on('readable', () => {
  // console.log(rs._readableState.length)
  console.log('get the data from readable: ', rs.read())
})
```

通过监听`readable`事件，开始出发可读流从数据源获取数据。

```javascript
Readable.prototype.on = function (env) {
  if (env === 'data') {
    ...
  } else if (env === 'readable') {
    // 监听readable事件
    const state = this._readableState;
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true;
      state.emittedReadable = false;
      if (!state.reading) {
        process.nextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this);
      }
    }
  }
}

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  // 开始从数据源获取数据
  self.read(0);
}
```

在`nReadingNextTick`当中调用`self.read(0)`方法后，后面的流程和上面分析的flowing模式的可读流从数据源获取数据的流程相似，最后都要调用`addChunk`方法，将数据获取到后推入可读流的缓冲区：

```javascript
function addChunk(stream, state, chunk, addToFront) {
  if (state.flowing && state.length === 0 && !state.sync) {
    ...
  } else {
    // update the buffer info.
    // 数据的长度
    state.length += state.objectMode ? 1 : chunk.length;
    // 将数据添加到头部
    if (addToFront)
      state.buffer.unshift(chunk);
    else
    // 将数据添加到尾部
      state.buffer.push(chunk);

    // 触发readable事件，即通知缓存当中现在有数据可读
    if (state.needReadable)
      emitReadable(stream);
  }
  maybeReadMore(stream, state);
}
```

一旦有数据被加入到了缓冲区，且`needReadable`(这个字段表示是否需要触发`readable`事件用以通知消费者来消费数据)为`true`，这个时候会触发`readable`告诉消费者有新的数据被`push`进了可读流的缓冲区。此外还会调用`maybeReadMore`方法，异步的从数据源获取更多的数据：

```javascript
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    process.nextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  // 在非flowing的模式下，且缓冲区的数据长度小于hwm
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    // 获取不到数据后
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}
```

每当可读流有新的数据被推进缓冲区，触发`readable`事件后，消费者通过调用`stream.read()`方法来从可读流中获取数据。