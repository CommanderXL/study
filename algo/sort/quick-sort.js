// 快速排序
function quickSort (arr = []) {
  if (arr.length === 1) return arr
  let pviot = arr[arr.length - 1]
  let arr1 = []
  let arr2 = []
  for (let i = 0; i < arr.length - 1; i++) {
    if (pviot <= arr[i]) {
      arr1.push(arr[i])
    } else {
      arr2.push(arr[i])
    }
  }
  return [...quickSort(arr2), pviot, ...quickSort(arr1)]
}

console.log(quickSort([9, 3, 4, 1, 3]))