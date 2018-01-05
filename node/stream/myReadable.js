const { Readable } = require('stream')

class MyReadable extends Readable {
  constructor(dataSource, opt) {
    super(opt)
    this.dataSource = dataSource
  }

  _read () {
    const data = this.dataSource.makeData()
    this.push(data)
  }
}

const dataSource = {
  data: new Array(10).fill('-'),
  makeData () {
    if (!dataSource.data.length) return null
    return dataSource.data.pop()
  }
}

const myReadable = new MyReadable(dataSource)
setTimeout(() => {
  console.log(myReadable._readableState.buffer)
}, 1000)
myReadable.setEncoding('utf8')
myReadable.on('data', (chunk) => {
  // console.log(myReadable._readableState.buffer)
  // console.log(chunk)
})

// 
myReadable.on('end', () => {
  // console.log('end')
})