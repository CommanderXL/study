/** 
 * Q: 插入排序是原地排序的方法吗？
 * A：是的，空间复杂度为O(1)
 * 
 * Q：插入排序是稳定性排序的方法吗？
 * A：是的。
 * 
 * Q：插入排序的时间复杂度
 * A：如果数据是有序的数据集，如果从尾到头在有序数据组里面查找插入的数据位置，每次只需要比较一个数据就能确定出插入的位置。
 *    那么最好的时间复杂度为O(n)
 *    如果数据正好是倒序的数据集，每次插入的时候都相当于在数组的第一位中插入，那么最坏的时间复杂度为O(n * n)
*/

function insertSort (arr = []) {
  for (let i = 1; i < arr.length; i++) {
    let j = i - 1
    let val = arr[i]
    for (; j >= 0; --j) {
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