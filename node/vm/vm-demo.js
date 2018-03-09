const vm = require('vm')

const sandbox = {
  animal: 'cat',
  count: 2
}

const script = new vm.Script('count += 1; name = "kitty";')
console.log(script)