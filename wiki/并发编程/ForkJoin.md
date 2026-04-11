# ForkJoin

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadPoolExecutor](ThreadPoolExecutor.md)

## 核心结论

Fork/Join 是 Java 7 引入的并行分治框架，适合把大任务拆成小任务并行执行。

## 入口

- ForkJoinPool
- RecursiveTask
- RecursiveAction
- 分而治之
- 工作窃取

## 基本理解

Fork/Join 会把大任务不断拆成更小的子任务，直到小到可以直接计算，再把结果逐层合并。

它的核心角色通常包括：

- ForkJoinPool：执行任务的线程池。
- RecursiveTask：有返回值的递归任务。
- RecursiveAction：无返回值的递归任务。

整体流程是先拆分，再并行执行，最后合并结果，比较适合分治类计算任务。

## 相关特性

ForkJoinPool 使用工作窃取算法，空闲线程可以从其他线程的任务队列里“偷”任务，减少线程空转。

## 关联页

- [ThreadPoolExecutor](ThreadPoolExecutor.md)
