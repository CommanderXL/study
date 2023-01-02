#include "tabtenn0.h"
#include <iostream>

TableTennisPlayer::TableTennisPlayer(const std::string &fn, 
  const std::string &ln, bool ht): firstname(fn),
    lastname(ln), hasTable(ht) {}

void TableTennisPlayer::Name() const
{
  std::cout << lastname << ", " << firstname;
}

