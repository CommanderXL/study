#include <iostream>

using namespace std;
unsigned long recruise(int);

int main() {
  int val;
  while (1) {
    cin >> val;
    if (val == 0) {
      cout << 1 << endl;
      break;
    } else {
      cout << recruise(val) << endl;
    }
  }

  return 0;
}

unsigned long recruise(int num) {
  if (num == 0) {
    return 1;
  }
  unsigned long val = num * recruise(num - 1);
  return val;
}