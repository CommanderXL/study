// 二分法 - 递归版
// 数组当中的数据为有序的，且无重复数据
function bsearch (arr = [], min, max, num) {
  if (min > max) return -1 // 退出条件的判断
  let mid = min + Math.floor((max - min) / 2) // 需要这里注意取中间值
  const midVal = arr[mid]
  if (num < midVal) {
    return bsearch(arr, min, mid - 1, num)
  } else if (num > midVal) {
    return bsearch(arr, mid + 1, max, num)
  } else if (num === midVal) {
    return mid
  }
}

const arr = []
for (let i = 2; i < 100; i++) {
  arr.push(i)
}

console.log(bsearch(arr, 0, arr.length - 1, 2))