// console.log('child', module)
const paths = [ '/Users/XRene/.node_modules',
'/Users/XRene/.node_libraries',
'/Users/XRene/.nvm/versions/node/v8.0.0/lib/node' ]
// const paths = module.constructor._resolveLookupPaths('./r1', module.parent)
// console.log(paths)
// console.log(module.constructor._resolveFilename('./r1', module.parent, paths))
// console.log(module.constructor._resolveLookupPaths('/Users/XRene/project/study/node/require/module.js', null, true))
// console.log(module.constructor._cache['module'])
// console.log(module.constructor._resolveLookupPaths('./r1', module.parent))

console.log(__filename, __dirname)