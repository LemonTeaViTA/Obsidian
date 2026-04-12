---
aliases:
  - Spring
  - SpringBoot
tags:
  - java/spring
  - MOC
---

# Spring 篇 MOC (Map of Content)

这里是 Spring 框架与其生态的知识索引地图。Spring 早已不仅仅是个框架，它是全套 Java 企业级开发的标准和骨骼，核心考察其设计思潮：IoC 与 AOP。

由于 Spring 概念极其抽象且源码极其复杂，我们基于**主题聚类（Concept-Cluster）**将其内容做了系统的分拆，让你不再纠结于源码的繁文缛节，而是快速抓住面试和工程中所需的主线。

---

## 🗺️ 知识体系导航

建议按照以下顺序进行系统学习和复习：

 核心重灾区：底层思想 IoC（控制反转）与基础
**Spring 面试第一重难点。**
了解 Spring 为什么要这么设计，它的依赖注入（DI）机制和注解究竟干了什么。深究 BeanFactory、ApplicationContext 的生命周期循环（生与死）；以及如何巧妙运用**三级缓存**去化解极其痛苦的“循环依赖”。
👉 **[[Spring 基础与 IoC]]**

 核心重灾区：底层思想 AOP（面向切面）与动态代理
**Spring 面试第二重难点。**
彻底理解把横切逻辑（日志、事务）与核心业务彻底抽离的精妙之处；死磕 JDK 动态代理与 CGLIB 的底层抉择逻辑（接口 VS 类）。
👉 **[[AOP 与动态代理]]**

 👑 核心重灾区：Spring 事务机制
非常高频的异常排查题与设计题！
深刻领会 `@Transactional` 为什么在某些类内部调用或者方法权限不对时会神秘“失效”；搞懂 Spring 定义的四大特性、七大传播行为（Propagation）以及各级别的事务隔离控制。
👉 **[[Spring 事务]]**

 Spring MVC 交互与调度
Web 开发的老牌功臣。清晰说出 HandlerMapping、HandlerAdapter 和 ViewResolver 等核心组件构成的一条完整处理链条与响应策略。
👉 **[[Spring MVC 架构]]**

 Spring Boot 与微服务思潮
为什么我们放弃了重度的 Spring XML 抛奔了 Spring Boot？剖析 Boot “约定大于配置”的核心机制——`@EnableAutoConfiguration` 的底层运作（SPI 机制的变种）；以及它启动原理论及 Starter 组件是如何自定义的。
👉 **[[Spring Boot 与微服务]]**

---

> **学习笔记提示**：
> Spring 的重点不是死记某一个 API 接口，而是要在脑海中建立起**框架如何利用反射和代理对你的普通代码进行“增强”与“挂载”**的动态过程（例如事务是如何无感切入你的普通方法的）。
