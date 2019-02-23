/**
 * Q: 是否为原地排序算法
 * A: 是的。不需要额外的存储空间
 * 
 * Q: 是否为稳定排序算法
 * A: 不是的。因为依据的遍历顺序以及数据的交换，可能存在相同的值发生了位置变化，所以是非稳定的排序算法。
 *    因为这个原因选择排序相比于冒泡和插入排序的话稍微弱一点
 *
 * Q: 时间复杂度
 * A: 最好为顺序数据集，但是仍然需要做分区，排序，时间复杂度为O(n * n)
 *    最坏的逆序数据集，同样需要做分区，排序，时间复杂度同为O(n * n)
 */
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