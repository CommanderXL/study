function flatten1(arr) {
  let res = []
  if (!Array.isArray(arr)) {
    return [arr]
  } else {
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i]
      if (Array.isArray(item)) {
        res.concat(flatten1(item))
      } else {
        res.push(item)
      }
    }
  }
  return res
}

function flatten2(arr) {
  let res = []
  if (!Array.isArray(arr)) {
    return [arr]
  } else {
    res = arr.reduce((initVal, curVal) => initVal.concat(Array.isArray(curVal) ? flatten2(curVal) : curVal), [])
  }

  return res
}