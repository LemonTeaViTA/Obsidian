# ThreadPoolCrashRecovery

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadPoolExecutor](ThreadPoolExecutor.md)

## 核心结论

线程池本身只负责内存中的任务调度，不会自动持久化任务状态，所以断电后任务会丢失，需要额外的恢复机制。

## 入口

- 持久化任务
- 幂等性
- 恢复策略
- 数据库 / 消息队列
- 重启恢复

## 处理思路

- 先把任务持久化到数据库或消息队列。
- 任务本身要尽量做成幂等的。
- 系统重启后扫描未完成任务，再重新加载到线程池中执行。

## 关联页

- [ThreadPoolExecutor](ThreadPoolExecutor.md)
