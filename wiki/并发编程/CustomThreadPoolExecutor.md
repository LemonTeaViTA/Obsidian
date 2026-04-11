# CustomThreadPoolExecutor

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadPoolExecutor](ThreadPoolExecutor.md), [BlockingQueue](BlockingQueue.md)

## 核心结论

自定义线程池的核心就是：维护核心线程数、任务队列、最大线程数和拒绝策略。

## 入口

- execute()
- Worker
- workQueue
- 拒绝策略
- shutdown()

## 基本思路

任务先尝试交给核心线程；核心线程忙时进入队列；队列满时扩容；扩容也不够时走拒绝策略。

## 关联页

- [ThreadPoolExecutor](ThreadPoolExecutor.md)
- [BlockingQueue](BlockingQueue.md)
