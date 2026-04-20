---
module: Spring
tags: [Spring, SpringMVC, DispatcherServlet, RESTful]
difficulty: medium
last_reviewed: 2026-04-20
---

# Spring MVC 架构

## 核心组件

### Spring MVC 的核心组件有哪些？

**前端控制器 DispatcherServlet**：这是 Spring MVC 的入口和核心调度器。当一个 HTTP 请求到达服务器时，首先由 DispatcherServlet 接收，负责将请求分发到合适的处理器，并协调其他组件的工作。在 Spring Boot 项目中，DispatcherServlet 的启动是通过自动配置完成的。

**处理器映射 HandlerMapping**：当一个请求进来时，前端控制器会询问处理器映射："这个 URL 应该由哪个 Controller 的哪个方法来处理？"然后它就会根据 `@RequestMapping`、`@GetMapping` 这些注解来匹配请求。

**处理器 Handler**：实际上就是我们写的 Controller 方法，这是真正处理业务逻辑的地方。

**处理器适配器 HandlerAdapter**：负责调用该处理器的方法，并处理参数绑定、类型转换等。因为处理器可能有不同的类型，处理器适配器就是为了统一调用方式。

**视图解析器 ViewResolver**：处理完业务逻辑后，如果需要渲染视图，ViewResolver 会根据返回的视图名称解析实际的视图对象。在前后端分离的项目中，这个组件更多用于返回 JSON 数据。

**异常处理器 HandlerExceptionResolver**：捕获并处理请求处理过程中抛出的异常。通常，我们可以通过 `@ControllerAdvice` 和 `@ExceptionHandler` 来自定义异常处理逻辑。

除此之外，还有文件上传解析器 MultipartResolver，用于处理文件上传请求；拦截器 HandlerInterceptor，用于在请求处理前后执行一些额外的逻辑，比如权限校验、日志记录等。

### 🌟Spring MVC 的工作流程了解吗？

简单来说，Spring MVC 是一个基于 Servlet 的请求处理框架，核心流程可以概括为：请求接收 → 路由分发 → 控制器处理 → 视图解析。

1. 用户发起的 HTTP 请求，首先会被 DispatcherServlet 捕获，起到统一入口的作用。
2. DispatcherServlet 接收到请求后，会根据 URL、请求方法等信息，交给 HandlerMapping 进行路由匹配，查找对应的处理器，也就是 Controller 中的具体方法。
3. 找到对应 Controller 方法后，DispatcherServlet 会委托给处理器适配器 HandlerAdapter 进行调用。处理器适配器负责执行方法本身，并处理参数绑定、数据类型转换等，把请求参数自动注入到方法形参中。
4. Controller 方法最终会返回结果，比如视图名称、ModelAndView 或直接返回 JSON 数据。
5. 当 Controller 方法返回视图名时，DispatcherServlet 会调用 ViewResolver 将其解析为实际的 View 对象。在前后端分离的接口项目中，这一步则通常是返回 JSON 数据。
6. 最后，由 View 对象完成渲染，或者将 JSON 结果直接通过 DispatcherServlet 返回给客户端。

#### 为什么还需要 HandlerAdapter？

Spring MVC 支持多种风格的处理器，比如基于 `@Controller` 注解的处理器、实现了 Controller 接口的处理器等。如果没有处理器适配器，DispatcherServlet ���需要硬编码每种处理器的调用方式，新增一种 Controller 类型，就必须改 DispatcherServlet 的代码。

因此，Spring 引入了 HandlerAdapter 作为适配器，屏蔽不同控制器的差异，给 DispatcherServlet 提供一个统一的调用入口。

### SpringMVC Restful 风格的接口流程是什么样的呢？

在传统的 MVC 中，Controller 方法通常返回一个视图名称或者 ModelAndView 对象，然后由视图解析器渲染成 HTML 页面。但在 RESTful 架构中，通常返回的是 JSON 或 XML，不再是一个完整的页面。

`@RestController` 相当于 `@Controller` 和 `@ResponseBody` 的结合。当在一个类上使用 `@RestController` 时，它会告诉 Spring 这个类中所有方法的返回值都应该被直接写入 HTTP 响应体中，而不再被解析为视图。

HttpMessageConverter 是实现 RESTful 风格的关键。当 Spring 检测到 `@ResponseBody` 注解时，它会使用 HttpMessageConverter 来将 Controller 方法返回的 Java 对象序列化成指定的格式，如 JSON。默认情况下，如果类路径下有 Jackson 库，Spring Boot 会自动配置 MappingJackson2HttpMessageConverter 来处理 JSON 的转换。

所以，RESTful 接口的流程可以概括为：请求到达 DispatcherServlet → 通过 HandlerMapping 找到对应的 Controller 方法 → 执行方法并返回数据 → 使用 HttpMessageConverter 将数据转换为 JSON 格式 → 直接写入 HTTP 响应体。RESTful 接口省略了 ViewResolver 和 View 的渲染过程，非常适合前后端分离的应用场景。

## 相关链接

- [[Spring 基础与 IoC]] — DispatcherServlet 由 Spring IoC 容器管理
- [[AOP 与动态代理]] — 拦截器 HandlerInterceptor 与 AOP 切面的区别
- [[Spring Boot 与微服务]] — Spring Boot 自动配置 DispatcherServlet
- [[Spring 事务]] — Controller 层通常不加事务，事务在 Service 层管理
