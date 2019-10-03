// function iterator(items = []) {
//   let i = 0
//   return {
//     next() {
//       // let val = items.shift() // 不能使用 shift 方法来进行判断，有可能数组里面的值就是空的
//       let done = i >= items.length
//       let value = !done ? items[i++] : undefined

//       console.log({ value, done })
//       return {
//         value,
//         done
//       }
//     }
//   }
// }

// var obj = {
//   val: 1
// }

// obj[Symbol.iterator] = function() {
//   return iterator([1, 2, 3, 4])
// }

// for (let i of obj) {
//   console.log(i)
// }

// class Light {

// }

// red 3s / green 1s / yellow 2s
// class Task {
//   constructor() {
//     this.curIndex = 0
//     this.paused = false
//     this.taskQueue = []
//   }

//   add(fn, context, ...args) {
//     this.taskQueue.push((next) => {
//       if (this.paused) {
//         return
//       }
//       fn.apply(context, [next, ...args])
//     })
    
//     return this
//   }

//   run() {
//     const task = this.taskQueue[this.curIndex++]
//     task && task(this.run.bind(this))
//   }

//   stop() {
//     this.paused = true
//   }
// }

// function task1(next) {
//   setTimeout(() => {
//     console.log('red')
//     next()
//   }, 3000)
// }

// function task2(next, b) {
//   setTimeout(() => {
//     console.log('green')
//     next()
//   }, 1000)
// }

// function task3(next, c) {
//   setTimeout(() => {
//     console.log('yellow')
//     next()
//   }, 2000)
// }

// let task = new Task()
// task.add(task1).add(task2, null, 3).add(task3)
// task.run()

// Promise._race = function (args = []) {
//   return new Promise((resolve, reject) => {
//     args.map(p => p.then(resolve, reject))
//   })
// }

// function p1() {
//   return new Promise(resolve => setTimeout(() => {
//     resolve('p1')
//   }, 2000))
// }

// function p2() {
//   return new Promise(resolve => setTimeout(() => {
//     resolve('p2')
//   }, 5000))
// }

// Promise._race([p1(), p2()]).then(d => console.log(d))
// // Promise.race([p1(), p2()]).then(d => console.log(d))


// function asyncGeneratorStep (gen, resolve, reject, _next, _throw, key, arg) {
//   try {
//     var info = gen[next](arg)
//     var value = info.value
//   } catch (error) {
//     reject(error)
//     return
//   }

//   if (info.done) {
//     resolve(value)
//   } else {
//     Promise.resolve(value).then(_next, _throw)
//   }
// }

class Scheduler {
  constructor() {
    this.pendingQueue = []
    this.index = 0
  }

  add(promiseCreator, resolve) {
    if (resolve) {
      return promiseCreator().then(time => {
        --this.index
        this.next()
        resolve(time)
      })
    }
    return new Promise(_resolve => {
      if (this.index < 2) {
        ++this.index
        promiseCreator && promiseCreator().then(time => {
          --this.index
          this.next()
          _resolve(time)
        })
      } else {
        this.pendingQueue.push({
          promiseCreator,
          resolve: _resolve
        })
      }
    })
  }
  next() {
    const task = this.pendingQueue.shift()
    if (task) {
      const { promiseCreator, resolve } = task
      this.add(promiseCreator, resolve)
    }
  }
}

const timeOut = (time) => new Promise(resolve => setTimeout(() => {
  resolve(time)
}, time))

const scheduler = new Scheduler()
const addTask = (time, order) => {
  scheduler.add(() => timeOut(time))
    .then((time) => console.log(order, time)) 
}

addTask(1000, '1')
addTask(500, '2')
addTask(300, '3')
addTask(400, '4')