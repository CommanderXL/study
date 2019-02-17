function bubbleSort (arr = []) {
  for (let i = 0, arrLen = arr.length; i < arrLen; i++) {
    for (let j = 0; j < arrLen - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        let temp = arr[j + 1]
        arr[j + 1] = arr[j]
        arr[j] = temp
      }
    }
  }
  return arr
}

console.log(bubbleSort([9, 3, 4, 1, 3]))