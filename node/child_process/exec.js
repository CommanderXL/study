const { promisify } = require('util')
const childProcess = require('child_process')
const pExec = promisify(childProcess.exec)

async function lsExample () {
  // 返回一个包含stdout和stderr的对象
  const { stdout, stderr } = await pExec('ls')
  console.log(`stdout: ${stdout}`)
  console.log(`stderr: ${stderr}`)
}

// lsExample()

const fd = childProcess.spawn('node', ['sub.js'], {
  stdio: 'inherit'
})