# ThreadPoolExecutor

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [BlockingQueue](BlockingQueue.md), [CountDownLatch](CountDownLatch.md)

## 核心结论

ThreadPoolExecutor 是 Java 线程池的核心实现，负责线程复用、任务调度、队列缓存和拒绝策略处理。

## 入口

- corePoolSize
- maximumPoolSize
- workQueue
- handler
- keepAliveTime
- shutdown / shutdownNow
- 拒绝策略

## 工作流程

任务提交后，线程池会先使用核心线程执行；核心线程忙不过来时，任务进入队列；队列满了以后，再扩容到最大线程数；如果还是不够，就触发拒绝策略。

```java
if (workerCountOf(c) < corePoolSize) {
	if (addWorker(command, true)) {
		return;
	}
}

workQueue.offer(task);
```

## 核心参数

- corePoolSize：核心线程数，通常长期存活
- maximumPoolSize：最大线程数上限
- workQueue：任务队列
- keepAliveTime：非核心线程空闲存活时间
- threadFactory：线程工厂
- handler：拒绝策略

## 线程数估算

线程数不是越多越好。创建线程时，JVM 需要为每个线程分配虚拟机栈，64 位环境下默认大约是 1M。

例如一个 8G 内存的系统，理论上可以创建很多线程，但实际还要扣掉操作系统、JVM 堆、元空间和其他进程占用，不能简单按 8G / 1M 直接算。

可以通过 `java -XX:+PrintFlagsFinal -version | grep ThreadStackSize` 查看 JVM 默认线程栈大小，其中 `ThreadStackSize` 的单位是 KB，默认通常是 1024 KB，也就是 1M。

## 常见线程池

- FixedThreadPool：固定大小，常配无界队列
- CachedThreadPool：线程可动态扩张，适合短任务
- SingleThreadExecutor：单线程串行执行
- ScheduledThreadPoolExecutor：定时和周期任务

## 拒绝策略

- AbortPolicy：直接抛异常
- CallerRunsPolicy：让提交任务的线程自己执行
- DiscardOldestPolicy：丢弃最老的任务
- DiscardPolicy：直接丢弃

## 关闭线程池

shutdown() 会平滑关闭，先处理完队列里的任务；shutdownNow() 会尝试中断正在执行的任务，并返回未执行的任务列表。

## 调优思路

CPU 密集型任务一般少配线程，IO 密集型任务一般多配线程。最终还是要结合压测、监控和队列积压情况来调参。

## 关联页

- [BlockingQueue](BlockingQueue.md)
- [CountDownLatch](CountDownLatch.md)
