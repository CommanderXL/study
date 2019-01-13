function flatMap1(arr) {
  let res = []
  if (!Array.isArray(arr)) {
    throw new Error('It\'s not an array')
  } else {
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i]
      if (Array.isArray(item)) {
        res.concat(flatMap(item))
      } else {
        res.push(item)
      }
    }
  }
  return res
}

function flatMap2(arr) {
  let res = []
  if (!Array.isArray(arr)) {
    throw new Error('It\'s not an array')
  } else {
    res = arr.reduce((initVal, curVal) => initVal.concat(Array.isArray(curVal) ? flatMap2(curVal) : curVal), [])
  }

  return res
}