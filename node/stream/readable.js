const { Readable } = require('stream')

let c = 97 - 1

const rs = new Readable({
  highWaterMark: 3,
  read () {
    if (c >= 'f'.charCodeAt(0)) return rs.push(null)
    setTimeout(() => {
      rs.push(String.fromCharCode(++c))
      // rs.push(String.fromCharCode(++c))
      console.log('flowing: ', rs._readableState.flowing)
      console.log('bufferList: ', rs._readableState.buffer)
      console.log('length: ', rs._readableState.length)
      console.log('\n\n')
    }, 1000)
  }
})

/* rs.setEncoding('utf8')
rs.on('data', data => {
  console.log(data)
})
rs.on('resume', data => {
  console.log('emit resume event')
}) */

rs.setEncoding('utf8')
rs.on('readable', () => {
  console.log(rs._readableState.length)
  // setTimeout(() => {
    
  // console.log('this is readable event ', rs.read())
  // }, 1000)
})
/* setTimeout(() => {
  console.log('this is readable event', rs.read())
}, 2500) */

// rs.pipe(process.stdout)

rs.on('end', () => {
  console.log('readable stream ended')
})

process.on('exit', () => {
  // console.error('\n_read() called ' + (c - 97) + ' times')
})