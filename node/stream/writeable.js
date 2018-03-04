function writeOneMillionTimes(writer, data, encoding, callback) {
  let i = 10000;
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
        ok = writer.write(data, encoding, () => {});
      }
    } while (i > 0 && ok);
    if (i > 0) {
      // 不得不提前停下！
      console.log('drain', i);
      // 当 'drain' 事件触发后继续写入  
      writer.once('drain', write);
    }
  }
}

const { Writable } = require('stream')
const ws = new Writable({
  write (chunk, encoding, cb) {
    // do something to consume the chunk
    setTimeout(() => {
      cb && cb()
    })
  }
})

writeOneMillionTimes(ws, 'aaaaaa', 'utf8', function () {
  console.log('this is writeable')
})