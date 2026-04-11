# PessimisticLock

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [synchronized](synchronized.md), [Lock](Lock.md)

## 核心结论

悲观锁认为冲突经常发生，所以在访问共享资源前先加锁，防止其他线程并发修改。

## 入口

- 先加锁
- 互斥
- synchronized
- ReentrantLock
- 持有资源

## 基本理解

悲观锁的核心是先把资源保护起来，再进行修改，避免并发冲突。

## 使用场景

适合写冲突高、资源一致性要求高的场景，比如库存扣减、余额更新、关键状态修改。

## 和乐观锁的区别

悲观锁适合强冲突场景，代价是并发度会下降；乐观锁适合低冲突场景，代价是可能要重试。

## 关联页

- [synchronized](synchronized.md)
- [Lock](Lock.md)
- [OptimisticLock](OptimisticLock.md)
