# ThreadPoolState

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadPoolExecutor](ThreadPoolExecutor.md)

## 核心结论

线程池状态包括 RUNNING、SHUTDOWN、STOP、TIDYING、TERMINATED，反映线程池从工作到关闭的完整生命周期。

## 入口

- RUNNING
- SHUTDOWN
- STOP
- TIDYING
- TERMINATED

## 状态含义

- RUNNING：接收新任务，也处理队列中的任务。
- SHUTDOWN：不再接收新任务，但继续处理队列中的任务。
- STOP：不接收新任务，也不再处理队列中的任务，并尝试中断正在执行的任务。
- TIDYING：所有任务都结束，准备收尾。
- TERMINATED：线程池完全关闭。

## 状态流转

线程池状态会按 RUNNING -> SHUTDOWN -> STOP -> TIDYING -> TERMINATED 依次推进。

- 调用 shutdown() 后，线程池通常从 RUNNING 进入 SHUTDOWN。
- 调用 shutdownNow() 后，线程池会更快进入 STOP。
- 任务与工作线程清理完成后进入 TIDYING，再进入 TERMINATED。

理解这个流转的重点在于两个边界：

- SHUTDOWN 仍会处理队列中的任务。
- STOP 不再处理队列任务，并尝试中断正在执行的任务。

## 关联页

- [ThreadPoolExecutor](ThreadPoolExecutor.md)
