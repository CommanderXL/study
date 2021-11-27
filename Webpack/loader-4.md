## Some tips for Loader

### Inline MatchResource

可以用来改造 module ext，使得原有的 resource 不走 module.rule 的匹配策略，而是根据 `!=!` 之前的 resource 进行 rule 匹配工作来选择使用对应的 loader

### Pitcher Loader

一般用以构建新的 module path -> 然后加入编译流程当中(记得剔除原有的 pitcher loader)

### ImportModule