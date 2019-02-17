function mergeSort (arr = []) {
  return sort(arr, 0, arr.length - 1)
}

function sort (arr, i, j) {
  // 终止条件，返回一个数组，统一返回的数据结构内容
  if (i >= j) {
    return [arr[i]]
  }

  let index = Math.floor((i + j) / 2)
  return merge(sort(arr, i, index), sort(arr, index + 1, j))
}

function merge(sortedArr1, sortedArr2) {
  let i = 0
  let j = 0
  let len1 = sortedArr1.length
  let len2 = sortedArr2.length
  let tmp = []
  while (i < len1 && j < len2) {
    if (sortedArr1[i] <= sortedArr2[j]) {
      tmp.push(sortedArr1[i])
      ++i
    }
    if (sortedArr2[j] <= sortedArr1[i]) {
      tmp.push(sortedArr2[j])
      ++j
    }
  }
  if (i === len1) {
    return tmp.concat(sortedArr2.slice(j))
  }
  if (j === len2) {
    return tmp.concat(sortedArr1.slice(i))
  }
  return tmp
}

console.log(mergeSort([9, 3, 4, 1, 3]))