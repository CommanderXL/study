* [浅谈CSRF攻击方式](https://juejin.im/entry/588051511b69e60058c6e75e)
* [深入解析跨站请求伪造漏洞](http://netsecurity.51cto.com/art/200812/102951.htm)

防御方法：

1. Http Refer来源判断
2. 后端下发唯一hash值给前端，并做校验
3. 风控验证码