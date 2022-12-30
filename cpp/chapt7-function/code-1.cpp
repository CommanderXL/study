#include <iostream>

// code 1:
double cal(int n1, int n2);
double cal(int n1, int n2) {
  return 2.0 * n1 * n2 / (n1 + n2);
};

int main() {
  using namespace std;
  int n1, n2;
  double val;
  while (1) {
    cout << "please input two number:" << endl;
    cin >> n1 >> n2;
    if (n1 == 0 || n2 == 0) {
      break;
    } else {
      val = cal(n1, n2);
      cout << "the value is : " << val << endl;
    }
  }
  return 0;
}