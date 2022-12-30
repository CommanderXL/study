#include <iostream>

using namespace std;

int Fill_array(int*, int);
void Show_array(int*, int);
void Reserve_array(int*, int);

int main() {
  int length = 5;
  int arr[length];
  int count = 0;
  count = Fill_array(arr, length);
  cout << "the num arr is:" << count << endl;
  Show_array(arr, length);
  Reserve_array(arr, length);
  cout << "the reserve arr is: " << endl;
  Show_array(arr, length);
}

int Fill_array(int* arr, int length) {
  cout << "please input the int num:" << endl;
  int val;
  int count = 0;
  for (int i = 0; i <= length; i++) {
    cin >> val;
    if (!cin) {
      // cout << "Input terminated.\nQuit\n";
      break;
    } else {
      arr[i] = val;
    }
    count++;
  }
  return count;
};

void Show_array(int* arr, int length) {
  for (int i = 0; i < length; i++) {
    cout << arr[i] << " ";
  }
  cout << endl;
}

void Reserve_array(int* arr, int length) {
  for (int i = 0; i < length / 2; i++) {
    int lastI = length - 1 - i;
    int tmp = arr[i];
    arr[i] = arr[lastI];
    arr[lastI] = tmp;
  }
} 