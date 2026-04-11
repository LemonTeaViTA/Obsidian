# BlockingQueue

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [Semaphore](Semaphore.md), [ThreadPoolExecutor](ThreadPoolExecutor.md)

## 核心结论

BlockingQueue 是 JUC 里的阻塞队列，支持生产者-消费者模型，队列满时阻塞生产者，队列空时阻塞消费者。

## 入口

- put()
- take()
- 生产者-消费者
- 有界 / 无界
- ReentrantLock + Condition

## 常见实现

- ArrayBlockingQueue：数组结构，有界，固定容量，FIFO。
- LinkedBlockingQueue：链表结构，可有界（默认 Integer.MAX_VALUE），吞吐量通常高于 ArrayBlockingQueue。
- PriorityBlockingQueue：堆（优先队列）结构，无界，按优先级排序（非 FIFO）。
- DelayQueue：优先队列结构（基于 Delayed 接口），无界，元素到期后才能取出。
- SynchronousQueue：无缓冲队列，容量为 0，必须一对一交换数据。
- LinkedTransferQueue：链表结构，无界，支持 tryTransfer()，可把数据直接交给消费者。

## 实现类对比

| 实现类 | 数据结构 | 是否有界 | 特点 |
| --- | --- | --- | --- |
| ArrayBlockingQueue | 数组 | 有界 | 基于数组，固定容量，FIFO |
| LinkedBlockingQueue | 链表 | 可有界（默认 Integer.MAX_VALUE） | 基于链表，吞吐量通常比 ArrayBlockingQueue 高 |
| PriorityBlockingQueue | 堆（优先队列） | 无界 | 元素按优先级排序（非 FIFO） |
| DelayQueue | 优先队列（基于 Delayed 接口） | 无界 | 元素到期后才能被取出 |
| SynchronousQueue | 无缓冲 | 容量为 0 | 必须一对一交换数据，适用于高吞吐任务提交 |
| LinkedTransferQueue | 链表 | 无界 | 支持 tryTransfer()，数据可立即交给消费者 |

## 基本实现

以 ArrayBlockingQueue 为例，内部通常用 ReentrantLock 和两个 Condition 分别控制“队列满”和“队列空”两种等待。

```java
final ReentrantLock lock;
private final Condition notEmpty;
private final Condition notFull;
```

```java
public void put(E e) throws InterruptedException {
	final ReentrantLock lock = this.lock;
	lock.lockInterruptibly();
	try {
		while (count == items.length) {
			notFull.await();
		}
		enqueue(e);
	} finally {
		lock.unlock();
	}
}
```

put 时如果队列满了就等待 notFull；take 时如果队列空了就等待 notEmpty。

这里通常使用 while 而不是 if，是为了在被唤醒后重新检查队列条件，避免误唤醒或并发竞争导致越界写入。

## 使用场景

BlockingQueue 常见于线程池、任务派发、消息消费和限流缓冲。

## 关联页

- [Semaphore](Semaphore.md)
- [ThreadPoolExecutor](ThreadPoolExecutor.md)
