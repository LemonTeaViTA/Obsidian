# AtomicStampedReference

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [CAS](CAS.md), [OptimisticLock](OptimisticLock.md)

## 核心结论

AtomicStampedReference 用引用值 + 版本号（stamp）一起做 CAS，常用于解决 ABA 问题。

## 入口

- 引用值
- stamp
- ABA 问题
- compareAndSet()

## 基本理解

它不是只比较对象引用，还会同时比较版本号。只要引用值或者 stamp 有一个不匹配，更新就会失败。

```java
AtomicStampedReference<String> ref = new AtomicStampedReference<>("100", 1);

int stamp = ref.getStamp();

ref.compareAndSet("100", "200", stamp, stamp + 1);
```

## 适用场景

适合需要防止 ABA 的场景，比如状态轮转、并发计数、乐观锁实现。

一个典型场景是值先从 A 变成 B，再从 B 变回 A。普通 CAS 只看值会误判为“没变化”，而 AtomicStampedReference 会同时校验版本号，版本不一致就会更新失败。

## 和 AtomicReference 的区别

AtomicReference 只比较引用值；AtomicStampedReference 会同时比较引用值和 stamp。

## 关联页

- [CAS](CAS.md)
- [OptimisticLock](OptimisticLock.md)
