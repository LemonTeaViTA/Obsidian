# AQS

> 来源： [并发编程篇](../并发编程篇.md)
> 关联： [Lock](Lock.md), [ReentrantLock](ReentrantLock.md)

## 核心结论

AQS 通过 state + 等待队列为同步器提供基础能力，是很多 JUC 同步工具的底层实现。

## 入口

- 独占模式
- 共享模式
- CLH 队列
- acquire / release
- state
- Node

## 核心结构

AQS 内部最核心的是一个 volatile 的 state 状态值和一个等待队列。state 由子类决定含义，对 ReentrantLock 来说表示锁的持有次数，对 Semaphore 来说表示许可证数量。

```java
private volatile int state;
```

等待队列由 Node 组成，是一个双向链表。Node 中记录了线程、前驱节点、后继节点和等待状态。

```java
static final class Node {
	static final int CANCELLED = 1;
	static final int SIGNAL = -1;
	static final int CONDITION = -2;
	static final int PROPAGATE = -3;

	volatile Node prev;
	volatile Node next;
	volatile Thread thread;
}
```

## Node 状态含义

- CANCELLED(1)：当前节点被取消，不再参与竞争。
- SIGNAL(-1)：后继节点需要被唤醒。
- CONDITION(-2)：节点在 Condition 等待队列中。
- PROPAGATE(-3)：共享模式下需要继续向后传播唤醒。

## 两种模式

独占模式一次只允许一个线程获取资源，例如 ReentrantLock。共享模式允许多个线程同时获取资源，例如 Semaphore、CountDownLatch。

## CLH 队列

AQS 使用一个 CLH 队列来维护等待线程。CLH 是三个作者 Craig、Landin 和 Hagersten 的首字母缩写，是一种基于链表的自旋锁。

当一个线程尝试获取锁失败后，会被添加到队列的尾部并自旋，等待前一个节点的线程释放锁。

CLH 的优点是，假设有 100 个线程在等待锁，锁释放之后，只会通知队列中的第一个线程去竞争锁，避免同时唤醒大量线程，浪费 CPU 资源。

## 基本流程

当线程尝试获取资源时，如果 state 允许，就直接通过；如果不允许，就进入等待队列。资源释放后，AQS 会从队列中唤醒后继节点，让它继续尝试获取资源。

## 关键方法

- acquire：独占模式获取资源
- release：独占模式释放资源
- acquireShared：共享模式获取资源
- releaseShared：共享模式释放资源

## 队列思想

AQS 采用的是一种类似 CLH 的队列思想，失败的线程会在队列里排队等待，避免所有线程同时竞争同一个资源。

在独占模式下，通常只会唤醒有效后继节点，避免把所有等待线程同时拉起造成无效竞争。

## 和 Lock 的关系

Lock 是接口，AQS 是常见实现的底层骨架。ReentrantLock、Semaphore、CountDownLatch 等同步工具，都可以看作是在 AQS 的基础上定义自己的 state 语义和获取/释放规则。

## 关联页

- [Lock](Lock.md)
- [ReentrantLock](ReentrantLock.md)
