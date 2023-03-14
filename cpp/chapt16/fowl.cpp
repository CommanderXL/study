// fow1.cpp -- auto_ptr a poor choice
#include <iostream>
#include <memory>
#include <string>

int main()
{
  using namespace std;
  auto_ptr<string> films[5] = 
  {
    auto_ptr<string> (new string("Fowl Balls")),
    auto_ptr<string> (new string("Duck Walks")),
    auto_ptr<string> (new string("Chicken Runs")),
    auto_ptr<string> (new string("Turkey Errors")),
    auto_ptr<string> (new string("Goose Eggs"))
  };
  auto_ptr<string> pwin;
  // transfer ownership from films[2] to pwin，which cause films[2] to no longer refer to the string
  // 这里使用 unique_ptr 要比 auto_ptr 更安全，在编译阶段即可发现错误；
  pwin = films[2];
  
  cout << "The nominees for best avian baseball film are\n";
  for (int i = 0; i < 5; i++)
    cout << *films[i] << endl;
  cout << "The winner is " << *pwin << "!\n";
  cin.get();
  return 0;
}


int main()
{
  using namespace std;
  unique_ptr<string> films[5] =
  {
    unique_ptr<string> (new string("Fowl Balls")),
    unique_ptr<string> (new string("Duck Walks")),
    unique_ptr<string> (new string("Chicken Runs")),
    unique_ptr<string> (new string("Turkey Errors")),
    unique_ptr<string> (new string("Goose Eggs"))
  };

  unique_ptr<string> pwin;
  pwin = films[2]; // 直接出现编译错误

  return 0;
}

// auto_ptr definetion
// template <class X>
// class auto_ptr
// {
//   public:
//     explicit auto_ptr(X* p = 0) throw()
// };