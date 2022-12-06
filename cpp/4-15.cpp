#include <iostream>

int main() {
  using namespace std;

  int update = 6;
  int *pUpdate;
  pUpdate = &update;

  cout << "Value: updates = " << update;
  cout << ", *pUpdate = " << *pUpdate << endl;

  cout << "Address: &updates = " << &update;
  cout << ", pUpdate = " << pUpdate << endl;

  *pUpdate = *pUpdate + 1;
  cout << "Now updates = " << update << endl;

  return 0;
}