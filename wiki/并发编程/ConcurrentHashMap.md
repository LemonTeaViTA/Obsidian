# ConcurrentHashMap

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [Lock](Lock.md), [AQS](AQS.md)

## 核心结论

ConcurrentHashMap 是 HashMap 的线程安全版本。JDK 7 使用分段锁，JDK 8 使用 CAS + synchronized 的桶级别控制并发。

## 入口

- JDK 7 分段锁
- JDK 8 桶锁
- CAS
- synchronized
- volatile
- 红黑树

## JDK 7 实现

JDK 7 的 ConcurrentHashMap 把整个 Map 切成多个 Segment。每个 Segment 都继承 ReentrantLock，不同线程可以同时操作不同段。

```java
static final class Segment<K, V> extends ReentrantLock {
	transient volatile HashEntry<K, V>[] table;
	transient int count;
}
```

put 时先定位 Segment，再加锁写入；get 时通常不加锁，因为 value 是 volatile 的。

## JDK 8 实现

JDK 8 取消了 Segment，改为数组 + 链表 / 红黑树。插入时优先用 CAS，失败后再用 synchronized 锁住当前桶。

```java
static final class Node<K, V> implements Map.Entry<K, V> {
	final int hash;
	final K key;
	volatile V value;
	volatile Node<K, V> next;
}
```

当链表长度过长时会转换成红黑树，提升冲突场景下的查询效率。

JDK 8 put 的典型流程是：先计算 hash 定位桶位；桶为空则优先 CAS 插入；CAS 失败或桶非空时进入 synchronized 桶锁逻辑；链表过长再做树化。

get 的流程是：先按 hash 定位节点；命中直接返回；遇到树节点或迁移节点走对应 find 逻辑；否则遍历链表。

扩容阶段还会出现 ForwardingNode（迁移标记节点），用于协同多线程转移数据。

ConcurrentHashMap 还会用 spread 对原始 hash 做扰动，降低碰撞后高位信息丢失带来的冲突。

```java
static final int spread(int h) {
	return (h ^ (h >>> 16)) & HASH_BITS;
}
```
比 `HashMap` 的 hash 计算多了一个 `& HASH_BITS` 的操作。这里的 `HASH_BITS` 是一个常数，值为 `0x7fffffff`，它确保结果是一个非负整数。
## 和 HashMap 的区别

HashMap 不是线程安全的；ConcurrentHashMap 适合并发读写场景，而且读操作基本无锁，性能比 Hashtable 更好。

## 和 Hashtable 的区别

Hashtable 直接锁整个表，粒度更粗；ConcurrentHashMap 的并发控制更细，所以吞吐更高。

## 典型应用场景

在我们的技术派实战项目中，很多地方都用到了 `ConcurrentHashMap`，比如说在异步工具类 `AsyncUtil` 中，就使用了 `ConcurrentHashMap` 来存储任务的名称和它们的运行时间，以便安全地在多线程并发执行时观察和分析任务的执行情况。

## 关联页

- [Lock](Lock.md)
- [AQS](AQS.md)
