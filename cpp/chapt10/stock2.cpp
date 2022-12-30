#include <iostream>
#include "stock10.h"

int main()
{
  {
    using std::cout;
    cout << "Using constructors to create new objects.\n";
    Stock stock1 = Stock ("NanoSmart", 12, 20.0); // 语法1
    stock1.show();

    Stock stock2 = Stock ("Boffo Objects", 2, 2.0); // 语法2
    // stock2 = stock1;
    // cout << "Listening stock1 and stock2:\n";
    // stock1.show();
    // stock2.show();

    // cout << "Using a constrcuctor to reset an object\n";
    // stock1 = Stock("Nifty Foods", 10, 50.0);
    // cout << "Revised stock1:\n";
    // stock1.show();
    // cout << "Done.\n";
  }
  return 0;
}