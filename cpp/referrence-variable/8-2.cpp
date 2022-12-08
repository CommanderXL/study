#include <iostream>
/*

基本的概念：

referrence variable，引用是已定义的变量的别名；

int rats = 101;
int &rodents = rats; // 类型标识符的一部分（赋值操作左侧）可见 8-4.cpp 里面 swapp 的实现，参数为指针参数 int *a

&rats; // 获取 rats 变量的地址，为获取变量地址操作符

与指针之间的差别：

指针指向的是该变量保存数据的地址；
引用即包含了该值，也包含了该变量所保证数据的地址；

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