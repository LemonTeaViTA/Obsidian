---
module: 并发编程
tags: [并发, 线程, ThreadLocal, MOC]
difficulty: medium
last_reviewed: 2026-06-01
---

# 线程基础与ThreadLocal

> [!info] 速览
> 本篇覆盖并发编程的基础概念、线程的生命周期与 ThreadLocal 三大块，建议按顺序阅读：
> - 并发基础概念：并发/并行、线程安全三要素、volatile、进程与线程、协程
> - 线程基础：创建方式、start/run、调度方法、6 种状态、上下文切换、守护线程
> - ThreadLocal：使用方式、实现原理、内存泄漏成因与 remove()、ThreadLocalMap 源码与扩容、InheritableThreadLocal
>
> 线程间通信与同步（wait/notify、Condition、Exchanger、CompletableFuture）已拆分到 [[线程通信与同步]]。

## 📚 本主题包含以下文档

### [[并发基础概念]]
并发与并行的区别、线程安全三要素、volatile原理、进程线程协程、Java内存模型。

**适合场景**：理解并发编程的理论基础和核心概念。

### [[线程基础与生命周期]]
线程创建方式、start vs run、调度方法、6种状态、上下文切换、守护线程。

**适合场景**：掌握线程的基本操作和生命周期管理。

### [[线程通信与同步]]
线程间通信方式（共享内存/wait-notify/Condition/Exchanger/CompletableFuture）、sleep vs wait、保证线程安全的手段与场景。

**适合场景**：学习线程间如何协作与同步。

### [[ThreadLocal与内存管理]]
ThreadLocal使用与原理、内存泄漏问题、ThreadLocalMap源码、Hash冲突解决、扩容机制、InheritableThreadLocal。

**适合场景**：深入理解线程局部变量的实现与最佳实践。

---

## 相关链接
- [[Java 内存模型]] — 线程可见性问题的根源
- [[锁]] — synchronized/Lock 解决线程安全问题
- [[线程池]] — 线程的复用与管理
- [[JVM 内存管理]] — 虚拟机栈与线程一一对应
- [[Spring 基础与 IoC]] — 单例 Bean 在多线程下的安全隐患
