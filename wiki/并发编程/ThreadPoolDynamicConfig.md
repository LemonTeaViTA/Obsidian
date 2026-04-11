# ThreadPoolDynamicConfig

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadPoolExecutor](ThreadPoolExecutor.md)

## 核心结论

线程池支持在运行时动态修改部分参数，比如核心线程数和最大线程数。

## 入口

- setCorePoolSize()
- setMaximumPoolSize()
- 动态配置
- Nacos
- 自定义监听

## 基本理解

线程池提供 setter 方法，可以在运行时调整线程数参数。

## 注意点

- 核心线程数调大时，线程池会尽量创建新线程。
- 核心线程数调小时，不一定会立刻销毁多余线程。
- 可以结合配置中心或自定义监听做动态刷新。

## 关联页

- [ThreadPoolExecutor](ThreadPoolExecutor.md)
