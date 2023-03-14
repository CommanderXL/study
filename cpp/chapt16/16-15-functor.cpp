// functor.cpp -- using a functor
#include <iostream>
#include <list>
#include <operations>

template<class T> // functor class defines operator()()
class TooBig
{
  private:
    T cutoff;
  public:
    TooBig(const T & t) : cutoff(t) {};
    ~TooBig() {};
    bool operator()(const T & v) { return v > cutoff; };
};

void outint(int n) { std::cout << n << " "; }

int main()
{
  using std::list;
  using std::cout;
  using std::endl;

  plus<int> p(1, 2);

  TooBig<int> f100(100);
  int vals[10] = { 50, 100, 90, 180, 60, 210, 415, 88, 188, 201 };
  list<int> yadayada(vals, vals + 10); // range constructor
  list<int> etcetera(vals, vals + 10);

  cout << "Original lists:\n";
  for_each(yadayada.begin(), yadayada.end(), outint);
  cout << endl;
  for_each(etcetera.begin(), etcetera.end(), outint);
  cout << endl;
  yadayada.remove_if(f100);
  etcetera.remove_if(TooBig<int>(200));
  cout << "Trimmend lists:\n";
  for_each(yadayada.begin(), yadayada.end(), outint);
  cout << endl;
  for_each(etcetera.begin(), etcetera.end(), outint);
  cout << endl;
  return 0;
}


template <class T>
bool tooBig(const T & val, const T & lim)
{
  return val > lim;
};

template <class T>
class TooBig2
{
  private:
    T cutoff;
  public:
    TooBig2(const T & t) : cutoff(t) {};
    ~TooBig2() {};
    bool operator()(const T & v) { return tooBig<T>(v, cutoff); };
};