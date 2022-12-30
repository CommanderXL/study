#include <iostream>

using namespace std;
const int SLEN= 30;

struct student {
  char fullname[SLEN];
  char hobby[SLEN];
  int ooplevel;
};

int getinfo(student pa[], int n);
void display1(student st);
void display2(const student* ps);
void display3(const student pa[], int n);

int main() {
  cout << "Entr class size: ";
  int class_size;
  cin >> class_size;
  while (cin.get() != '\n') {
    continue;
  }
  student* ptr_stu = new student[class_size];
  int entered = getinfo(ptr_stu, class_size);
  for (int i = 0; i < entered; i++) {
    display1(ptr_stu[i]);
    display2(&ptr_stu[i]);
  }
  display3(ptr_stu, entered);
  delete [] ptr_stu;
  cout << "Done\n";
  return 0;
}

int getinfo(student* pa, int n) {
  cout << "the n is: " << n;
  int count = 0;
  for (int i = 0; i < n; i++) {
    cout << "please enter the " << i << " fullname: " << endl;
    cin.getline(pa[i].fullname, 30);
    cout << "please enter the " << i << " hobby: " << endl;
    cin >> pa[i].hobby;
    cout << "please enter the " << i << " ooplevel: " << endl;
    cin >> pa[i].ooplevel;
    cin.get();
    cout << "next one" << endl;
    count++;
  }
  return count;
}

void display1(student st) {
  cout << st.fullname << endl;
  cout << st.hobby << endl;
  cout << st.ooplevel << endl;
}

void display2(const student* ps) {
  cout << ps->fullname << endl;
  cout << ps->hobby << endl;
  cout << ps->ooplevel << endl;
}

void display3(const student* ps, int n) {
  for (int i = 0; i < n; i++) {
    cout << ps[i].fullname << endl;
    cout << ps[i].hobby << endl;
    cout << ps[i].ooplevel << endl;
  }
}