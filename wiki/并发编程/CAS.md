# CAS

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [AtomicInteger](AtomicInteger.md), [AtomicReference](AtomicReference.md)

## 核心结论

CAS 是 Compare And Swap 的缩写，是一种乐观锁思想。它会比较当前值和预期值是否相等，如果相等就更新，否则重试。

## 入口

- compareAndSet()
- 预期值
- 新值
- 乐观锁
- 自旋
- ABA 问题

## 基本理解

CAS 涉及三个值：当前变量值、预期值、新值。只有当当前值和预期值相等时，更新才会成功。

```java
AtomicInteger atomicInteger = new AtomicInteger(0);
atomicInteger.compareAndSet(0, 1);
```

## 底层实现

在 JDK 实现里，CAS 相关能力通常由 Unsafe 提供，例如 compareAndSwapInt 这类原子方法。

在底层硬件层面，CAS 会依赖 CPU 的原子指令语义（常见讲法会提到 lock cmpxchg），保证比较与交换步骤不可被并发打断。

## 优点

CAS 不需要传统互斥锁，在低竞争场景下性能很好，适合做无锁更新。

## 问题

CAS 的经典问题有三个：ABA 问题、自旋开销大、只能操作单个变量。

## ABA 问题

一个值从 A 变成 B，再从 B 变回 A，CAS 可能误以为没有变化。常见解决方式是给值加版本号，比如 AtomicStampedReference。

## 自旋开销

CAS 失败后通常会循环重试。如果竞争激烈，CPU 开销会很大，所以实际实现里往往会设置重试边界或配合锁使用。

## 和原子类的关系

AtomicInteger、AtomicLong、AtomicReference 等原子类，本质上都是对 CAS 的封装。

## 关联页

- [AtomicInteger](AtomicInteger.md)
- [AtomicReference](AtomicReference.md)
