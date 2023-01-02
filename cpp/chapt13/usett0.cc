#include "tabtenn0.cc"
#include <iostream>

int main() {

  using std::cout;

  TableTennisPlayer player1("Chunk", "Blizzard", true);
  TableTennisPlayer player2("Tarr", "Boomdea", false);

  player1.Name();

  if (player1.HasTable()) {
    cout << ": Has a Table\n";
  } else {
    cout << ": hasn't a table.\n";
  }

  player2.Name();
  
  if (player2.HasTable()) {
    cout << ": has a table\n";
  } else {
    cout << ": hasn't a table.\n";
  }

  return 0;
}