# CountDownLatch

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [CyclicBarrier](CyclicBarrier.md), [Semaphore](Semaphore.md)

## 核心结论

CountDownLatch 是一个一次性的同步工具，用来让一个线程等待多个线程完成任务，或者让多个线程等待一个开始信号。

## 入口

- countDown()
- await()
- 主线程等待子线程
- 一次性
- 计数器归零

## 基本用法

CountDownLatch 内部维护一个计数器。线程执行完自己的任务后调用 countDown()，主线程调用 await() 等待计数器归零。

```java
CountDownLatch latch = new CountDownLatch(3);

new Thread(() -> {
	try {
		// 执行任务
	} finally {
		latch.countDown();
	}
}).start();

latch.await();
```

## 使用场景

它最适合“等所有任务都完成后再继续”的场景，比如批量查询、批量初始化、等待多个子任务汇总结果。

```java
CountDownLatch countDownLatch = new CountDownLatch(5);
countDownLatch.await();
countDownLatch.countDown();
```

它既能做“一等多”，也能做“多等一”：

- 一等多：主线程 await()，等待多个子线程 countDown()。
- 多等一：多个工作线程 await()，主线程一次 countDown() 统一放行。

在大批量数据并行查询场景里，也可以用 CountDownLatch 等待固定数量的工作线程全部完成，再统一汇总输出结果。

## 和 CyclicBarrier 的区别

CountDownLatch 是一次性的，计数器归零后不能重置；CyclicBarrier 是可重复使用的屏障，更偏向让多个线程互相等待。

## 关联页

- [CyclicBarrier](CyclicBarrier.md)
- [Semaphore](Semaphore.md)
