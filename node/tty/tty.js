process.stdout.on('resize', () => {
  console.log('窗口大小发生变化！');
  console.log(`${process.stdout.columns}x${process.stdout.rows}`);
});

console.log(process.stdout.isTTY)

setTimeout(() => {

}, 50000)