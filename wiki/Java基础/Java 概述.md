---
module: Java基础
tags: [Java, 基础, JVM, 跨平台]
difficulty: easy
last_reviewed: 2026-05-08
---

# Java 概述

## JVM、JRE、JDK 的区别

### 三者是什么关系？

**答案：**

==包含关系：JDK ⊃ JRE ⊃ JVM==

```
┌─────────────────────────────────────────────┐
│  JDK (Java Development Kit)                 │
│  开发工具：javac, jdb, jconsole, jmap...    │
│  ┌───────────────────────────────────────┐  │
│  │  JRE (Java Runtime Environment)       │  │
│  │  核心类库：rt.jar, charsets.jar...    │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │  JVM (Java Virtual Machine)     │  │  │
│  │  │  类加载器 + 运行时数据区 + 执行引擎│  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

| 名称 | 职责 | 核心组成 |
|------|------|----------|
| JVM | 加载并执行字节码 | 类加载子系统、运行时数据区、执行引擎（解释器 + JIT） |
| JRE | 提供运行时环境 | JVM + Java 核心类库（java.lang, java.util 等） |
| JDK | 提供完整开发能力 | JRE + 编译器(javac) + 调试/监控工具(jps, jstack, jmap...) |

> [!warning] JDK 9+ 变化
> 从 JDK 9 开始引入模块化（JPMS），Oracle 不再单独发行 JRE。现在可以用 `jlink` 按需打包自定义运行时镜像，只包含应用实际用到的模块。

---

## Java 跨平台原理

### 为什么说 Java 是"一次编译，到处运行"？

**答案：**

完整的编译执行链路：

```
.java 源文件
    │ javac（前端编译器）
    ▼
.class 字节码（平台无关的中间表示）
    │ 类加载器加载到 JVM
    ▼
┌─────────────────────────────────┐
│         JVM 执行引擎             │
│  ┌───────────┐  ┌────────────┐  │
│  │ 解释器     │  │ JIT 编译器  │  │
│  │ 逐条翻译   │  │ 热点代码    │  │
│  │ 启动快     │  │ 编译为本地  │  │
│  │ 效率低     │  │ 机器码缓存  │  │
│  └───────────┘  └────────────┘  │
└─────────────────────────────────┘
    │
    ▼
本地机器码（平台相关）
```

==核心思想==：字节码是平台无关的，JVM 是平台相关的。不同操作系统有各自的 JVM 实现，负责将相同的字节码翻译为对应平台的机器码。

**解释执行 vs JIT 编译：**

| 方式 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| 解释执行 | 逐条将字节码翻译为机器码 | 启动快，无需等待编译 | 运行效率低 |
| JIT 编译 | 检测热点代码，整体编译为本地机器码并缓存 | 运行效率接近 C/C++ | 首次编译有开销 |

HotSpot JVM 采用==混合模式==：启动时解释执行，运行中 JIT 对热点方法进行编译优化（方法计数器 + 回边计数器判定热点）。

> [!tip] 延伸：AOT 编译
> GraalVM 的 `native-image` 支持 AOT（Ahead-Of-Time）编译，直接将 Java 代码编译为本地可执行文件，启动时间可达毫秒级，适合 Serverless 和 CLI 工具场景。代价是失去了运行时优化能力和部分反射/动态代理支持。

---

## Java 版本演进

### 各 LTS 版本的核心特性？

**答案：**

| 版本 | 年份 | 核心特性 | 对开发的实际影响 |
|------|------|----------|-----------------|
| Java 5 | 2004 | 泛型、注解、枚举、自动装箱 | 类型安全 + 框架注解驱动的基础 |
| **Java 8** | 2014 | Lambda、Stream、Optional、新日期API | ==函数式编程范式==，彻底改变集合操作方式 |
| Java 11 | 2018 | HttpClient、var局部推断、ZGC实验 | 第一个非 Oracle 免费商用的 LTS |
| **Java 17** | 2021 | sealed class、pattern matching、Records | ==当前企业主流==，Spring Boot 3.x 最低要求 |
| **Java 21** | 2023 | 虚拟线程、结构化并发、Record Patterns | ==并发编程革命==，一个线程成本约 1KB |

**Java 8 为什么是分水岭：**

```java
// Java 8 之前：匿名内部类，冗长
List<String> filtered = new ArrayList<>();
for (String s : list) {
    if (s.length() > 3) filtered.add(s);
}
Collections.sort(filtered, new Comparator<String>() {
    @Override
    public int compare(String a, String b) { return a.compareTo(b); }
});

// Java 8 之后：Stream + Lambda，声明式
List<String> filtered = list.stream()
    .filter(s -> s.length() > 3)
    .sorted()
    .collect(Collectors.toList());
```

**Java 21 虚拟线程为什么重要：**

```java
// 传统线程：每个线程占用 ~1MB 栈空间，万级并发就是瓶颈
ExecutorService pool = Executors.newFixedThreadPool(200);  // 最多 200 并发

// 虚拟线程：每个约 1KB，轻松百万级并发
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 1_000_000; i++) {
        executor.submit(() -> {
            // 每个任务一个虚拟线程，阻塞时自动让出载体线程
            Thread.sleep(Duration.ofSeconds(1));
            return "done";
        });
    }
}
```

> [!warning] Java 8 → 17 迁移常见坑
> - 模块化（JPMS）：`--add-opens` / `--add-exports` 解决反射访问限制
> - `javax.*` → `jakarta.*`：Java EE 移交 Eclipse 后包名变更
> - 移除 Nashorn JS 引擎、JavaFX、CORBA
> - `sun.misc.Unsafe` 部分方法受限，需用 VarHandle 替代

---

## Java vs 其他语言

### Java 和 Go/C++/Python 相比有什么优劣？

**答案：**

| 维度 | Java | Go | C++ | Python |
|------|------|-----|-----|--------|
| 内存管理 | GC 自动回收 | GC 自动回收 | 手动管理 | GC 自动回收 |
| 并发模型 | 线程 + 虚拟线程(21+) | goroutine（轻量） | std::thread | GIL 限制多线程 |
| 性能 | JIT 优化后接近 C++ | 编译型，略低于 C++ | 最高 | 最低（解释型） |
| 启动速度 | 慢（JVM 预热） | 快（编译为二进制） | 快 | 中等 |
| 生态 | 企业级最成熟 | 云原生/中间件 | 系统/游戏/嵌入式 | AI/数据/脚本 |
| 类型系统 | 静态强类型 | 静态强类型 | 静态强类型 | 动态强类型 |

> [!tip] 面试怎么答"为什么选 Java"
> 不要泛泛而谈。结合场景：
> - 企业后端：生态成熟（Spring 全家桶）、人才多、长期维护成本低
> - 高并发：线程模型完善，Java 21 虚拟线程补齐了 Go goroutine 的优势
> - 大数据：Hadoop/Spark/Flink 生态都是 Java/Scala
> - 劣势要诚实说：启动慢（对比 Go）、内存占用高（对比 Rust/C++）、语法冗长（对比 Kotlin）

---

## 相关链接

- [[基础语法]] — 数据类型、运算符、流程控制
- [[面向对象]] — 封装、继承、多态、抽象类与接口
- [[JVM 概述]] — JVM 架构与运行时数据区详解
- [[JVM 内存管理]] — 堆、栈、方法区的内存分配
- [[JVM 类加载机制]] — 类加载的完整流程
- [[注解、反射与 Java 8]] — Lambda、Stream、反射机制
- [[并发编程索引_MOC]] — Java 并发体系总览
