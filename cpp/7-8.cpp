#include <iostream>

const int ArrSize = 8;
int sum_arr(const int* begin, const int* end);

// functions with array range
int main() {
  using namespace std;

  int cookies[ArrSize] = {1, 2, 4, 8, 16, 32, 64, 128};
  int sum = sum_arr(&cookies[0], &cookies[0] + 8);
  cout << "Total cookies eaten: " << sum << endl;

  sum = sum_arr(cookies, cookies + 3);
  cout << "First three eaters ate " << sum << " cookies.\n";
  sum = sum_arr(cookies + 4, cookies + 8);
  cout << "Last four eaters ate " << sum << " cookies.\n";
  return 0;
}

int sum_arr(const int* begin, const int* end) {
  const int* pt;
  int total = 0;

  for (pt = begin; pt < end; pt++) {
    total += *pt;
  }
  
  return total;
}