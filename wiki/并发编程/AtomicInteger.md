# AtomicInteger

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [CAS](CAS.md)

## 核心结论

AtomicInteger 是基于 volatile 和 CAS 的原子整数类，常用于在多线程中做无锁自增和状态更新。

## 入口

- getAndIncrement()
- compareAndSet()
- volatile
- CAS
- Unsafe

## 基本用法

AtomicInteger 提供了很多原子操作方法，比如 getAndIncrement()、incrementAndGet()、compareAndSet()。

```java
AtomicInteger counter = new AtomicInteger(0);

int value = counter.getAndIncrement();
```

## 实现思路

它的核心就是使用 CAS 尝试更新内部值，更新失败就重试。底层依赖 Unsafe 提供的原子指令能力。

```java
public final int getAndIncrement() {
	return unsafe.getAndAddInt(this, valueOffset, 1);
}
```

## 适用场景

AtomicInteger 适合计数器、并发状态标记、简单的无锁更新。

## 局限

它只能原子更新一个值。如果要同时修改多个变量，通常需要 AtomicReference 把多个字段封装成一个对象。

## 关联页

- [CAS](CAS.md)
- [AtomicReference](AtomicReference.md)
