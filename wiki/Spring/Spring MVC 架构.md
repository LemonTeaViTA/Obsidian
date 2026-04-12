### Spring MVC 的核心组件有哪些？ 
 Spring MVC 作为 Spring 框架中处理 Web 请求的核心模块，它的设计遵循了经典的 MVC 模式，根据我的理解，它的核心组件主要包括： 
 前端控制器 DispatcherServlet，这是 Spring MVC 的入口和核心调度器。当一个 HTTP 请求到达服务器时，首先由 DispatcherServlet 接收。它负责将请求分发到合适的处理器，也就是 Controller 中的方法，并协调其他组件的工作。 
 
 在 Spring Boot 项目中，DispatcherServlet 的启动是通过自动配置完成的。Spring Boot 会自动注册一个默认的 DispatcherServlet，并将其映射到 / 。 
 @Bean 
 public ServletRegistrationBean < DispatcherServlet > dispatcherServletRegistration ( DispatcherServlet dispatcherServlet ) { 
 ServletRegistrationBean < DispatcherServlet > registration = new ServletRegistrationBean <>( dispatcherServlet , "/" ); // 默认映射路径为 "/" 
 registration . setName ( "dispatcherServlet" ); 
 return registration ; 
 } 
 处理器映射 HandlerMapping，当一个请求进来时，前端控制器会询问处理器映射：“这个 URL 应该由哪个 Controller 的哪个方法来处理？”然后它就会根据 @RequestMapping 、 @GetMapping 这些注解来匹配请求。 
 
 处理器 Handler，实际上就是我们写的 Controller 方法，这是真正处理业务逻辑的地方。 
 处理器适配器 HandlerAdapter，负责调用该处理器的方法，并处理参数绑定、类型转换等。因为处理器可能有不同的类型，比如注解方式、实现接口方式等，处理器适配器就是为了统一调用方式。 
 视图解析器 ViewResolver，处理完业务逻辑后，如果需要渲染视图，ViewResolver 会根据返回的视图名称解析实际的视图对象，比如 Thymeleaf。在前后端分离的项目中，这个组件更多用于返回 JSON 数据。 
 
 异常处理器 HandlerExceptionResolver，捕获并处理请求处理过程中抛出的异常。通常，我们可以通过 @ControllerAdvice 和 @ExceptionHandler 来自定义异常处理逻辑，确保返回友好的错误响应。 
 
 除此之外，还有文件上传解析器 MultipartResolver，用于处理文件上传请求；拦截器 HandlerInterceptor，用于在请求处理前后执行一些额外的逻辑，比如权限校验、日志记录等。 ### 🌟Spring MVC 的工作流程了解吗？ 
 简单来说，Spring MVC 是一个基于 Servlet 的请求处理框架，核心流程可以概括为：请求接收 → 路由分发 → 控制器处理 → 视图解析。 
 
 
 
 用户发起的 HTTP 请求，首先会被 DispatcherServlet 捕获，这是 Spring MVC 的“前端控制器”，负责拦截所有请求，起到统一入口的作用。 
 DispatcherServlet 接收到请求后，会根据 URL、请求方法等信息，交给 HandlerMapping 进行路由匹配，查找对应的处理器，也就是 Controller 中的具体方法。 
 
 找到对应 Controller 方法后，DispatcherServlet 会委托给处理器适配器 HandlerAdapter 进行调用。处理器适配器负责执行方法本身，并处理参数绑定、数据类型转换等。在注解驱动开发中，常用的是 RequestMappingHandlerAdapter。这一层会把请求参数自动注入到方法形参中，并调用 Controller 执行实际的业务逻辑。 
 
 Controller 方法最终会返回结果，比如视图名称、ModelAndView 或直接返回 JSON 数据。 
 当 Controller 方法返回视图名时，DispatcherServlet 会调用 ViewResolver 将其解析为实际的 View 对象，比如 Thymeleaf 页面。在前后端分离的接口项目中，这一步则通常是返回 JSON 数据。 
 最后，由 View 对象完成渲染，或者将 JSON 结果直接通过 DispatcherServlet 返回给客户端。 
 
 为什么还需要 HandlerAdapter？ 
 Spring MVC 支持多种风格的处理器，比如基于 @Controller 注解的处理器、实现了 Controller 接口的处理器等。如果没有处理器适配器，DispatcherServlet 就需要硬编码每种处理器的调用方式，框架就会变得非常僵硬——新增一种 Controller 类型，就必须改 DispatcherServlet 的代码。 
 因此，Spring 引入了 HandlerAdapter 作为适配器，屏蔽不同控制器的差异，给 DispatcherServlet 提供一个统一的调用入口。 
 比如说，如果是实现了 Controller 接口的处理器，DispatcherServlet 会使用 SimpleControllerHandlerAdapter 来适配它。 
 public class SimpleControllerHandlerAdapter implements HandlerAdapter { 
 
 	 @Override 
 	 public boolean supports ( Object handler ) { 
 		 return ( handler instanceof Controller ); 
 	 } 
 
 	 @Override 
 	 @Nullable 
 	 public ModelAndView handle ( HttpServletRequest request , HttpServletResponse response , Object handler ) 
 			 throws Exception { 
 
 		 return (( Controller ) handler ). handleRequest ( request , response ); 
 	 } 
 
 // ... 省略一个无关方法 ... 
 } 
 如果是使用 @RequestMapping 注解的处理器，DispatcherServlet 则会使用 RequestMappingHandlerAdapter 来适配。 
 public class RequestMappingHandlerAdapter implements HandlerAdapter { 
 @Override 
 public boolean supports ( Object handler ) { 
 return ( handler instanceof HandlerMethod ); 
 } 
 @Override 
 @Nullable 
 public ModelAndView handle ( HttpServletRequest request , HttpServletResponse response , Object handler ) 
 throws Exception { 
 HandlerMethod handlerMethod = ( HandlerMethod ) handler ; 
 // 执行方法并返回 ModelAndView 
 return invokeHandlerMethod ( handlerMethod , request , response ); 
 } 
 } ### SpringMVC Restful 风格的接口流程是什么样的呢？ 
 在传统的 MVC 中，Controller 方法通常返回一个视图名称或者 ModelAndView 对象，然后由视图解析器 ViewResolver 解析并渲染成 HTML 页面。但在 RESTful 架构中，通常返回的是 JSON 或 XML，不再是一个完整的页面。 
 其中很重要的两个注解： @RestController 相当于 @Controller 和 @ResponseBody 的结合。当在一个类上使用 @RestController 时，它会告诉 Spring 这个类中所有方法的返回值都应该被直接写入 HTTP 响应体中，而不再被解析为视图。 
 @ResponseBody 可以用在方法级别，作用相同。它标志着该方法的返回值将作为响应体内容，Spring 会跳过视图解析的步骤。 
 HttpMessageConverter 是实现 RESTful 风格的关键。当 Spring 检测到 @ResponseBody 注解时，它会使用 HttpMessageConverter 来将 Controller 方法返回的 Java 对象序列化成指定的格式，如 JSON。 
 默认情况下，如果类路径下有 Jackson 库，Spring Boot 会自动配置 MappingJackson2HttpMessageConverter 来处理 JSON 的转换。相应的，对于带有 @RequestBody 注解的方法参数，它也会用这个转换器将请求体中的 JSON 数据反序列化成 Java 对象。 
 
 所以，RESTful 接口的流程可以概括为：请求到达前端控制器 DispatcherServlet → 通过 HandlerMapping 找到对应的 Controller 方法 → 执行方法并返回数据 → 使用 HttpMessageConverter 将数据转换为 JSON 或 XML 格式 → 直接写入 HTTP 响应体。 
 
 总结来说，RESTful 接口的流程通过 @RestController 和 HttpMessageConverter “抄了近道”，省略了 ViewResolver 和 View 的渲染过程，直接将数据转换为指定的格式返回，非常适合前后端分离的应用场景。 
 
 
 
 
 
 Spring Boot
