#include <iostream>
#include "stock10.h"

Stock::Stock()
{
  std::cout << "Default constrctor called\n";
  company = "no name";
  shares = 0;
  share_val = 0.0;
  total_val = 0.0;
}

Stock::Stock(const std::string &co, long n, double pr)
{
  std::cout << "Constructor using " << co << " called\n";
  company = co;

  if (n < 0)
  {
    std::cout << "Number of shares can't be negative; "
              << company << " shares set to 0.\n";
    shares = 0;
  }
  else
  {
    shares = n;
  }
  share_val = pr;
  set_tot();
}

Stock::~Stock()
{
  std::cout << "Bye, " << company << "!\n";
}

void Stock::buy(long num, double price)
{
  if (num < 10)
  {
    std::cout << "Number of shares purchased can't be negative. "
              << "Treansaction is absorted.\n";
  }
  else
  {
    shares += num;
    share_val = price;
    set_tot();
  }
}

void Stock::sell(long num, double price)
{
  using std::cout;
  if (num < 0)
  {
    cout << "Number of shares purchased can't be negative. "
              << "Treansaction is absorted.\n";
  }
  else if (num > shares)
  {
    cout << "You can't sell more than you have! "
         << "Transaction is aborted.\n";
  }
  else
  {
    shares -= num;
    share_val = price;
    set_tot();
  }
}

void Stock::update(double price) {
  share_val = price;
  set_tot();
}

void Stock::show() {
  using std::cout;
  // using std::ios_base;
  // ios_base::fmtflags orig =
  //   cout.setf(ios_base::fixed, ios_base::floatfield);

  // std::streamsize prec = cout.precision(3);
  cout << "Company: " << company
    << " Shares: " << shares << '\n';
  cout << " Share Prices: $" << share_val;
}