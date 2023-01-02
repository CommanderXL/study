#include "tabtenn1.cc"
#include <iostream>

void Show(const TableTennisPlayer & rt);
void Show(const TableTennisPlayer & rt) {
  using std::cout;
  cout << "Name: ";
  rt.Name();
  cout << "\nTable: ";
  if (rt.HasTable()) {
    cout << "yes\n";
  } else {
    cout << "no\n";
  }
}

int main()
{

  using std::cout;
  using std::endl;

  TableTennisPlayer player1("Tarr", "Boomdea", false);
  RatedPlayer rplayer1(1140, "Mallory", "Duck", false);

  rplayer1.Name();

  if (rplayer1.HasTable())
  {
    cout << ": Has a Table\n";
  }
  else
  {
    cout << ": hasn't a table.\n";
  }

  player1.Name();
  if (player1.HasTable()) {
    cout << ": has a table;\n";
  } else {
    cout << ": hasn't a table;\n";
  }
  cout << "Name: ";
  rplayer1.Name();
  cout << "; Rating: " << rplayer1.Rating() << endl;

  RatedPlayer rplayer2(1212, player1);
  cout << "Name: ";
  rplayer2.Name();
  cout << "; Rating: " << rplayer2.Rating() << endl;

  Show(rplayer1);
  Show(rplayer2);

  return 0;
}