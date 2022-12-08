#include <iostream>

void swapr(int &a, int &b);
void swapp(int *a, int *b);
void swapv(int a, int b);

int main() {
  using namespace std;

  int wallet1 = 300;
  int wallet2 = 350;

  cout << "wallet1 = $" << wallet1;
  cout << "wallet2 = $" << wallet2 << endl;

  cout << "Using referrence to swap contents:\n";
  swapr(wallet1, wallet2);
  cout << "wallet1 = $" << wallet1;
  cout << "wallet2 = $" << wallet2 << endl;

  cout << "Using pointer to swap contents:\n";
  swapp(&wallet1, &wallet2);
  cout << "wallet1 = $" << wallet1;
  cout << "wallet2 = $" << wallet2 << endl;

  return 0;
}

void swapr(int &a, int &b) {
  int temp;
  temp = a;
  a = b;
  b = temp;
}

void swapp(int *a, int *b) {
  int temp;
  temp = *a; // 需要使用 * 运算符来获取变量对应的数据
  *a = *b;
  *b = temp;
}

void swapv(int a, int b) {
  int temp;
  temp = a;
  a = b;
  b = temp;
}