#include "studentc.h"
#include <iostream>

using std::ostream;
using std::endl;
using std::istream;
using std::string;

double Student::Average() const
{
  if (scores.size() > 0) {
    return scores.sum() / scores.size();
  } else {
    return 0;
  }
};

const string & Student::Name() const
{
  return name;
};

double & Student::operator[](int i)
{
  return scores[i];
};

double Student::operator[](int i) const
{
  return scores[i];
};

ostream & Student::arr_out(ostream &os) const
{
  int i;
  int limt = scores.size();
  if (limt > 0) {
    for (int i = 0; i < limt; i++) {
      os << scores[i] << " ";
      if (i % 5 == 4) {
        os << endl;
      }
    }
    if (i % 5 != 0) {
      os << endl;
    }
  }
  else
    os << " empty array ";
  return os;
};

// friends 
istream & operator>>(istream &is, Student & stu)
{
  is >> stu.name;
  return is;
};

istream & getline(istream &is, Student & stu)
{
  getline(is, stu.name);
  return is;
};

ostream & operator<<(ostream &os, const Student & stu)
{
  os << "Scores for " << stu.name << ":\n";
  stu.arr_out(os); // use private method for scores
  return os;
};
