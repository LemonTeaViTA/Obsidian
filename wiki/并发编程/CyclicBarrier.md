# CyclicBarrier

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [CountDownLatch](CountDownLatch.md), [Semaphore](Semaphore.md)

## 核心结论

CyclicBarrier 是一个可循环使用的屏障，用来让一组线程互相等待，等所有线程都到达屏障后再一起继续执行。

## 入口

- await()
- 屏障值
- 可重复使用
- barrierAction
- 线程互相等待

## 基本用法

每个线程调用 await() 表示自己已经到达屏障；当最后一个线程到达时，屏障打开，所有线程继续执行。

```java
CyclicBarrier barrier = new CyclicBarrier(3);

new Thread(() -> {
	try {
		barrier.await();
	} catch (Exception e) {
	}
}).start();
```

## 核心特点

它和 CountDownLatch 的最大区别是可以重复使用。屏障打开后，下一轮还能继续等待新的线程组到达。

如果创建时传入 barrierAction，那么最后一个到达屏障的线程会顺带执行一次回调任务。

## 使用场景

适合多个线程分阶段协作的场景，比如并行计算后统一汇总、多个模块同时起跑。

## 和 CountDownLatch 的区别

CountDownLatch 更像“等别人完成”，CyclicBarrier 更像“大家一起到齐再走”。

## 关联页

- [CountDownLatch](CountDownLatch.md)
- [Semaphore](Semaphore.md)
