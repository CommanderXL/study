process.stdin.setEncoding('utf8')
console.log(123123)
process.stdin.on('data', (data) => {
  console.log(data)
})