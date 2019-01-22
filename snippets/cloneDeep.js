function isObject(val) {
  return Object.prototype.toString.call(val) === '[object Object]'
}

function isArray(val) {
  return Array.isArray(val)
}

// 深拷贝
function cloneDeep(obj) {
  let res
  if (isObject(obj)) {
    res = {}
    for (let key in obj) {
      const value = obj[key]
      res[key] = cloneDeep(value)
    }
  } else if (isArray(obj)) {
    res = []
    obj.forEach((item, index) => res[index] = cloneDeep(item))
  } else {
    return obj
  }
  return res
}

// 坑1： 解决循环引用的问题，引入 weakMap 数据结构
// 坑2： symbols 数据类型的处理，function / reg / date / err 数据类型的处理

var val = {
  a: 1,
  b: {
    foo: 1,
    bar: 2
  },
  c: [1, 2, 3]
}

var _val = cloneDeep(val)

console.log(_val.b === val.b)
console.log(_val.c === val.c)