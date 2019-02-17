function insertSort (arr) {
  for (let i = 1; i < arr.length; i++) {
    let j = i - 1
    let val = arr[i]
    for (; j >= 0; ++j) {
      if (arr[j] > val) {
        arr[j + 1] = arr[j] // 数据移动
      } else {
        // 退出本次循环
        break
      }
    }
    arr[j + 1] = val // 插入数据
  }
  return arr
}

console.log(insertSort([9, 3, 4, 1, 3]))