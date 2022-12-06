#include <iostream>
/*

referrence variable，引用是已定义的变量的别名；

int rats = 101;
int &rodents = rats; // 类型标识符的一部分（赋值操作左侧）

&rats; // 获取 rats 变量的地址，为获取变量地址操作符

*/

int main() {
  using namespace std;
  int rats = 101;
  int &rodents = rats;

  cout << "rats = " << rats;
  cout << ", rodents = " << rodents << endl;

  rodents++;
  cout << "rats = " << rats;
  cout << ", rodents = " << rodents << endl;

  cout << "rats address = " << &rats;
  cout << ", rodents address = " << &rodents << endl;

  return 0;
}