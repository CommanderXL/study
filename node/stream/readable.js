const { Readable } = require('stream')

let c = 97 - 1

const rs = new Readable({
  read () {
    if (c >= 'z'.charCodeAt(0)) return rs.push(null)
    // setTimeout(() => {
    rs.push(String.fromCharCode(++c))
    // }, 100)
  }
})

rs.pipe(process.stdout)

process.on('exit', () => {
  console.error('\n_read() called ' + (c - 97) + ' times')
})