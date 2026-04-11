# Semaphore

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [AQS](AQS.md), [CountDownLatch](CountDownLatch.md)

## 核心结论

Semaphore 是一个信号量，用来控制同时访问某个资源的线程数量，常用于限流。

## 入口

- acquire()
- release()
- 许可证
- 限流
- 公平 / 非公平

## 基本用法

Semaphore 初始化时设置许可证数量。线程访问资源前先 acquire() 获取许可证，访问完后 release() 归还许可证。

```java
Semaphore semaphore = new Semaphore(2);

semaphore.acquire();
try {
	// 访问资源
} finally {
	semaphore.release();
}
```

## 使用场景

它很适合控制并发数，比如数据库连接池、接口限流、文件批量处理、资源池访问控制。

## 核心理解

可以把它理解成停车位。车位数量固定，车进场先拿一个车位，离开时归还车位；没有车位时就排队等待。

这个模型对应到程序里，就是许可证数量代表可并发访问资源的上限。许可证为 0 时，后续线程会在 acquire() 处等待；有线程 release() 后，等待线程才有机会继续。

在 IO 读取很多、但数据库连接数有限的场景中，可以用 Semaphore 限制“同时写库线程数”，避免把数据库连接池打满。

## 和 AQS 的关系

Semaphore 也是基于 AQS 实现的，它把 state 当作许可证数量来管理。

## 关联页

- [AQS](AQS.md)
- [CountDownLatch](CountDownLatch.md)
