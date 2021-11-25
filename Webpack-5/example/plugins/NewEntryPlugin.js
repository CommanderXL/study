const EntryPlugin = require('webpack/lib/EntryPlugin')
const NormalModule = require('webpack/lib/NormalModule')
const path = require('path')

function resolve(file) {
  return path.resolve(__dirname, '../src', file)
}
module.exports = class NewEntryPlugin {
  constructor() {
    this.done = false
  }

  apply(compiler) {
    compiler.hooks.normalModuleFactory.tap(
      'NewEntryPlugin',
      (normalModuleFactory) => {
        normalModuleFactory.hooks.beforeResolve.tap('NewEntryPlugin', () => {})
      }
    )

    compiler.hooks.finishMake.tapAsync(
      'NewEntryPlugin',
      (compilation, callback) => {
        if (!this.done) {
          const context = compiler.context
          const newEntry = EntryPlugin.createDependency(
            resolve('entryB.js'),
            'entryB'
          )
          compilation.addEntry(context, newEntry, 'entryB', () => {
            this.done = true
            callback()
          })
        }
      }
    )

    compiler.hooks.compilation.tap('NewEntryPlugin', (compilation) => {
      const NormalModuleHooks = NormalModule.getCompilationHooks(compilation)
      NormalModuleHooks.beforeSnapshot.tap('NewEntryPlugin', (module) => {
        // console.log('the module is:', module)
      })
    })
  }

  addEntry() {
    // const newEntry = EntryPlugin.createDependency(resolve('a.js'), 'entryB')
  }
}
