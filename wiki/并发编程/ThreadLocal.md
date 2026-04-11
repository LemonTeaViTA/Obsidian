# ThreadLocal

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadLocalMap](ThreadLocalMap.md), [Java 内存模型](Java%20内存模型.md), [InheritableThreadLocal](InheritableThreadLocal.md), [ThreadLocal 改进方案](ThreadLocal%20改进方案.md)

## 核心结论

ThreadLocal 用来给每个线程提供独立的变量副本，避免多线程共享同一变量带来的竞争问题。

## 入口

- set / get / remove
- 线程隔离
- 典型应用场景
- Web 请求中的用户信息
- 数据库连接隔离
- 日期格式化隔离
- 与 InheritableThreadLocal 的区别

## 常见使用场景

- Web 请求上下文：在同一请求链路里保存用户信息或 traceId。
- 数据库连接隔离：每个线程持有自己的连接对象，减少竞争。
- 日期格式化隔离：避免多个线程共享同一个非线程安全格式化对象。

## 优点

ThreadLocal 可以在不加锁的前提下实现线程隔离，减少共享变量竞争；同时也方便跨方法传递上下文，避免层层透传参数。

## 关联页

- [ThreadLocalMap](ThreadLocalMap.md)
- [Java 内存模型](Java%20内存模型.md)
- [InheritableThreadLocal](InheritableThreadLocal.md)
- [ThreadLocal 改进方案](ThreadLocal%20改进方案.md)
