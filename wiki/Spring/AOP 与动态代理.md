### 🌟说说什么是 AOP？ 
 AOP，也就是面向切面编程，简单点说，AOP 就是把一些业务逻辑中的相同代码抽取到一个独立的模块中，让业务逻辑更加清爽。 
 
 ----这部分面试中可以不背，方便大家理解 start---- 
 举个简单的例子，假设我们有很多个 Service 方法，每个方法都需要记录执行日志、检查权限、管理事务等等。如果没有 AOP 的话，我们可能需要在每个方法里都写这样的代码： 
 public void createUser ( User user ) { 
 log . info ( "开始执行createUser方法" ); 
 // 权限检查 
 if (! hasPermission ()) { 
 throw new SecurityException ( "无权限" ); 
 } 
 // 开启事务 
 transactionManager . begin (); 
 try { 
 // 真正的业务逻辑 
 userDao . save ( user ); 
 transactionManager . commit (); 
 log . info ( "createUser方法执行成功" ); 
 } catch ( Exception e ) { 
 transactionManager . rollback (); 
 log . error ( "createUser方法执行失败" , e ); 
 throw e ; 
 } 
 } 
 如果每个方法都这样写，代码就会变得非常臃肿，AOP 就是为了解决这个问题，它可以让我们把这些横切关注点（如日志、权限、事务等）从业务代码中抽取出来。 
 这样，我们就可以定义一个切面，在切面中统一处理这些横切关注点： 
 @Aspect 
 @Component 
 public class LoggingAspect { 
 @Before ( "execution(* com.example.service.*.*(..))" ) 
 public void logBefore ( JoinPoint joinPoint ) { 
 log . info ( "开始执行方法: " + joinPoint . getSignature (). getName ()); 
 } 
 @AfterReturning ( "execution(* com.example.service.*.*(..))" ) 
 public void logAfterReturning ( JoinPoint joinPoint ) { 
 log . info ( "方法执行成功: " + joinPoint . getSignature (). getName ()); 
 } 
 @AfterThrowing ( pointcut = "execution(* com.example.service.*.*(..))" , 
 throwing = "ex" ) 
 public void logAfterThrowing ( JoinPoint joinPoint , Throwable ex ) { 
 log . error ( "方法执行失败: " + joinPoint . getSignature (). getName (), ex ); 
 } 
 } 
 然后，业务代码就变得非常干净了： 
 public void createUser ( User user ) { 
 // 只需要关注业务逻辑，不需要关心日志、权限、事务等 
 userDao . save ( user ); 
 } 
 ----面试中可以不背，方便大家理解 end---- 
 从技术实现上来说，AOP 主要是通过动态代理来实现的。如果目标类实现了接口，就用 JDK 动态代理；如果没有实现接口，就用 CGLIB 来创建子类代理。代理对象会在方法执行前后插入我们定义的切面逻辑。 
 
 
 Spring AOP 有哪些核心概念？ 
 Spring AOP 是 AOP 的一个具体实现，我按照在工作/学习中理解的重要程度来说一下： 
 
 ①、 切面 ：我们定义的一个类，包含了要在什么时候、什么地方执行什么逻辑。比如我们定义一个日志切面，专门负责记录方法的执行情况。在 Spring 中，我们会用 @Aspect 注解来标识一个切面类。 
 ②、 切点 ：定义了在哪些地方应用切面逻辑。说白了就是告诉 Spring，我这个切面要在哪些方法上生效。比如我们可以定义一个切点表达式，让它匹配所有 Service 层的方法，或者匹配某个特定包下的所有方法。在 Spring 中用 @Pointcut 注解来定义，通常会写一些表达式，比如 execution( com.example.service..*(..)) 这样的。 
 ③、 通知 ：是切面中具体要执行的代码逻辑。它有几种类型： @Before 是在方法执行前执行， @After 是在方法执行后执行， @Around 是环绕通知，可以在方法执行前后都执行， @AfterReturning 是在方法正常返回后执行， @AfterThrowing 是在方法抛出异常后执行。我一般用得最多的是 @Around ，因为它最灵活，可以控制方法是否执行，也可以修改参数和返回值。 
 ④、 连接点 ：被拦截到的点，因为 Spring 只支持方法类型的连接点，所以在 Spring 中，连接点指的是被拦截到的方法，实际上连接点还可以是字段或者构造方法。 
 ⑤、 织入 ：是把切面逻辑应用到目标对象的过程。Spring AOP 是在运行时通过动态代理来实现织入的，当我们从 Spring 容器中获取 Bean 的时候，如果这个 Bean 需要被切面处理，Spring 就会返回一个代理对象给我们。 
 ⑥、 目标对象 ：被切面处理的对象，也就是我们平时写的 Service、Controller 等类。Spring AOP 会在目标对象上织入切面逻辑。 
 它们之间的逻辑关系图是这样的： 
 切面（Aspect）
 ├── 切入点（Pointcut）─── 定义在哪里执行
 └── 通知（Advice） ─── 定义何时执行什么
 ├── @Before
 ├── @After
 ├── @AfterReturning
 ├── @AfterThrowing
 └── @Around

目标对象（Target）──→ 代理对象（Proxy）──→ 织入（Weaving）
 ↑ ↓
连接点（Join Point） 客户端调用 
 
 
 Spring AOP 织入有哪几种方式？ 
 织入有三种主要方式，我按照它们的执行时机来说一下。 
 
 编译期织入是在编译 Java 源码的时候就把切面逻辑织入到目标类中。这种方式最典型的实现就是 AspectJ 编译器。它会在编译的时候直接修改字节码，把切面的逻辑插入到目标方法中。 
 // 源代码 
 @Aspect 
 public class LoggingAspect { 
 @Before ( "execution(* com.example.service.*.*(..))" ) 
 public void logBefore ( JoinPoint joinPoint ) { 
 System . out . println ( "方法执行前: " + joinPoint . getSignature (). getName ()); 
 } 
 } 
 
 @Service 
 public class UserService { 
 public void saveUser ( String username ) { 
 System . out . println ( "保存用户: " + username ); 
 } 
 } 
 这样生成的 class 文件就已经包含了切面逻辑，运行时不需要额外的代理机制。 
 // 编译器自动生成的代码 
 public class UserService { 
 public void saveUser ( String username ) { 
 // 织入的切面代码 
 System . out . println ( "方法执行前: saveUser" ); 
 
 // 原始业务代码 
 System . out . println ( "保存用户: " + username ); 
 } 
 } 
 编译期织入的优点是性能最好，因为没有代理的开销，但缺点是需要使用特殊的编译器，而且比较复杂，在 Spring 项目中用得不多。 
 类加载期织入是在 JVM 加载 class 文件的时候进行织入。这种方式通过 Java 的 Instrumentation API 或者自定义的 ClassLoader 来实现，在类被加载到 JVM 之前修改字节码。 
 public class WeavingClassLoader extends ClassLoader { 
 @Override 
 protected Class <?> findClass ( String name ) throws ClassNotFoundException { 
 byte [] classBytes = loadClassBytes ( name ); 
 
 // 在这里进行字节码织入 
 byte [] wovenBytes = weaveAspects ( classBytes ); 
 
 return defineClass ( name , wovenBytes , 0 , wovenBytes . length ); 
 } 
 
 private byte [] weaveAspects ( byte [] classBytes ) { 
 // 使用 ASM 或其他字节码操作库进行织入 
 return classBytes ; 
 } 
 } 
 AspectJ 的 Load-Time Weaving 就是这种方式的典型实现。它比编译期织入更灵活一些，但是配置相对复杂，需要在 JVM 启动参数中指定 Java agent，在 Spring 中也有支持，但用得不是特别多。 
 # JVM 启动参数 
 java -javaagent:aspectjweaver.jar -jar myapp.jar 
 运行时织入是我们在 Spring 中最常见的方式，也就是通过动态代理来实现。Spring AOP 采用的就是这种方式。当 Spring 容器启动的时候，如果发现某个 Bean 需要被切面处理，就会为这个 Bean 创建一个代理对象。如果目标类实现了接口，Spring 会使用 JDK 的动态代理技术。 
 // 接口 
 public interface UserService { 
 void saveUser ( String username ); 
 } 
 
 // 实现类 
 @Service 
 public class UserServiceImpl implements UserService { 
 @Override 
 public void saveUser ( String username ) { 
 System . out . println ( "保存用户: " + username ); 
 } 
 } 
 
 // Spring 自动创建的代理（伪代码） 
 public class UserServiceProxy implements UserService { 
 private UserService target ; 
 private List < Advisor > advisors ; 
 
 @Override 
 public void saveUser ( String username ) { 
 // 执行前置通知 
 for ( Advisor advisor : advisors ) { 
 if ( advisor . getPointcut (). matches ( this . getClass (). getMethod ( "saveUser" , String . class ))) { 
 advisor . getAdvice (). before (); 
 } 
 } 
 
 // 执行目标方法 
 target . saveUser ( username ); 
 
 // 执行后置通知 
 for ( Advisor advisor : advisors ) { 
 advisor . getAdvice (). after (); 
 } 
 } 
 } 
 如果目标类没有实现接口，就会使用 CGLIB 来创建一个子类作为代理。运行时织入的优点是实现简单，不需要特殊的编译器或 JVM 配置，缺点是有一定的性能开销，因为每次方法调用都要经过代理。 
 // 没有接口的类 
 @Service 
 public class OrderService { 
 public void createOrder ( String orderId ) { 
 System . out . println ( "创建订单: " + orderId ); 
 } 
 } 
 
 // CGLIB 生成的代理子类（伪代码） 
 public class OrderService$$EnhancerByCGLIB$$ 12345 extends OrderService { 
 private MethodInterceptor interceptor ; 
 
 @Override 
 public void createOrder ( String orderId ) { 
 // 通过 MethodInterceptor 执行切面逻辑 
 interceptor . intercept ( this , getMethod ( "createOrder" ), new Object []{ orderId }, 
 new MethodProxy () { 
 @Override 
 public Object invokeSuper ( Object obj , Object [] args ) { 
 return OrderService . super . createOrder (( String ) args [ 0 ]); 
 } 
 }); 
 } 
 } 
 Spring AOP 默认的织入方式就是运行时织入，使用起来非常简单，只需要加个 @Aspect 注解和相应的通知注解就可以了。虽然性能上不如编译期织入，但是对于大部分业务场景来说，这点性能开销是完全可以接受的。 
 // Spring AOP 的代理创建过程 
 @Configuration 
 @EnableAspectJAutoProxy // 启用 AOP 自动代理 
 public class AopConfig { 
 } 
 
 // Spring 内部的代理创建逻辑（简化版） 
 public class DefaultAopProxyFactory implements AopProxyFactory { 
 
 @Override 
 public AopProxy createAopProxy ( AdvisedSupport config ) { 
 if ( config . isOptimize () || config . isProxyTargetClass () || hasNoUserSuppliedProxyInterfaces ( config )) { 
 // 使用 CGLIB 代理 
 return new CglibAopProxy ( config ); 
 } else { 
 // 使用 JDK 动态代理 
 return new JdkDynamicAopProxy ( config ); 
 } 
 } 
 } 
 
 
 AspectJ 是什么？ 
 AspectJ 是一个 AOP 框架，它可以做很多 Spring AOP 干不了的事情，比如说编译时、编译后和类加载时织入切面。并且提供了很多复杂的切点表达式和通知类型。 
 
 Spring AOP 只支持方法级别的拦截，而且只能拦截 Spring 容器管理的 Bean。但是 AspectJ 可以拦截任何 Java 对象的方法调用、字段访问、构造方法执行、异常处理等等。 
 // Spring AOP 只能做到这些 
 @Aspect 
 @Component 
 public class SpringAopAspect { 
 // ✅ 可以拦截：public 方法调用 
 @Around ( "execution(public * com.example.service.*.*(..))" ) 
 public Object aroundPublicMethod ( ProceedingJoinPoint pjp ) { 
 return pjp . proceed (); 
 } 
 
 // ❌ 无法拦截：字段访问 
 // ❌ 无法拦截：构造函数 
 // ❌ 无法拦截：私有方法 
 // ❌ 无法拦截：静态方法 
 } 
 
 
 Spring AOP 有哪些通知方式？ 
 Spring AOP 提供了多种通知方式，允许我们在方法执行的不同阶段插入逻辑。常用的通知方式有： 
 
 前置通知 (@Before) 
 返回通知 (@AfterReturning) 
 异常通知 (@AfterThrowing) 
 后置通知 (@After) 
 环绕通知 (@Around) 
 
 
 前置通知是在目标方法执行之前执行的通知。这种通知比较简单，主要用来做一些准备工作，比如参数校验、权限检查、记录方法开始执行的日志等等。前置通知无法阻止目标方法的执行，也无法修改方法的参数，它只能在方法执行前做一些额外的操作。我们在项目中经常用它来记录操作日志，比如记录谁在什么时候调用了什么方法。 
 @Aspect 
 @Component 
 public class LoggingAspect { 
 @Before ( "execution(* com.example.service.*.*(..))" ) 
 public void logBefore ( JoinPoint joinPoint ) { 
 // 打印方法名和参数 
 System . out . println ( "调用方法: " + joinPoint . getSignature (). getName ()); 
 System . out . println ( "参数: " + Arrays . toString ( joinPoint . getArgs ())); 
 } 
 } 
 后置通知是在目标方法执行完成后执行的，不管方法是正常返回还是抛出异常都会执行。这种通知主要用来做一些清理工作，比如释放资源、记录方法执行完成的日志等等。需要注意的是，后置通知拿不到方法的返回值，也捕获不到异常信息，它就是纯粹的在方法执行后做一些收尾工作。 
 @Aspect 
 @Component 
 public class LoggingAspect { 
 @After ( "execution(* com.example.service.*.*(..))" ) 
 public void logAfter ( JoinPoint joinPoint ) { 
 // 打印方法执行完成的日志 
 System . out . println ( "方法执行完成: " + joinPoint . getSignature (). getName ()); 
 } 
 } 
 返回通知是在目标方法正常返回后执行的。这种通知可以获取到方法的返回值，我们可以在注解中指定 returning 参数来接收返回值。返回通知经常用来做一些基于返回结果的后续处理，比如缓存方法的返回结果、根据返回值发送通知等等。如果方法抛出异常的话，返回通知是不会执行的。 
 @Aspect 
 @Component 
 public class LoggingAspect { 
 @AfterReturning ( pointcut = "execution(* com.example.service.*.*(..))" , returning = "result" ) 
 public void logAfterReturning ( JoinPoint joinPoint , Object result ) { 
 // 打印方法执行完成的日志 
 System . out . println ( "方法执行完成: " + joinPoint . getSignature (). getName ()); 
 // 打印方法返回值 
 System . out . println ( "返回值: " + result ); 
 } 
 } 
 异常通知是在目标方法抛出异常后执行的。我们可以在注解中指定 throwing 参数来接收异常对象。异常通知主要用来做异常处理和记录，比如记录错误日志、发送告警、异常统计等等。需要注意的是，异常通知不能处理异常，异常还是会继续向上抛出。 
 @Aspect 
 @Component 
 public class LoggingAspect { 
 @AfterThrowing ( pointcut = "execution(* com.example.service.*.*(..))" , 
 throwing = "ex" ) 
 public void logAfterThrowing ( JoinPoint joinPoint , Throwable ex ) { 
 // 打印方法名和异常信息 
 System . out . println ( "方法执行异常: " + joinPoint . getSignature (). getName ()); 
 System . out . println ( "异常信息: " + ex . getMessage ()); 
 } 
 } 
 环绕通知是最强大也是我们用得最多的一种通知。它可以在方法执行前后都执行逻辑，而且可以控制目标方法是否执行，还可以修改方法的参数和返回值。环绕通知的方法必须接收一个 ProceedingJoinPoint 参数，通过调用其 proceed() 方法来执行目标方法。 
 技术派 项目中就主要是通过环绕通知来实现切面。 
 
 如果有多个切面，还可以通过 @Order 注解指定先后顺序，数字越小，优先级越高。代码示例如下： 
 @Aspect 
 @Component 
 public class WebLogAspect { 
 
 private final static Logger logger = LoggerFactory . getLogger ( WebLogAspect . class ); 
 
 @Pointcut ( "@annotation(cn.fighter3.spring.aop_demo.WebLog)" ) 
 public void webLog () {} 
 
 @Before ( "webLog()" ) 
 public void doBefore ( JoinPoint joinPoint ) throws Throwable { 
 // 开始打印请求日志 
 ServletRequestAttributes attributes = ( ServletRequestAttributes ) RequestContextHolder . getRequestAttributes (); 
 HttpServletRequest request = attributes . getRequest (); 
 // 打印请求相关参数 
 logger . info ( "========================================== Start ==========================================" ); 
 // 打印请求 url 
 logger . info ( "URL : {}" , request . getRequestURL (). toString ()); 
 // 打印 Http method 
 logger . info ( "HTTP Method : {}" , request . getMethod ()); 
 // 打印调用 controller 的全路径以及执行方法 
 logger . info ( "Class Method : {}.{}" , joinPoint . getSignature (). getDeclaringTypeName (), joinPoint . getSignature (). getName ()); 
 // 打印请求的 IP 
 logger . info ( "IP : {}" , request . getRemoteAddr ()); 
 // 打印请求入参 
 logger . info ( "Request Args : {}" , new ObjectMapper (). writeValueAsString ( joinPoint . getArgs ())); 
 } 
 
 @After ( "webLog()" ) 
 public void doAfter () throws Throwable { 
 // 结束后打个分隔线，方便查看 
 logger . info ( "=========================================== End ===========================================" ); 
 } 
 
 @Around ( "webLog()" ) 
 public Object doAround ( ProceedingJoinPoint proceedingJoinPoint ) throws Throwable { 
 //开始时间 
 long startTime = System . currentTimeMillis (); 
 Object result = proceedingJoinPoint . proceed (); 
 // 打印出参 
 logger . info ( "Response Args : {}" , new ObjectMapper (). writeValueAsString ( result )); 
 // 执行耗时 
 logger . info ( "Time-Consuming : {} ms" , System . currentTimeMillis () - startTime ); 
 return result ; 
 } 
 } 
 
 
 Spring AOP 发生在什么时候？ 
 Spring AOP 是在 Bean 的初始化阶段发生的，具体来说是在 Bean 生命周期的后置处理阶段。 
 在 Bean 实例化完成、属性注入完成之后，Spring 会调用所有 BeanPostProcessor 的 postProcessAfterInitialization 方法，AOP 代理的创建就是在这个阶段完成的。 
 
 
 
 简单总结一下 AOP 
 AOP，也就是面向切面编程，是一种编程范式，旨在提高代码的模块化。比如说可以将日志记录、事务管理等分离出来，来提高代码的可重用性。 
 AOP 的核心概念包括切面、连接点、通知、切点和织入等。 
 ① 像日志打印、事务管理等都可以抽离为切面，可以声明在类的方法上。像 @Transactional 注解，就是一个典型的 AOP 应用，它就是通过 AOP 来实现事务管理的。我们只需要在方法上添加 @Transactional 注解，Spring 就会在方法执行前后添加事务管理的逻辑。 
 ② Spring AOP 是基于代理的，它默认使用 JDK 动态代理和 CGLIB 代理来实现 AOP。 
 ③ Spring AOP 的织入方式是运行时织入，而 AspectJ 支持编译时织入、类加载时织入。 
 
 
 AOP和 OOP 的关系？ 
 AOP 和 OOP 是互补的编程思想： 
 
 OOP 通过类和对象封装数据和行为，专注于核心业务逻辑。 
 AOP 提供了解决横切关注点（如日志、权限、事务等）的机制，将这些逻辑集中管理。 ### 🌟AOP的应用场景有哪些？ 
 答：AOP 在实际工作/编码学习中有很多应用场景，我按照使用频率来说说几个主要的。 
 事务管理是用得最多的场景，基本上每个项目都会用到。只需要在 Service 方法上加个 @Transactional 注解，Spring 就会自动帮我们管理事务的开启、提交和回滚。 
 
 日志记录也是一个很常见的应用。在 技术派实战项目 中，就利用了 AOP 来打印接口的入参和出参日志、执行时间，方便后期 bug 溯源和性能调优。 
 
 ----这部分面试可以不背，方便大家理解 start---- 
 第一步，定义 @MdcDot 注解： 
 @Target ({ ElementType . METHOD , ElementType . TYPE }) 
 @Retention ( RetentionPolicy . RUNTIME ) 
 @Documented 
 public @interface MdcDot { 
 String bizCode () default "" ; 
 } 
 第二步，配置 MdcAspect 切面，拦截带有 @MdcDot 注解的方法或类，在方法执行前后进行 MDC 操作，记录方法执行耗时。 
 
 第三步，在需要的地方加上 @MdcDot 注解。 
 
 第四步，当接口被调用时，就可以看到对应的执行日志。 
 2023-06-16 11:06:13,008 [http-nio-8080-exec-3] INFO |00000000.1686884772947.468581113|101|c.g.p.forum.core.mdc.MdcAspect.handle(MdcAspect.java:47) - 方法执行耗时: com.github.paicoding.forum.web.front.article.rest.ArticleRestController#recommend = 47 
 ----面试可以不背，方便大家理解 end---- 
 除此之外，还有权限控制、性能监控、缓存处理等场景。总的来说，任何需要在多个地方重复执行的通用逻辑，都可以考虑用 AOP 来实现。 ### 说说 Spring AOP 和 AspectJ 区别? 
 Spring AOP 只支持方法级别的织入，而且只能拦截 Spring 容器管理的 Bean。但是 AspectJ 几乎可以织入任何地方，包括方法、字段、构造方法、异常处理等等。 
 
 从实现机制上来说，Spring AOP 是基于动态代理实现的，在运行时为目标对象创建代理，通过代理来执行切面逻辑。而 AspectJ 是通过字节码织入来实现的，它直接修改目标类的字节码，把切面逻辑编织到目标方法中。 
 在实际项目中，我们大部分时候用的都是 Spring AOP，因为它能满足绝大多数需求，而且使用简单。只有在遇到 Spring AOP 无法解决的问题时，比如需要织入第三方 jar 包中的方法，或者监控字段才会考虑引入 AspectJ。 
 Spring AOP 借鉴了很多 AspectJ 的概念和注解，我们在 Spring 中使用的 @Aspect 、 @Pointcut 这些注解，其实都是 AspectJ 定义的。 ### 说说 AOP 和反射的区别？（补充） 
 
 2024 年 7 月 27 日增补。 
 
 反射主要是为了让程序能够检查和操作自身的结构，比如获取类的信息、调用方法、访问字段等等。而 AOP 则是为了在不修改业务代码的前提下，动态地为方法添加额外的行为，比如日志记录、事务管理等。 
 从技术实现来说，反射是 Java 语言本身提供的功能，通过 java.lang.reflect 包下的 API 来实现。而 AOP 通常需要框架支持，比如 Spring AOP 是通过动态代理实现的，而动态代理又是基于反射实现的。 ### 🌟说说JDK动态代理和CGLIB代理的区别？ 
 JDK 动态代理和 CGLIB 代理是 Spring AOP 用来创建代理对象的两种方式。 
 
 从使用条件来说，JDK 动态代理要求目标类必须实现至少一个接口，因为它是基于接口来创建代理的。而 CGLIB 代理不需要目标类实现接口，它是通过继承目标类来创建代理的。 
 这是两者最根本的区别。比如我们有一个 TransferService 接口和 TransferServiceImpl 实现类，如果用 JDK 动态代理，创建的代理对象会实现 TransferService 接口； 
 
 如果用 CGLIB，代理对象会继承 TransferServiceImpl 类。 
 
 从实现原理来说，JDK 动态代理是 Java 原生支持的，它通过反射机制在运行时动态创建一个实现了指定接口的代理类。当我们调用代理对象的方法时，会被转发到 InvocationHandler 的 invoke 方法中，我们可以在这个方法里插入切面逻辑，然后再通过反射调用目标对象的真实方法。 
 public class JdkProxyExample { 
 public static void main ( String [] args ) { 
 UserService target = new UserServiceImpl (); 
 
 UserService proxy = ( UserService ) Proxy . newProxyInstance ( 
 target . getClass (). getClassLoader (), 
 target . getClass (). getInterfaces (), 
 ( proxy1 , method , args1 ) -> { 
 System . out . println ( "Before method: " + method . getName ()); 
 Object result = method . invoke ( target , args1 ); 
 System . out . println ( "After method: " + method . getName ()); 
 return result ; 
 } 
 ); 
 
 proxy . findUser ( 1L ); 
 } 
 } 
 CGLIB 则是一个第三方的字节码生成库，它通过 ASM 字节码框架动态生成目标类的子类，然后重写父类的方法来插入切面逻辑。 
 public class CglibProxyExample { 
 public static void main ( String [] args ) { 
 Enhancer enhancer = new Enhancer (); 
 enhancer . setSuperclass ( UserController . class ); 
 enhancer . setCallback ( new MethodInterceptor () { 
 @Override 
 public Object intercept ( Object obj , Method method , Object [] args , MethodProxy proxy ) throws Throwable { 
 System . out . println ( "Before method: " + method . getName ()); 
 Object result = proxy . invokeSuper ( obj , args ); 
 System . out . println ( "After method: " + method . getName ()); 
 return result ; 
 } 
 }); 
 
 UserController proxy = ( UserController ) enhancer . create (); 
 proxy . getUser ( 1L ); 
 } 
 } 
 
 选择 CGLIB 还是 JDK 动态代理？ 
 如果目标对象没有实现任何接口，就只能使用 CGLIB 代理，就比如说 Controller 层的类。 
 // 没有实现接口的Controller 
 @RestController 
 public class ArticleController { 
 @MdcDot ( bizCode = "article.create" ) 
 public ResponseVo < String > create ( @RequestBody ArticleReq req ) { 
 // 业务逻辑 
 } 
 } 
 如果目标对象实现了接口，通常首选 JDK 动态代理，比如说 Service 层的类，一般都会先定义接口，再实现接口。 
 // 接口定义 
 public interface ArticleService { 
 void saveArticle ( Article article ); 
 } 
 
 // 实现类 
 @Service 
 public class ArticleServiceImpl implements ArticleService { 
 @Transactional ( rollbackFor = Exception . class ) 
 @Override 
 public void saveArticle ( Article article ) { 
 // 业务逻辑 
 } 
 } 
 在 Spring Boot 2.0 之后，Spring AOP 默认使用 CGLIB 代理。这是因为 Spring Boot 作为一个追求“约定优于配置”的框架，选择 CGLIB，可以简化开发者的心智负担，避免因为忘记实现接口而导致 AOP 不生效的问题。 
 
 
 
 你会用 JDK 动态代理吗？ 
 会的。 
 假设我们有这样一个小场景，客服中转，解决用户问题： 
 
 我们可以用 JDK 动态代理来实现这个场景。JDK 动态代理的核心是通过反射机制在运行时创建一个实现了指定接口的代理类。 
 
 第一步，创建接口。 
 public interface ISolver { 
 void solve (); 
 } 
 第二步，实现接口。 
 public class Solver implements ISolver { 
 @Override 
 public void solve () { 
 System . out . println ( "疯狂掉头发解决问题……" ); 
 } 
 } 
 第三步，使用用反射生成目标对象的代理，这里用了一个匿名内部类方式重写 InvocationHandler 方法。 
 public class ProxyFactory { 
 
 // 维护一个目标对象 
 private Object target ; 
 
 public ProxyFactory ( Object target ) { 
 this . target = target ; 
 } 
 
 // 为目标对象生成代理对象 
 public Object getProxyInstance () { 
 return Proxy . newProxyInstance ( target . getClass (). getClassLoader (), target . getClass (). getInterfaces (), 
 new InvocationHandler () { 
 @Override 
 public Object invoke ( Object proxy , Method method , Object [] args ) throws Throwable { 
 System . out . println ( "请问有什么可以帮到您？" ); 
 
 // 调用目标对象方法 
 Object returnValue = method . invoke ( target , args ); 
 
 System . out . println ( "问题已经解决啦！" ); 
 return null ; 
 } 
 }); 
 } 
 } 
 第四步，生成一个代理对象实例，通过代理对象调用目标对象方法。 
 public class Client { 
 public static void main ( String [] args ) { 
 //目标对象:程序员 
 ISolver developer = new Solver (); 
 //代理：客服小姐姐 
 ISolver csProxy = ( ISolver ) new ProxyFactory ( developer ). getProxyInstance (); 
 //目标方法：解决问题 
 csProxy . solve (); 
 } 
 } 
 
 
 你会用 CGLIB 动态代理吗？ 
 会的。 
 
 第一步：定义目标类 Solver，定义 solve 方法，模拟解决问题的行为。目标类不需要实现任何接口，这与 JDK 动态代理的要求不同。 
 public class Solver { 
 
 public void solve () { 
 System . out . println ( "疯狂掉头发解决问题……" ); 
 } 
 } 
 第二步：创建代理工厂 ProxyFactory，使用 CGLIB 的 Enhancer 类来生成目标类的子类（代理对象）。CGLIB 允许我们在运行时动态创建一个继承自目标类的代理类，并重写目标方法。 
 public class ProxyFactory implements MethodInterceptor { 
 
 //维护一个目标对象 
 private Object target ; 
 
 public ProxyFactory ( Object target ) { 
 this . target = target ; 
 } 
 
 //为目标对象生成代理对象 
 public Object getProxyInstance () { 
 //工具类 
 Enhancer en = new Enhancer (); 
 //设置父类 
 en . setSuperclass ( target . getClass ()); 
 //设置回调函数 
 en . setCallback ( this ); 
 //创建子类对象代理 
 return en . create (); 
 } 
 
 @Override 
 public Object intercept ( Object obj , Method method , Object [] args , MethodProxy proxy ) throws Throwable { 
 System . out . println ( "请问有什么可以帮到您？" ); 
 // 执行目标对象的方法 
 Object returnValue = method . invoke ( target , args ); 
 System . out . println ( "问题已经解决啦！" ); 
 return null ; 
 } 
 
 } 
 第三步：创建客户端 Client，获取代理对象并调用目标方法。 
 public class Client { 
 public static void main ( String [] args ) { 
 //目标对象:程序员 
 Solver developer = new Solver (); 
 //代理：客服小姐姐 
 Solver csProxy = ( Solver ) new ProxyFactory ( developer ). getProxyInstance (); 
 //目标方法：解决问题 
 csProxy . solve (); 
 } 
 } 
 
 
 
 
 
 
 
 
 
 
 事务
