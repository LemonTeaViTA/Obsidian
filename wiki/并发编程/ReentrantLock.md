# ReentrantLock

> 来源： [并发编程篇](../并发编程篇.md)
> 关联： [Lock](Lock.md), [AQS](AQS.md), [synchronized](synchronized.md)

## 核心结论

ReentrantLock 是基于 AQS 的可重入独占锁，支持公平锁、非公平锁、可中断和超时等待。

## 入口

- state 计数
- 公平 / 非公平
- lock / unlock
- condition
- lockInterruptibly()
- tryLock()
- 超时等待

## 基本用法

ReentrantLock 的基本模式是先 lock()，在 finally 中 unlock()，避免异常时锁没有释放。

```java
class CounterWithLock {
	private int count = 0;
	private final Lock lock = new ReentrantLock();

	public void increment() {
		lock.lock();
		try {
			count++;
		} finally {
			lock.unlock();
		}
	}
}
```

## 公平与非公平

new ReentrantLock() 默认是非公平锁。传入 true 可以创建公平锁，公平锁会尽量按照等待顺序获取锁，非公平锁则允许插队。

```java
ReentrantLock fairLock = new ReentrantLock(true);
ReentrantLock nonFairLock = new ReentrantLock();
```

非公平锁倾向于先尝试直接 CAS 抢锁；公平锁会先看队列前面是否已经有等待线程，核心目标是减少插队。

## 中断与超时

ReentrantLock 支持可中断获取锁和超时等待，这些是 synchronized 不具备的。

```java
lock.lockInterruptibly();
lock.tryLock(3, TimeUnit.SECONDS);
```

## Condition

ReentrantLock 可以绑定多个 Condition，实现多路等待和通知；相比之下，synchronized 只有 wait/notify 这一套单条件模型。

```java
ReentrantLock lock = new ReentrantLock();
Condition condition = lock.newCondition();
```

## 实现原理

ReentrantLock 依赖 AQS 维护 state 和等待队列。state 表示锁的持有次数，当前线程首次获取锁时 state 从 0 变为 1；重入时继续累加；释放时逐步减 1，直到归零才真正释放。

默认的 nonfair 模式会先尝试 CAS 抢占 state，抢到就直接成功；如果失败，再进入 AQS 队列排队。公平锁则会先判断队列前面是否还有等待线程，避免插队。

```java
final void lock() {
	if (compareAndSetState(0, 1))
		setExclusiveOwnerThread(Thread.currentThread());
	else
		acquire(1);
}
```

公平锁常见会通过 hasQueuedPredecessors 这类判断来决定是否允许当前线程直接获取锁。

## 和 synchronized 的区别

ReentrantLock 需要手动释放锁，但提供了更丰富的能力：公平锁、可中断、超时、多个 Condition。synchronized 则更简单，语法成本更低。

## 关联页

- [Lock](Lock.md)
- [AQS](AQS.md)
- [synchronized](synchronized.md)
