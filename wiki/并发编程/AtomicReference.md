# AtomicReference

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [CAS](CAS.md), [AtomicInteger](AtomicInteger.md)

## 核心结论

AtomicReference 是对引用对象进行原子更新的工具，适合用 CAS 一次性替换一个对象引用。

## 入口

- compareAndSet()
- 引用更新
- 多字段封装
- 解决只能操作一个变量的问题

## 基本理解

当需要同时更新多个字段时，可以把这些字段封装成一个不可变对象，再用 AtomicReference 一次性 CAS 更新整个引用。

这解决了一般的原子操作类只能操作一个变量的问题。例如，我们可以用它来同时更新账户里的钱（money）和积分（points）：

```java
class Account {
        static class Balance {
                final int money;
                final int points;

                Balance(int money, int points) {
                        this.money = money;
                        this.points = points;
                }
        }

        // 初始化时设置默认值
        private AtomicReference<Balance> balance = new AtomicReference<>(new Balance(100, 10));

        public void update(int newMoney, int newPoints) {
                Balance oldBalance, newBalance;
                do {
                        oldBalance = balance.get();
                        newBalance = new Balance(newMoney, newPoints);
                // 使用 CAS 更新整个引用
                } while (!balance.compareAndSet(oldBalance, newBalance));
        }
}
```

## 使用场景

它适合账户状态、配置快照、版本对象替换这类“整体替换”场景。

## 和 AtomicInteger 的区别

AtomicInteger 适合数字型计数；AtomicReference 适合对象引用替换。

## 关联页

- [CAS](CAS.md)
- [AtomicInteger](AtomicInteger.md)
