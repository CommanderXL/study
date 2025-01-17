### Profiler

Q：Profiler 组件是如何收集性能数据的？

A：actualDuration 是什么指标


```javascript
startProfilerTime(unitOfWork)

next = beginWork(current, unitOfWork)

stopProfilerTimerIfRunningAndRecordDuration(unitOfWork)
```


```javascript
function stopProfilerTimerIfRunningAndRecordDuration(fiber) {
  if (profilerStartTime >= 0) {
    const elapsedTime = now() - profilerStartTime // 运行的时间
    fiber.actualDuration += elapsedTime
    fiber.selfBaseDuration += elapsedTime
    profilerStartTime = -1
  }
}
```