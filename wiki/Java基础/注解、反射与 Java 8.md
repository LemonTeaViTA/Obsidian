---
module: Java基础
tags: [Java, 反射, 注解, Lambda, Stream]
difficulty: hard
last_reviewed: 2026-04-20
---

# 注解、反射与 Java 8
## 注解与反射

### 说一下你对注解的理解？

**答案：**

注解本质是“元数据标记”，用于在编译期或运行期驱动行为。

常见生命周期：

- `SOURCE`：仅编译期。
- `CLASS`：保留到字节码，运行期默认不可见。
- `RUNTIME`：运行时可通过反射读取。

典型场景：[[AOP 与动态代理|AOP]]、依赖注入、代码生成（如 Lombok）。

---

### 什么是反射？应用？原理？

**答案：**

反射允许在运行时检查并操作类信息（字段、方法、构造器）。

典型应用：

- Spring 容器与依赖注入。
- [[AOP 与动态代理|动态代理]]/AOP。
- 测试框架自动发现并执行测试方法。

原理要点：类加载后，类型元数据进入 JVM 运行时区域；反射 API 基于这些元数据执行动态访问。

---

## Java 8 新特性

### JDK 1.8 有哪些新特性？

**答案：**

高频特性：

- Lambda 表达式。
- 接口默认方法与静态方法。
- Stream API。
- 新日期时间 API（`java.time`）。
- `Optional`。

---

### Lambda 表达式了解多少？

**答案：**

Lambda 是函数式接口实例的简写形式，核心作用是让行为参数化，减少样板代码。

常与 Stream 一起使用，如 `filter/map/reduce`。

---

### Optional 了解吗？

**答案：**

`Optional` 用于表达“值可能为空”，降低空指针风险。

常用方法：

- `isPresent()`
- `orElse(...)`
- `ifPresent(...)`
- `map(...)`

---

### Stream 流用过吗？

**答案：**

`Stream` 是面向集合处理的声明式 API。

- 中间操作：`filter/sorted/map/distinct` 等。
- 终端操作：`forEach/count/reduce/collect` 等。

优势是链式表达清晰、可读性强，并可结合并行流优化部分计算场景。

---

## 相关链接

- [[面向对象]] — 反射基于 Class 对象
- [[AOP 与动态代理]] — JDK 动态代理基于反射实现
- [[Spring 基础与 IoC]] — Spring 依赖注入基于反射
- [[JVM 类加载机制]] — 反射涉及类加载过程
