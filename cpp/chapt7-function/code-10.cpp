#include <iostream>

double add(double, double);
double add1(double, double);
double add2(double, double);
double calculate(double, double, double (*add)(double, double));

int main() {
  // 注意这里申明数组函数的写法
  // type (*pf[x])(type1, type2) = {f1, f2};
  double (*pf[3])(double, double) = {add, add1, add2};
  double x = 1.0;
  double y = 2.0;
  double res = calculate(x, y, pf[2]);
  std::cout << "the result is: " << res << std::endl;
  return 0;
}

double add(double x, double y) {
  return x + y;
};

double add1(double x, double y) {
  return x + y + 1;
}

double add2(double x, double y) {
  return x + y + 2;
}

double calculate(double x, double y, double (*add)(double, double)) {
  return (*add)(x, y);
}
