function sum(arr) {
  if (arr.length === 1) {
    return arr[0]
  } else {
    return arr[0] + sum(arr.slice(1))
  }
}

// 给出一个 1680 x 640 长宽的土地，求解可划分最大长度的正方形的土地
// x = 1680, y = 640
function calBorder(x, y) {
  if (x > y) {
    const interge = x / y
    if (Number.isInteger(interge)) {
      return y
    } else {
      const _x = x - Math.floor(interge) * y
      return calBorder(_x, y)
    }
  } else if (x < y) {
    const interge = y / x
    if (Number.isInteger(interge)) {
      return x
    } else {
      const _y = y - Math.floor(interge) * x
      return calBorder(x, _y)
    }
  } else {
    return x
  }
}

console.log('the calBorder is:', calBorder(1680, 640))


// 给定一个整数数组 nums ，找到一个具有最大和的连续子数组（子数组最少包含一个元素），返回其最大和

/**
 * 基线条件：
 *
 */

function subMaxArr(arr) {
	let max = arr[0]
	for (let i = 0; i < arr.length; i++) {
		max = subMax(arr.slice(0), max)
	}
	return max
}

function subMax(arr, max) {
  if (arr.length === 1) {
    return max >= arr[0] ? max : arr[0]
  } else {
    const _sum = subMax(arr.slice(1), max)
    return arr[0] + _sum
  }
}

// 快速排序

function quickSort (arr) {
	if (arr.length < 2) {
		return arr
	}
	const poivt = arr[0]
	let leftArr = []
	let rightArr = []
	for (let i = 1; i < arr.length; i++) {
		if (arr[i] >= poivt) {
			rightArr.push(arr[i])
		} else {
			leftArr.push(arr[i])
		}
	}

	return [...quickSort(leftArr), poivt, ...quickSort(rightArr)]
}
