#include <iostream>
#include <exception>

class bad_hmean : public std::exception
{
  private:
    double v1;
    double v2;
  public:
    bad_hmean(double a = 0, double b = 0) : v1(a), v2(b) {};
    void mesg();
    const char* what() { return "bad arguments to hmean()"; };
};

inline void bad_hmean::mesg()
{
  std::cout << "hmean(" << v1 << ", " << v2 << "):"
    << "invalid arguments: a = -b\n";
};

class bad_gmean : public std::exception
{
  public:
    double v1;
    double v2;
    bad_gmean(double a = 0, double b = 0) : v1(a), v2(b) {};
    const char* mesg();
    const char* what() { return "bad arguments to gmean()"; };
};

inline const char* bad_gmean::mesg()
{
  return "gmean() arguments should be >=0\n";
};