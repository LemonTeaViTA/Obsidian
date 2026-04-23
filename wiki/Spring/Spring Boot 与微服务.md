---
module: Spring
tags: [SpringBoot, 微服务, 自动装配, SpringCloud]
difficulty: medium
last_reviewed: 2026-04-20
---

# Spring Boot 与微服务

## Spring Boot

### 🌟介绍一下 SpringBoot？

Spring Boot 可以说是 Spring 生态的一个重大突破，它极大地简化了 Spring 应用的开发和部署过程。

以前我们用 Spring 开发项目的时候，需要配置一大堆 XML 文件，包括 Bean 的定义、数据源配置、事务配置等等，非常繁琐。而且还要手动管理各种 jar 包的依赖关系，很容易出现版本冲突的问题。Spring Boot 就是为了解决这些痛点而生的。

"约定大于配置"是 Spring Boot 最核心的理念。它预设了很多默认配置，比如默认使用内嵌的 Tomcat 服务器，默认的日志框架是 Logback 等等。这样，我们开发者就只需要关注业务逻辑，不用再纠结于各种配置细节。

自动装配也是 Spring Boot 的一大特色，它会根据项目中引入的依赖自动配置合适的 Bean。比如说，我们引入了 Spring Data JPA，Spring Boot 就会自动配置数据源；引入了 Spring Security，Spring Boot 就会自动配置安全相关的 Bean。

#### Spring Boot常用注解有哪些？

- `@SpringBootApplication`：这是 Spring Boot 的核心注解，它是一个组合注解，包含了 `@Configuration`、`@EnableAutoConfiguration` 和 `@ComponentScan`，标志着一个 Spring Boot 应用的入口。
- `@SpringBootTest`：用于测试 Spring Boot 应用的注解，它会加载整个 Spring 上下文，适合集成测试。

### 🌟Spring Boot的自动装配原理了解吗？

在 Spring Boot 中，开启自动装配的注解是 `@EnableAutoConfiguration`。Spring Boot 为了进一步简化，把这个注解包含到了 `@SpringBootApplication` 注解中。

当 main 方法运行的时候，Spring 会去类路径下找 `spring.factories` 这个文件，读取里面配置的自动配置类列表。

然后每个自动配置类内部，通常会有一个 `@Configuration` 注解，同时结合各种 `@Conditional` 注解来做条件控制。比如 `@ConditionalOnProperty` 注解来判断配置文件里有没有开启某个开关，来决定是否初始化对应的 Bean。

具体的执行过程可以总结为：Spring Boot 项目在启动时加载所有的自动配置类，然后逐个检查它们的生效条件，当条件满足时就实例化并创建相应的 Bean。

自动装配的执行时机是在 Spring 容器启动的时候，具体是在 ConfigurationClassPostProcessor 这个 BeanPostProcessor 中处理的，它会解析 `@Configuration` 类，包括通过 `@Import` 导入的自动配置类。

### 🌟如何自定义一个 SpringBoot Starter？

**第一步**，创建项目，SpringBoot 官方建议第三方 starter 的命名格式是 `xxx-spring-boot-starter`，包括两个模块：autoconfigure 模块（包含自动配置逻辑）和 starter 模块（只包含依赖声明）。

**第二步**，创建自动配置类：

```java
@Configuration
@EnableConfigurationProperties(MyStarterProperties.class)
public class MyServiceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public MyService myService(MyStarterProperties properties) {
        return new MyService(properties.getMessage());
    }
}
```

**第三步**，创建配置属性类：

```java
@ConfigurationProperties(prefix = "mystarter")
public class MyStarterProperties {
    private String message = "默认消息";

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
```

**第四步**，在 `src/main/resources/META-INF/spring.factories` 文件中注册自动配置类：

```
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
com.example.mystarter.autoconfigure.MyServiceAutoConfiguration
```

**第五步**，使用 Maven 打包，然后在其他 Spring Boot 项目中引入依赖即可使用。

#### Spring Boot Starter 的原理了解吗？

Starter 的核心思想是把相关的依赖打包在一起，让开发者只需要引入一个 starter 依赖，就能获得完整的功能模块。

当我们在 pom.xml 中引入一个 starter 时，Maven 就会自动解析这个 starter 的依赖树，把所有需要的 jar 包都下载下来。每个 starter 都会包含对应的自动配置类，这些配置类通过条件注解来判断是否应该生效。

`spring.factories` 文件是 Spring Boot 自动装配的核心，它位于每个 starter 的 META-INF 目录下，列出了所有的自动配置类，Spring Boot 在启动时会读取这个文件，加载对应的配置类。

### 🌟Spring Boot 启动原理了解吗？

Spring Boot 的启动主要围绕两个核心展开，一个是 `@SpringBootApplication` 注解，一个是 `SpringApplication.run()` 方法。

`@SpringBootApplication` 是一个组合注解，包含了：
- `@SpringBootConfiguration`：标记这个类是一个 Spring Boot 配置类
- `@EnableAutoConfiguration`：告诉 Spring Boot 可以进行自动配置
- `@ComponentScan`：扫描当前包及其子包下的组件，注册为 Bean

`SpringApplication.run()` 方法的内部流程大致可以分为 5 个步骤：

1. 创建 SpringApplication 实例，识别应用类型（Servlet Web 还是 WebFlux），准备监听器和初始化监听容器。
2. 创建并准备 ApplicationContext，将主类作为配置源进行加载。
3. 刷新 Spring 上下文，触发 Bean 的实例化，扫描并注册 `@ComponentScan` 指定路径下的 Bean。
4. 触发自动配置，在 Spring Boot 2.7 及之前是通过 `spring.factories` 加载的，3.x 是通过读取 `AutoConfiguration.imports`，并结合 `@ConditionalOn` 系列注解依据条件注册 Bean。
5. 如果引入了 Web 相关依赖，会创建并启动 Tomcat 容器，完成 HTTP 端口监听。

#### Spring Boot 默认的包扫描路径是什么？

Spring Boot 默认的包扫描路径是主类所在的包及其子包。比如说启动类 `Application` 所在的包是 `com.example.app`，那么 Spring Boot 默认会扫描 `com.example.app` 包及其子包下的所有组件。

### 说一下 SpringBoot 和 SpringMVC 的区别？

SpringMVC 是 Spring 的一个模块，专门用来做 Web 开发，处理 HTTP 请求和响应。而 Spring Boot 的目标是简化 Spring 应用的开发过程，可以通过 starter 的方式快速集成 SpringMVC。

传统的 Web 项目通常需要手动配置很多东西，比如 DispatcherServlet、ViewResolver、HandlerMapping 等等。而 Spring Boot 则通过自动装配的方式，帮我们省去了这些繁琐的配置。

Spring Boot 还内置了一个嵌入式的 Servlet 容器，比如 Tomcat，这样我们就不需要像传统的 Web 项目那样配置 Tomcat 容器然后导出 war 包再运行，只需要打包成一个 JAR 文件，就可以直接通过 `java -jar` 命令运行。

## Spring Cloud

### 对 SpringCloud 了解多少？

Spring Cloud 其实是一套基于 Spring Boot 的微服务全家桶，帮我们把分布式系统里的基础设施做了一个"拿来即用"的封装，比如服务注册与发现、配置管理、负载均衡、熔断限流、链路追踪这些。

常用的 Spring Cloud Alibaba 组件：
- **Nacos**：做服务注册和配置中心，支持动态刷新配置
- **Gateway**：做 API 网关，支持路由转发、全局过滤器、限流等功能
- **Sentinel**：做熔断、限流、降级策略
- **OpenFeign**：做服务间的声明式调用，比 RestTemplate 更省代码
- **Seata**：处理分布式事务，在订单、支付、审批流场景中用得比较多

Spring Cloud 最大的价值是统一了技术栈和编程模型，不需要我们去自己从零实现注册中心、熔断器这些基础设施。

### 什么是微服务？

微服务就是把一个大的、复杂的单体应用，拆成一个个围绕业务功能独立部署的小服务，每个服务维护自己的数据和逻辑，服务之间通过轻量级的通信机制（比如 gRPC）来协作。

微服务的核心价值是：业务之间的边界更清晰了，不同团队可以独立开发、部署、扩展某个功能，不会因为一个小的改动就要把整套系统重新上线。

### 为什么需要注册中心？

#### 没有注册中心会怎样？

微服务拆分后，服务 A 要调用服务 B，最简单的做法是把 B 的 IP 和端口硬编码在 A 的配置文件里。这在单机时代没问题，但在微服务场景下会崩：

- **IP 动态变化**：容器化部署（Docker/K8s）下，服务每次重启 IP 都可能变，硬编码立刻失效。
- **多实例负载均衡**：服务 B 可能有 10 个实例，硬编码只能写死一个，无法分流。
- **实例上下线感知**：某个实例挂了，调用方不知道，还在往死实例发请求，导致调用失败。

#### 注册中心解决了什么？

注册中心本质上是一个**服务地址的动态目录**，解决"服务在哪里"的问题：

1. **服务注册**：每个服务启动时，把自己的 IP、端口、服务名注册到注册中心。
2. **服务发现**：调用方启动时，从注册中心拉取目标服务的实例列表，本地缓存。
3. **健康检查**：注册中心定期心跳检测，实例挂掉后自动从列表中摘除，调用方感知到变更后更新本地缓存。

```
服务B实例1 ──注册──┐
服务B实例2 ──注册──┤  注册中心  ←── 服务A（拉取B的实例列表）
服务B实例3 ──注册──┘
```

#### 常见注册中心对比

| | Nacos | Eureka | Zookeeper |
|--|-------|--------|-----------|
| **一致性模型** | AP（默认）/ CP 可切换 | AP | CP |
| **健康检查** | 心跳 + 主动探测 | 心跳 | 临时节点自动失效 |
| **配置中心** | 支持 | 不支持 | 支持 |
| **推荐场景** | Spring Cloud Alibaba 首选 | 老项目 | 对一致性要求高 |

AP 模型（Nacos/Eureka）优先保证可用性，网络分区时仍能返回旧数据；CP 模型（Zookeeper）优先保证一致性，网络分区时会拒绝服务。微服务注册发现场景通常选 AP，因为短暂的数据不一致（拿到旧实例列表）比完全不可用代价更小。

### 注册中心挂了，整个服务会挂吗？怎么解决？

**不会立刻挂，但有风险窗口。** 核心保障是客户端本地缓存。

#### 为什么不会立刻挂？

服务启动时从注册中心拉取实例列表后，会**缓存在本地内存**里。注册中心挂了，调用方仍然用本地缓存的列表继续调用，存量的服务间通信不受影响。Nacos、Eureka 都有这个机制。

#### 真正的风险点

- **新服务无法注册**：注册中心挂了期间，新实例上线后调用方感知不到，无法参与流量分配。
- **实例下线无法感知**：某个实例挂了，注册中心无法通知调用方更新缓存，调用方可能还在往死实例发请求。

#### 完整的高可用方案

1. **注册中心集群部署**：Nacos 推荐 3 节点以上集群，挂掉一个节点不影响整体可用性。
2. **客户端本地缓存**：保证注册中心短暂不可用时存量流量不中断。
3. **熔断降级兜底**：结合 Sentinel/Hystrix，调用失败时快速熔断，避免雪崩。
4. **重试 + 健康检查**：调用失败时自动剔除本地缓存中的死实例，重试其他健康实例。

- [[Spring 基础与 IoC]] — Spring Boot 自动装配建立在 IoC 容器之上
- [[Spring MVC 架构]] — Spring Boot 自动配置 DispatcherServlet 和 MVC 组件
- [[AOP 与动态代理]] — Spring Boot Starter 中大量使用 AOP 实现切面功能
- [[Spring 事务]] — Spring Boot 通过自动配置简化事务管理器的注册
- [[Redis 基础]] — 微服务中 Redis 常用于分布式缓存和 Session 共享
- [[MySQL 基础与架构]] — 微服务中每个服务通常拥有独立的数据库
