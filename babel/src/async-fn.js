async function a () {
  await new Promise(resolve => {
    setTimeout(resolve, 3000)
  })
}