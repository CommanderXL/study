/**
 * Q: 冒泡排序是稳定性算法吗？
 * A: 是的，因为当2个数进行比较的时候，如果相等的话是不会进行交换的
 * 
 * Q: 冒泡排序是原地排序算法吗？
 * A：是的，冒泡的过程只涉及到了相邻数据的交换操作，只需要常量级的临时空间。所以它的空间复杂度为O(1)，为原地排序算法 
 *
 * Q: 冒泡排序的时间复杂度是多少？
 * A: 最好的情况下就是数据集正好为正序，这个时候一次冒泡就OK了，时间复杂度为O(n)；
 *    最坏的情况下就是数据集正好为逆序，这个时候需要进行n次冒泡，时间复杂度为O(n*n)
 */

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