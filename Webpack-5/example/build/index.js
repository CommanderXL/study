const config = require('../webpack.config')
const webpack = require('webpack')

webpack(config, stats => {
  console.log('done', stats)
})