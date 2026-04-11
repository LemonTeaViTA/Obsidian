# ThreadPoolUsageNotes

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadPoolExecutor](ThreadPoolExecutor.md)

## 核心结论

使用线程池时要注意线程数、队列类型和创建方式，避免资源耗尽或任务堆积。

## 入口

- 有界队列
- 无界队列
- 自定义线程池
- Executors
- 资源耗尽

## 注意点

- 线程池太小会导致任务排队。
- 线程池太大可能导致上下文切换过多。
- 有界队列能限制风险，但可能触发拒绝策略。
- 不建议无脑使用 Executors 创建线程池。

## 关联页

- [ThreadPoolExecutor](ThreadPoolExecutor.md)
