#include <iostream>
#include <string>

void igor();

float tofu(int num);

long summation(long* arr, int length);

double doctor(const char* str);

// 2.f
struct boss {
  std::string aaa;
};

void ofcourse(boss str);

// 2.g
struct map {
  std::string name;
};
char plot(map* pm);

// 3
void f3(int* arr, int length, int num);
void f3(int* arr, int length, int num) {
  for (int i = 0; i <= length; i++) {
    arr[i] = num;
  }
}

// 4
void f4(int* beginP, int* endP, int num);
void f4(int* beginP, int* endP, int num) {
  int length = endP - beginP;
  for (int i = 0; i <= length; i++) {
    beginP[i] = num;
  }
}

// 5
double f5(const double* arr, int length);
double f5(const double* arr, int length) {
  double max = 0;
  while(length--) {
    if (arr[length] >= max) {
      max = arr[length];
    }
  }
  return max;
}

// 6
/*
在函数的使用过程当中，基本类型都是按值传递，是原数据的拷贝，可以任意修改。
但是对于按引用传递的数据，是传递的地址，const 限制符可以限制其地址对应的值被任意修改。（副作用）
*/

// 8
int replace(char* str, char c1, char c2);
int replace(char* str, char c1, char c2) {
  int count = 0;
  int length = std::strlen(str);
  for (int i = 0; i <= length; i++) {
    if (str[i] == c1) {
      str[i] = c2;
      ++count;
    }
  }
  return count;
}

// 9
/*

*"pizza" -> "pizza"
"taco"[2] -> "a"

*/

// 10
// 结构按值传递是传的这个结构的副本，会新申请内存空间，同时还有复制值的过程，所以效率更低；
// 按地址传递，只是传递一个地址，效率更高；

// 11
int judge(int (*pf)(const char));

// 12
struct applicant {
  char name[30];
  int credit_ratings[3];
};

void display1(applicant t) {
  std::cout << "the applicant name is:\n";
  std::cout << t.name;
  
  std::cout << "the applicant rating is:\n";
  std::cout << t.credit_ratings;
}

void display2(applicant* t) {
  std::cout << "the applicant name is:\n";
  std::cout << t->name;

  std::cout << "the applicant rating is:\n";
  std::cout << t->credit_ratings;
}

// 13
void f1(applicant* a);
const char* f2(const applicant* a1, const applicant* a2);

void (*p1)(applicant* a) = f1;
const char* (*p2)(const applicant* a1, const applicant* a2) = f2;


int main() {

}