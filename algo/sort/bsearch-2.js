// 二分法 - 循环版
// 数组当中的数据为有序的，且无重复数据
function bsearch(arr = [], value) {
  let min = 0
  let max = arr.length - 1
  while (min <= max) {
    let mid = min + Math.floor((max - min) / 2)
    if (value < arr[mid]) {
      max = mid - 1
    } else if (value > arr[mid]) {
      min = mid + 1
    } else if (value === arr[mid]) {
      return mid
    }
  }
  return -1
}

const arr = []
for (let i = 1; i < 100; i++) {
  arr.push(i)
}

console.log(bsearch(arr, 2))