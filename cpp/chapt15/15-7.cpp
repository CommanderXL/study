#include <iostream>
#include <cstdlib>

double hmean(double a, double b);

int main()
{ 
  double x, y, z;
  std::cout << "Enter two numbers:" << std::endl;
  while (std::cin >> x >> y)
  {
    z = hmean(x, y);
    std::cout << "Harmonic mean of " << x << " and " << y
      << " is " << z << std::endl;
    
    std::cout << "Enter next set of numbers <q to quit>: ";
  }
  std::cout << "Bye!\n";

  return 0;
}

double hmean(double a, double b)
{
  if (a == -b)
  {
    std::cout << "untenable arguments to hmean()\n";
    std::abort(); // terminate the program directly without returning first to main
  }

  return 2.0 * a * b / (a + b);
}