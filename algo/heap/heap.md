## 堆

堆是一种特殊结构的树，它需要满足2个条件：

* 堆是一个完全二叉树；
* 堆中每个节点的值必须大于等于（或小于等于）其子树中每个节点的值，即分为大顶堆和小顶堆

数据存储方式可以使用数组。

堆的比较重要的操作包括：往堆中插入一个数据，删除堆顶的数据。

### 堆化(heapify)

* 由下向上进行堆化

将数据插入到数组的最后，依次找到对应父节点的位置，并进行比较，如果符合条件那么就进行数据的交换，直到不用进行数据交换为止

* 由上向下进行堆化

### 堆应用

1. 堆排序
2. 从大数据量级中筛选出top n的数据出来
3. 流里面的中值
4. 流里面的中位数
