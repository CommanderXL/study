#include <iostream>
#include <string>

using namespace std;
const int BUF = 512;

template <class Ty>
void construct(Ty* ptr)
{
  new (ptr) Ty();
}

class JustTesting
{
  private:
    string words;
    int number;
  public:
    JustTesting(const string& s = "Just Testing", int n = 0) {
      words = s;
      number = n;
      cout << words << " constructed\n";
    };
    ~JustTesting() {
      cout << words << " destoryed\n";
    };
    void Show() const {
      cout << words << ", " << number << endl;
    }
};

int main()
{
  char *buffer = new char[BUF];

  JustTesting *pc1, *pc2;
  
  pc1 = new (buffer) JustTesting;
  pc2 = new JustTesting("Heap1", 20);

  cout << "Memory block addressed:\n" << "buffer: "
    << (void*) buffer << " heap: " << pc2 << endl;
  cout << "Memory contents:\n";
  cout << pc1 << ": ";
  pc1->Show();
  cout << pc2 << ": ";
  pc2->Show();

  JustTesting *pc3, *pc4;
  // fix placement new location
  pc3 = new (buffer + sizeof(JustTesting)) JustTesting("Better Idea", 6);
  pc4 = new JustTesting("Heap2", 10);

  cout << "Memory contents:\n";
  cout << pc3 << ": ";
  pc3->Show();
  cout << pc4 << ": ";
  pc4->Show();
  // cout << "the buffer address is: " << (void*) buffer;
  ::operator delete(pc2);
  // delete pc2;
  delete pc4;
  // explicitly destory placement new objects
  delete pc3;
  pc3->~JustTesting(); // destory object pointed to by pc3
  pc1->~JustTesting(); // destory object pointed to by pc1
  delete [] buffer; // free buffer
  cout << "Done\n";
  return 0;
}

/**
 * delete 操作符一般带有2个操作：
 * 
 * 1. 调用对象的析构函数；
 * 2. 调用 operator delete() 函数去释放内存空间；
 * 
*/

// 在模板定义中， typename 向编译器提供一个提示，指出未知标识符是一种类型。 在模板参数列表中，它用于指定类型参数。