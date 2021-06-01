/**
 * 
 * 递归的一些思想：
 * 
 * 1. 基线条件（终止条件）
 * 2. 递归条件（继续下去的条件）
 * 
 * 循环的场景都能使用递归的方法来进行解决吗？
 * 
 * 循环相较于递归来说，性能会更好。因为递归函数会维持函数的调用栈。一旦递归过深，会一直维持函数的调用栈，
 * 占用系统的内存。而使用循环的话，每次循环结束后，就会释放这个循环体内分配的内存，进而进行下一次的循环。
 * 
 * 什么场景下面会使用到递归的思想呢？ 
 * 
 * 分而治之(divide & conquer) D&C -> 解决问题的思路
 * 
 * 核心的思想：问题的分解，找到满足的基线条件。
 * 
 */

function sum(...args) {
  if (args.length === 1) {
    return args[0]
  } else {
    return args[0] + sum(...args.slice(1))
  }
}

function max(arr = []) {
  if (arr.length === 2) {
    return Math.max(arr[0], arr[1])
  } else {
    return Math.max(arr[0], max(arr.slice(1)))
  }
}

console.log(max([4, 5, 4564, 6, 234]))
