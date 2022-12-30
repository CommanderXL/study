#include <iostream>
#include "mytime0.cpp"

// 重载运算符（友元函数）
int main()
{
  using std::cout;
  using std::endl;
  Time aida(3, 35);
  Time tosac(2, 48);
  Time temp;

  cout << "Aida and Tosca:\n";
  cout << aida << "; " << tosac << endl;
  temp = aida + tosac; // operator+()
  cout << "Aida + Tosca: " << temp << endl;
  temp = aida * 1.17; // operator*()
  cout << "Aida * 1.17: " << temp << endl; // operator<<()
  cout << "10.0 * Tosca: " << 10.0 * tosac << endl;

  return 0;
}