# ThreadPoolTuning

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadPoolExecutor](ThreadPoolExecutor.md)

## 核心结论

线程池调优主要围绕任务类型、线程数、队列容量和监控告警展开。

## 入口

- CPU 密集型
- IO 密集型
- 队列积压
- 监控
- 动态调整

## 调优思路

- CPU 密集型任务通常少配线程，减少上下文切换。
- IO 密集型任务通常多配线程，提高并发等待能力。
- 通过压测、监控和队列长度观察来判断参数是否合适。

## 关联页

- [ThreadPoolExecutor](ThreadPoolExecutor.md)
