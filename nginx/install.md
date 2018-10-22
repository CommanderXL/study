## 安装

### 首先是nginx相关的依赖库

* wget http://nginx.org/download/nginx-1.10.2.tar.gz
* wget http://www.openssl.org/source/openssl-fips-2.0.10.tar.gz
* wget http://zlib.net/zlib-1.2.11.tar.gz
* wget https://ftp.pcre.org/pub/pcre/pcre-8.41.tar.gz

### 安装gcc

yum install gcc gcc-c++

### 解压

* tar -zxvf nginx-1.10.2.tar.gz
* tar -zxvf pcre-8.41.tar.gz
* tar -zxvf zlib-1.2.11.tar.gz
* tar -zxvf openssl-fips-2.0.10.tar.gz

### 安装

```shell

cd pcre-8.41/

./configure && make && make install


cd ../zlib-1.2.11/

./configure && make && make install


cd ../openssl-fips-2.0.10/

./config && make && make install


cd ../nginx-1.10.2/

./configure && make && make install
```