class A {
  constructor() {
    this.a = 1;
  }

  go() {
    console.log(this.a);
  }

}

const a = new A();
console.log(a);