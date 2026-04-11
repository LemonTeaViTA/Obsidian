# Lock

> 来源： [并发编程篇](../并发编程篇.md)
> 关联： [ReentrantLock](ReentrantLock.md), [AQS](AQS.md), [synchronized](synchronized.md)

## 核心结论

Lock 是 JUC 中的锁接口，常见实现包括 ReentrantLock、ReentrantReadWriteLock 等。

## 入口

- lock / unlock
- 可中断锁
- 超时等待
- 公平锁与非公平锁
- Condition
- 读写锁

## 和 synchronized 的区别

Lock 是接口，需要手动加锁和释放锁；synchronized 是关键字，由 JVM 自动处理加锁和释放锁。Lock 的能力更丰富，适合需要中断、超时、公平锁和多个 Condition 的场景。

## 常见实现

- ReentrantLock：可重入独占锁，最常用的实现。
- ReentrantReadWriteLock：读写分离锁，读多写少场景更合适。

## 使用方式

Lock 的标准写法是 lock() / try / finally / unlock()，避免异常时忘记释放锁。

```java
Lock lock = new ReentrantLock();
lock.lock();
try {
	// 临界区
} finally {
	lock.unlock();
}
```

## 相关能力

- lockInterruptibly()：支持响应中断地获取锁。
- tryLock()：不阻塞或带超时地尝试获取锁。
- newCondition()：创建条件变量，支持多条件等待与通知。

这些能力是 Lock 相比 synchronized 的核心增强点：

- lockInterruptibly() 适合避免线程长时间卡死在加锁等待上。
- tryLock(timeout, unit) 可以在超时后放弃，避免无限等待。
- 多个 Condition 可以把不同等待条件分开管理，不必全部混在一个 wait/notify 通道里。

## 关联页

- [ReentrantLock](ReentrantLock.md)
- [AQS](AQS.md)
- [synchronized](synchronized.md)
