---
aliases:
  - 集合框架
  - Java Collections
tags:
  - java/集合框架
  - MOC
---

# Java 集合框架 MOC (Map of Content)

这里是 Java 集合框架（Collections Framework）的知识索引地图。集合框架是 Java 面试中极其庞大、核心且考察频率最高的数据结构体系。

为了避免知识碎片化或者单文件过于臃肿，我们采用了**主题聚类（Concept-Cluster）**的方式对该体系进行了知识点的合理拆解，帮助你建立宏观认知和系统性学习。

---

## 🗺️ 知识体系导航

建议按照以下顺序进行系统学习和复习：

 宏观认知
了解 Java 集合的整体派系（Collection 分支与 Map 分支）、常用辅助工具类（Collections、Arrays）、线程安全容器一览，以及基本的队列与栈的概念。
👉 **[[集合框架概述]]**

 Collection 支线：List 体系
深入研究动态数组和链表的核心区别，死磕 ArrayList 的底层扩容机制、序列化策略（transient 关键字的应用），理解迭代器的并发现象（fail-fast 与 fail-safe）以及如何解决 List 的线程安全问题（CopyOnWriteArrayList）。
👉 **[[List体系]]**

 Map 支线：树状与有序结构
在死磕最高频的 HashMap 之前，先理解红黑树这种弱平衡二叉树的精妙设计（为什么要放弃普通二叉树和严格的 AVL 树），以及如何利用额外的数据结构来实现元素的有序性（LinkedHashMap 的双向链表，TreeMap 的比较器/自然排序）。
👉 **[[Map与红黑树]]**

 👑 Map 支线：死磕 HashMap 核心原理
**Java 面试中的重灾区，考察频率最高的数据结构。**
彻底搞懂它的“数组+链表+红黑树”的黄金三角底层；理解哈希计算中的高低位扰动函数设计原理；掌握极其优雅的位运算寻址（为什么容量必须是 2 的幂次方）；深度拆解 `put` 与扩容 `resize` 流程（JDK7 头插法循环死锁 vs JDK8 尾插法优化）。
👉 **[[HashMap核心原理]]**

 Collection 支线：Set 体系与 HashSet
理解 Set 体系无序且去重的本质特性。探索著名的“马甲”设计：HashSet 是如何不动声色地借用 HashMap 的底层结构（把值当作 Key 加入 HashMap），通过 `hashCode` 和 `equals` 的联合校验来完美实现元素去重和拒绝冗余插入的。
👉 **[[Set体系与HashSet]]**

---

> **学习笔记提示**：
> 集合框架的学习核心在于理解**空间与时间的博弈**，比如从“数组”到“链表”，再到为解决冲突引入的“红黑树”兜底策略，每一次结构的演进，都是为了在不同应用场景下获取最优的增删查改的平衡。