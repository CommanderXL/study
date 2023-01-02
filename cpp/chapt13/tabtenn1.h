#ifndef TABTENN0_H
#define TABTENN0_H
#include <iostream>
#include <string>

using std::string;

class TableTennisPlayer
{
  private:
    string firstname;
    string lastname;
    bool hasTable;
  public:
    TableTennisPlayer(const string & fn = "none",
                      const string & ln = "none", bool ht = false);
    void Name() const;
    bool HasTable() const { return hasTable; };
    void ResetTable(bool v) { hasTable = v; };
};

class RatedPlayer : public TableTennisPlayer {
  private:
    unsigned int rating;
  public:
    RatedPlayer(unsigned int ra, const string & fn,
      const string & ln, bool ht);
    RatedPlayer(unsigned int ra, const TableTennisPlayer &tp);
    unsigned int Rating() const { return rating; };
    void ResetRating (unsigned int t) { rating = t; };
};

#endif