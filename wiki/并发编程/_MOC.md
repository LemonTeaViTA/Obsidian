---
module: 并发编程
tags: [并发编程, MOC]
difficulty: hard
last_reviewed: 2026-06-01
---

# Java 并发编程 MOC (Map of Content)

这里是 Java 并发编程（Concurrency Programming）的知识索引地图。并发编程是 Java 进阶与高频面试中的核心分水岭，涉及到底层操作系统和 JVM 内存模型的深度交互。

为了避免知识碎片化或者单文件过于臃肿，我们采用了**主题聚类（Concept-Cluster）** 的方式对该体系进行了知识点的合理拆解，帮助你建立宏观认知和系统性学习。

---

## 🗺️ 知识体系导航

建议按照以下顺序进行系统学习和复习：

 线程基础与 ThreadLocal
了解并发和并行的区别，掌握线程的状态流转、创建方式及上下文切换。重点死磕 ThreadLocal 的核心原理、内存泄漏问题以及 ThreadLocalMap 的底层设计与扩容机制。
👉 **[[线程基础与ThreadLocal]]** (MOC)
  - [[并发基础概念]]
  - [[线程基础与生命周期]]
  - [[ThreadLocal与内存管理]]

 Java 内存模型 (JMM)
探究 JVM 如何解决多线程环境下的可见性与有序性问题。理解 happens-before 原则、指令重排、as-if-serial，以及极其高频的 `volatile` 关键字的底层保障（内存屏障）。
👉 **[[Java 内存模型]]**

 锁的核心原理 (Synchronized & AQS)
**并发编程的重灾区与基石。**
掌握 `synchronized` 的底层原理（Monitor 对象）与锁升级过程（无锁 -> 偏向锁 -> 轻量级锁 -> 重量级锁）。深入对标 ReentrantLock，死磕 CAS 机制（ABA 问题）以及构建无数并发工具类的底层框架——AQS（AbstractQueuedSynchronizer）的设计精髓。
👉 **[[锁]]**

 👑 线程池 (ThreadPool)
**Java 面试中另一极大重点，生产环境优化必须掌握的核心组件。**
彻底搞懂 ThreadPoolExecutor 的七大核心参数设计，掌握任务丢入线程池的完整运转流程，理解四种拒绝策略与常用的阻塞队列。进一步探讨线程池的动态修改与调优方案。
👉 **[[线程池]]**

 并发工具类 (JUC Utils)
学习基于 AQS 衍生出的一系列在特定并发场景下极其好用的工具类：CountDownLatch（倒计时器）、CyclicBarrier（循环栅栏）、Semaphore（信号量），以及并发安全的基石集合 ConcurrentHashMap 的底层锁分段与 CAS 操作。
👉 **[[并发工具类]]**

 线程通信与同步
**线程之间"传话与等待"的标准姿势。**
`wait/notify/notifyAll` 的语义与必须配合 synchronized 的原因、`Condition` 多条件变量替代 wait/notify 的优势、`Exchanger` 数据交换、CompletableFuture 串/并联编排，以及与 [[锁]] / [[并发工具类]] 的边界划分。
👉 **[[线程通信与同步]]**

 并发容器和框架
了解 Fork/Join 框架的工作分窃（Work-Stealing）算法，以及各类并发容器在极致场景下的运用与特性。
👉 **[[并发容器和框架]]**

---

> **学习笔记提示**：
> 并发编程的学习核心在于理解**共享资源的可见性、原子性和有序性**，每一次加锁与解锁、每一次无锁 CAS 操作，都是为了在多线程的微观世界里寻找“安全”与“性能”的终极平衡。


## 相关链接

- [[_MOC]] — Java 基础是并发编程的前置知识
- [[_MOC]] — JMM 与 JVM 内存模型密切相关
- [[_MOC]] — Redis 分布式锁 vs Java 本地锁


---

## 面试考点

### 线程基础

- 进程和线程的区别？
- 协程和线程的区别？
- 线程有几种创建方式？
- start() 和 run() 的区别？
- 线程有哪些状态？
- 什么是线程上下文切换？
- 线程切换的触发机制和完整流程？
- 线程间有哪些通信方式？
- sleep 和 wait 的区别？
- 怎么保证线程安全？
- ThreadLocal 是什么？
- ThreadLocal 怎么实现的呢？
- ThreadLocal 内存泄漏是怎么回事？

### JMM 与锁

- 什么是 JMM？为什么线程要用自己的内存？
- volatile 关键字的作用？
- synchronized 的实现原理？
- synchronized 锁升级了解吗？
- synchronized 和 ReentrantLock 的区别？
- AQS 了解多少？
- 公平锁和非公平锁的区别？
- CAS 了解多少？有什么问题？
- 乐观锁和悲观锁的区别？
- 线程死锁了解吗？怎么排查？

### 线程池与并发工具

- 什么是线程池？
- 线程池的主要参数有哪些？
- 线程池的工作流程？
- 线程池的拒绝策略有哪些？
- 线程池的线程数应该怎么配置？
- 有哪几种常见的线程池？
- CountDownLatch 和 CyclicBarrier 的区别？
- ConcurrentHashMap 的实现原理？
- CompletableFuture 的使用方式了解吗？
- BlockingQueue 了解吗？有哪些实现类？
- Condition 和 wait/notify 有什么区别？
