# DatabaseConnectionPool

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [BlockingQueue](BlockingQueue.md), [ThreadPoolExecutor](ThreadPoolExecutor.md)

## 核心结论

数据库连接池本质上是一个可复用资源池，用队列管理连接的获取和归还。

## 入口

- 初始化连接
- 获取连接
- 归还连接
- 关闭连接
- 超时等待

## 基本思路

启动时预先创建固定数量的连接放入队列；使用时从队列获取；用完后归还；如果连接失效就补一个新的。

## 关联页

- [BlockingQueue](BlockingQueue.md)
- [ThreadPoolExecutor](ThreadPoolExecutor.md)
