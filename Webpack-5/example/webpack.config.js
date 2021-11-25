const NewEntryPlugin = require('./plugins/NewEntryPlugin')

module.exports = {
  mode: 'development',
  entry: {
    app: './src/entry.js'
  },
  plugins: [
    new NewEntryPlugin()
  ]
}
