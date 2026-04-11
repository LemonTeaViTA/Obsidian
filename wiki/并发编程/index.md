# 并发编程

> 说明：当前总文档仍保留在 [并发编程篇](../并发编程篇.md) 作为完整来源页。
> 后续会把这里拆成一个个独立知识点文件，并通过双向链接串起来。

## 导航

- [总览](../并发编程篇.md)
- [整理要求](整理要求.md)
- [ThreadLocal](ThreadLocal.md)
- [ThreadLocalMap](ThreadLocalMap.md)
- [WeakReference](WeakReference.md)
- [ThreadLocal 内存泄露](ThreadLocal%20内存泄露.md)
- [InheritableThreadLocal](InheritableThreadLocal.md)
- [ThreadLocal 改进方案](ThreadLocal%20改进方案.md)
- [Java 内存模型](Java%20内存模型.md)
- [volatile](volatile.md)
- [synchronized](synchronized.md)
- [Lock](Lock.md)
- [ReentrantLock](ReentrantLock.md)
- [AQS](AQS.md)
- [CountDownLatch](CountDownLatch.md)
- [CyclicBarrier](CyclicBarrier.md)
- [Semaphore](Semaphore.md)
- [Exchanger](Exchanger.md)
- [ConcurrentHashMap](ConcurrentHashMap.md)
- [CopyOnWriteArrayList](CopyOnWriteArrayList.md)
- [BlockingQueue](BlockingQueue.md)
- [ThreadPoolExecutor](ThreadPoolExecutor.md)
- [CAS](CAS.md)
- [AtomicInteger](AtomicInteger.md)
- [AtomicReference](AtomicReference.md)
- [AtomicStampedReference](AtomicStampedReference.md)
- [DeadLock](DeadLock.md)
- [OptimisticLock](OptimisticLock.md)
- [PessimisticLock](PessimisticLock.md)
- [ThreadPoolExceptionHandling](ThreadPoolExceptionHandling.md)
- [ThreadPoolState](ThreadPoolState.md)
- [ThreadPoolDynamicConfig](ThreadPoolDynamicConfig.md)
- [ThreadPoolTuning](ThreadPoolTuning.md)
- [ThreadPoolUsageNotes](ThreadPoolUsageNotes.md)
- [CustomThreadPoolExecutor](CustomThreadPoolExecutor.md)
- [DatabaseConnectionPool](DatabaseConnectionPool.md)
- [ThreadPoolCrashRecovery](ThreadPoolCrashRecovery.md)
- [CompletableFuture](CompletableFuture.md)
- [ForkJoin](ForkJoin.md)
- [线程上下文切换](线程上下文切换.md)
- [守护线程](守护线程.md)
- [SleepWait](SleepWait.md)
- [ThreadSafety](ThreadSafety.md)

## 拆分原则

- 一个文件只放一个知识点
- 文件标题直接使用知识点名，不保留题号
- 总文档继续保留，用作原始全集和兜底索引
- 新知识点页之间优先建立显式双链，而不是只靠搜索命中
