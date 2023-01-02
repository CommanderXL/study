#include "tabtenn1.h"
#include <iostream>

// 函数参数列表初始化表示法
TableTennisPlayer::TableTennisPlayer(const std::string &fn,
                                     const std::string &ln, bool ht) : firstname(fn),
                                                                       lastname(ln), hasTable(ht) {}

void TableTennisPlayer::Name() const
{
  std::cout << lastname << ", " << firstname;
}

RatedPlayer::RatedPlayer(unsigned int ra,
                         const std::string &fn, const std::string &ln, bool ht) : TableTennisPlayer(fn, ln, ht)
{
  rating = ra;
};

RatedPlayer::RatedPlayer(unsigned int ra, const TableTennisPlayer & tp) : TableTennisPlayer(tp) {
  rating = ra;
};