---
module: Java基础
tags: [Java, 基础]
difficulty: easy
last_reviewed: 2026-04-20
---

# Java 概述
## Java 语言基础

### Java 语言有哪些主要特点？

**答案：**

1. **面向对象**：封装、继承、多态
2. **跨平台性**：一次编译，处处运行（JVM）
3. **自动内存管理**：GC 自动回收垃圾对象
4. **多线程支持**：内置多线程机制
5. **安全性**：字节码验证、沙箱机制
6. **健壮性**：强类型、异常处理、边界检查
7. **即时编译**：JIT 编译器
8. **丰富的类库**：Java API

**记忆口诀：** 面跨自多安健即类

---

## JVM 与跨平台

### JVM、JRE、JDK 三者有什么区别？

**答案：**

**包含关系：** JDK > JRE > JVM

| 名称 | 全称 | 作用 | 包含内容 |
|------|------|------|---------|
| JVM | Java Virtual Machine | 运行字节码 | 类加载器、运行时数据区、执行引擎 |
| JRE | Java Runtime Environment | 运行 Java 程序 | JVM + 核心类库 |
| JDK | Java Development Kit | 开发 Java 程序 | JRE + 开发工具（javac、java 等） |

---

### Java 跨平台原理是什么？

**答案：**

.java 源文件 → javac 编译 → .class 字节码（平台无关）→ JVM 解释/编译 → 机器码（平台相关）

**关键：** 字节码平台无关，JVM 平台相关。每个平台有自己的 JVM 实现，将相同的字节码转换为对应的机器码。

---

## 版本与生态

### Java 的发展历史？主要版本有哪些？

**答案：**

**重要版本：**
- Java 5（2004）：泛型、注解
- Java 7（2011）：try-with-resources
- **Java 8（2014）**：Lambda、Stream API（最经典）
- Java 11（2018）：LTS
- **Java 17（2021）**：LTS（当前主流）
- **Java 21（2023）**：LTS（虚拟线程）

**LTS 版本：** 8、11、17、21

---

### Java 的主要应用领域有哪些？

**答案：**

1. **企业级后端开发**：Spring Boot、微服务
2. **大数据处理**：Hadoop、Spark、Flink
3. **移动开发**：Android
4. **金融系统**：银行、证券、支付
5. **云计算**：Kubernetes、Dubbo
6. **嵌入式系统**：IoT 设备
7. **游戏开发**：服务器端、Minecraft

---

## 开发环境

### 如何配置 Java 开发环境？

**答案：**

1. 下载并安装 JDK（推荐 Java 17 或 21）
2. 配置环境变量：
   - JAVA_HOME = JDK 安装路径
   - PATH = %JAVA_HOME%\bin
3. 验证安装：`java -version`、`javac -version`
4. 安装 IDE（推荐 IntelliJ IDEA）
5. 配置 Maven（可选）

---

## 相关链接

- [[基础语法]] — Java 基础语法
- [[面向对象]] — Java 的三大特性
- [[JVM 概述]] — Java 程序的运行环境
- [[异常与 IO]] — Java 异常体系与 IO 模型
- [[注解、反射与 Java 8]] — Java 高级特性
