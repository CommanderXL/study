#include <iostream>

using namespace std;

const int MAX = 10;

int handleInput(int* arr);
void showInput(int* arr, const int length);
void calAvrageInput(int* arr);

int main() {
  int inputArr[MAX];
  const int count = handleInput(inputArr);
  showInput(inputArr, count);
  return 0;
}

int handleInput(int* arr) {
  int i = 0;
  int val;
  std::cout << "输入不超过10个高尔夫成绩" << endl;
  while(1) {
    if (i >= 10) {
      break;
    }
    if (cin) {
      std::cin >> val;
      cout << val << endl;
      arr[i] = val;
      i++;
      if (cin.fail() == false) {
        break;
      }
    }
  }
  return i;
}

void showInput(int* arr, const int length) {
  cout << "the input value is:" << length << endl;
  for (int i = 0; i <= length; i++) {
    cout << arr[i] << endl;
  }
}