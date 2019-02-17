function selectSort (arr) {
  let i = 0
  let j = arr.length - 1
  while (j - i > 0) {
    let min = arr[j]
    let index = j

    for (let k = i; k < arr.length; k++) {
      if (min > arr[k]) {
        min = arr[k]
        index = k
      }
    }
    arr[index] = arr[i]
    arr[i++] = min
  }
  return arr
}

console.log(selectSort([9, 3, 4, 1, 3]))