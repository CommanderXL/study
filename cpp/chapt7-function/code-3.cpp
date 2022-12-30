#include <iostream>

using namespace std;

struct box {
  char maker[40];
  float height;
  float width;
  float length;
  float volume;
};

void display(box val);
void cal(box* val);

int main() {
  box boxVal = {"ffffff", 23.232, 33.233, 34.33232};
  box* pb = &boxVal;
  cal(pb);
  return 0;
}

void display(box val) {

}

void cal(box* val) {
  val->volume = val->height * val->width * val->length;
  cout << "the val is: " << val->volume << endl;
}
