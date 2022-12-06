#include <iostream>

struct anta_years_end
{
  int year;
};


int main() {
  anta_years_end s1, s2, s3;
  s1.year = 1998;

  anta_years_end* pa = &s2;
  pa->year = 1999;

  anta_years_end trio[3];
  trio[0].year = 2003;

  std::cout << trio->year << std::endl;
  const anta_years_end* arp[3] = {&s1, &s2, &s3};

  std::cout << arp[1]->year << std::endl;
  const anta_years_end** ppa = arp;
  // auto ppb = arp;
  const anta_years_end** ppb = arp;

  std::cout << (*ppa)->year << std::endl;
  std::cout << (*(ppb + 1))->year << std::endl; 

  return 0;
}