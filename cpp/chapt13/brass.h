#ifndef BRASS_H_
#define BRASS_H_
#include <string>
#include <sys/socket.h>

// Brass Accout Class
class Brass
{
  private:
    std::string fullName;
    long acctNum;
    double balance;
  public:
    Brass(const std::string & s = "Nullbody", long an = -1, double bal = 0.0);
    void Deposit(double amt);
    virtual void WithDraw(double amt);
    double Balance() const;
    virtual void ViewAcct() const;
    virtual ~Brass();
};

// Brass Plus Account Class
class BrassPlus : public Brass
{
  private:
    double maxLoan;
    double rate;
    double owesBank;
  public:
    BrassPlus(const std::string & s = "Nullbody", long an = -1, double bal = 0.0, double ml = 500, double r = 0.11125);
    BrassPlus(const Brass & ba, double ml = 500, double r = 0.11125);
    virtual void ViewAcct() const;
    virtual void WithDraw(double amt);
    void ResetRate(double r) { rate = r; };
    void ResetOwes() { owesBank = 0; };
};

#endif