> 来源文件：raw/files/面渣逆袭Spring篇V2.0.epub
> 正文位置：EPUB/text/ch001.xhtml
> 导航位置：EPUB/nav.xhtml
> 导入方式：自动抽取（待你后续精修）### Spring是什么？ 
 Spring 是一个 Java 后端开发框架，其最核心的作用是帮我们管理 Java 对象。 
 
 其最重要的特性就是 IoC，也就是控制反转。以前我们要使用一个对象时，都要自己先 new 出来。但有了 Spring 之后，我们只需要告诉 Spring 我们需要什么对象，它就会自动帮我们创建好并注入到 Spring 容器当中。 
 比如我在一个 Service 类里需要用到 Dao 对象，只需要加个 @Autowired 注解，Spring 就会自动把 Dao 对象注入到 Spring 容器当中，这样就不需要我们手动去管理这些对象之间的依赖关系了。 
 
 另外，Spring 还提供了 AOP，也就是面向切面编程，在我们需要做一些通用功能的时候特别有用，比如说日志记录、权限校验、事务管理这些，我们不用在每个方法里都写重复的代码，直接用 AOP 就能统一处理。 
 
 Spring 的生态也特别丰富，像 Spring Boot 能让我们快速搭建项目，Spring MVC 能帮我们处理 web 请求，Spring Data 能帮我们简化数据库操作，Spring Cloud 能帮我们做微服务架构等等。 
 
 Spring有哪些特性？ 
 Spring 的特性还是挺多的，我按照在实际工作/学习中用得最多的几个来说吧。 
 
 首先最核心的就是 IoC 控制反转和 DI 依赖注入。这个我前面也提到了，就是 Spring 能帮我们管理对象的创建和依赖关系。 
 比如我写一个 UserService，需要用到 UserDao，以前得自己 new 一个 UserDao 出来，现在只要在 UserService 上加个 @Service 注解，在 UserDao 字段上加个 @Autowired ，Spring 就会自动帮我们处理好这些依赖关系。 
 这样代码的耦合度就大大降低了，测试的时候也更容易 mock。 
 第二个就是 AOP 面向切面编程。这个在我们处理一些横切关注点的时候特别有用，比如说我们要给某些 Controller 方法都加上权限控制，如果没有 AOP 的话，每个方法都要写一遍加权代码，维护起来很麻烦。 
 
 用了 AOP 之后，我们只需要写一个切面类，定义好切点和通知，就能统一处理了。事务管理也是同样的道理，加个 @Transactional 注解就搞定了。 
 还有就是 Spring 对各种企业级功能的集成支持也特别好。比如数据库访问，不管我们用 JDBC、MyBatis-Plus 还是 Hibernate，Spring 都能很好地集成。消息队列、缓存、安全认证这些， Spring 都有对应的模块来支持。 
 
 另外 Spring 的配置也很灵活，既支持 XML 配置，也支持注解配置，现在我们基本都用注解了，写起来更简洁。Spring Boot 出来之后就更方便了，约定大于配置，很多东西都是开箱即用的。 
 
 
 简单说一下什么是AOP和IoC？ 
 AOP 面向切面编程，简单点说就是把一些通用的功能从业务代码里抽取出来，统一处理。比如说 技术派 中的 @MdcDot 注解的作用是配合 AOP 在日志中加入 MDC 信息，方便进行日志追踪。 
 
 IoC 控制反转是一种设计思想，它的主要作用是将对象的创建和对象之间的调用过程交给 Spring 容器来管理。比如说在 技术派 项目当中， @PostConstruct 注解表明这个方法由 Spring 容器在 Bean 初始化完成后自动调用，我们不需要手动调用 init 方法。 
 
 
 
 Spring源码看过吗？ 
 看过一些，主要是带着问题去看的，比如遇到一些技术难点或者想深入理解某个功能的时候。 
 我重点看过的是 IoC 容器的初始化过程，特别是 ApplicationContext 的启动流程。从 refresh() 方法开始，包括 Bean 的定义和加载、Bean 工厂的准备、Bean 的实例化和初始化这些关键步骤。 
 
 看源码的时候发现 Spring 用了很多设计模式，比如工厂模式、单例模式、模板方法模式等等，这对我平时写代码也很有启发。 
 还有就是 Spring 的 Bean 生命周期，从 BeanDefinition 的创建到 Bean 的实例化、属性注入、初始化回调，再到最后的销毁，整个过程还是挺复杂的。看了源码之后对 @PostConstruct 、 @PreDestroy 这些注解的执行时机就更清楚了。 
 不过说实话，Spring 的源码确实比较难啃，涉及的概念和技术点太多了。我一般是结合一些技术博客和 Claude 一起看，这样理解起来会相对容易一些。 
 PS：关于这份小册的 PDF 版本，目前只有 星球 的用户可以获取，后续会考虑开放给大家。 ### Spring有哪些模块呢？ 
 我按照平时工作/学习中接触的频率来说一下。 
 首先是 Spring Core 模块，这是整个 Spring 框架的基础，包含了 IoC 容器和依赖注入等核心功能。还有 Spring Beans 模块，负责 Bean 的配置和管理。这两个模块基本上是其他所有模块的基础，不管用 Spring 的哪个功能都会用到。 
 
 然后是 Spring Context 上下文模块，它在 Core 的基础上提供了更多企业级的功能，比如国际化、事件传播、资源加载这些。ApplicationContext 就是在这个模块里面的。 
 @SpringBootApplication 
 public class Application { 
 public static void main ( String [] args ) { 
 // Spring Boot会自动创建ApplicationContext 
 ApplicationContext context = SpringApplication . run ( Application . class , args ); 
 } 
 } 
 Spring AOP 模块提供了面向切面编程的支持，我们用的 @Transactional 、自定义切面这些都是基于这个模块。 
 Web 开发方面，Spring Web 模块提供了基础的 Web 功能，Spring WebMVC 就是我们常用的 MVC 框架，用来处理 HTTP 请求和响应。现在还有 Spring WebFlux，支持响应式编程。 
 比如说 技术派 项目中， GlobalExceptionHandler 类就使用了 @RestControllerAdvice 来实现统一的异常处理。 
 @RestControllerAdvice 
 public class GlobalExceptionHandler { 
 @ExceptionHandler ( value = ForumAdviceException . class ) 
 public ResVo < String > handleForumAdviceException ( ForumAdviceException e ) { 
 return ResVo . fail ( e . getStatus ()); 
 } 
 } 
 数据访问方面，Spring JDBC 简化了 JDBC 的使用，在 技术派 项目中，我们就 JdbcTemplate 来检查表是否存在、执行数据库初始化脚本。 
 
 Spring ORM 提供了对 MyBatis-Plus 等 ORM 框架的集成支持。在 技术派 项目中，我们就用了 @TableName 、 @TableField 等注解进行对象关系映射，通过继承 BaseMapper 来获取通用的 CRUD 能力。 
 
 Spring Test 模块提供了测试支持，可以很方便地进行单元测试和集成测试。我们写测试用例的时候经常用 @SpringBootTest 这些注解。比如说在 技术派 项目中，我们就用 @SpringBootTest 注解来加载 Spring 上下文，进行集成测试。 
 @Slf4j 
 @SpringBootTest ( classes = QuickForumApplication . class ) 
 @RunWith ( SpringJUnit4ClassRunner . class ) 
 public class BasicTest { 
 } 
 还有一些其他的模块，比如 Spring Security 负责安全认证，Spring Batch 处理批处理任务等等。 
 现在我们基本都是用 Spring Boot 来开发，它把这些模块都整合好了，用起来更方便。 ### Spring有哪些常用注解呢？ 
 Spring 的注解挺多的，我按照不同的功能分类来说一下平时用得最多的那些。 
 首先是 Bean 管理相关的注解。 @Component 是最基础的，用来标识一个类是 Spring 组件。像 @Service 、 @Repository 、 @Controller 这些都是 @Component 的特化版本，分别用在服务层、数据访问层和控制器层。 
 
 依赖注入方面， @Autowired 是用得最多的，可以标注在字段、setter 方法或者构造方法上。 @Qualifier 在有多个同类型 Bean 的时候用来指定具体注入哪一个。 @Resource 和 @Autowired 功能差不多，不过它是按名称注入的。 
 
 配置相关的注解也很常用。 @Configuration 标识配置类， @Bean 用来定义 Bean， @Value 用来注入配置文件中的属性值。我们项目里的数据库连接信息、Redis 配置这些都是用 @Value 来注入的。 @PropertySource 用来指定配置文件的位置。 
 
 Web 开发的注解就更多了。 @RestController 相当于 @Controller 加 @ResponseBody ，用来做 RESTful 接口。 
 
 @RequestMapping 及其变体 @GetMapping 、 @PostMapping 、 @PutMapping 、 @DeleteMapping 用来映射 HTTP 请求。 @PathVariable 获取路径参数， @RequestParam 获取请求参数， @RequestBody 接收 JSON 数据。 
 AOP 相关的注解， @Aspect 定义切面， @Pointcut 定义切点， @Before 、 @After 、 @Around 这些定义通知类型。 
 
 不过我们用得最多的还是 @Transactional ，基本上 Service 层需要保证事务原子性的方法都会加上这个注解。 
 生命周期相关的， @PostConstruct 在 Bean 初始化后执行， @PreDestroy 在 Bean 销毁前执行。测试的时候 @SpringBootTest 也经常用到。 
 
 还有一些 Spring Boot 特有的注解，比如 @SpringBootApplication 这个启动类注解， @ConditionalOnProperty 做条件装配， @EnableAutoConfiguration 开启自动配置等等。 ### 🌟Spring用了哪些设计模式？ 
 Spring 框架里面确实用了很多设计模式，我从平时工作中能观察到的几个来说说。 
 首先是工厂模式，这个在 Spring 里用得非常多。BeanFactory 就是一个典型的工厂，它负责创建和管理所有的 Bean 对象。我们平时用的 ApplicationContext 其实也是 BeanFactory 的一个实现。当我们通过 @Autowired 获取一个 Bean 的时候，底层就是通过工厂模式来创建和获取对象的。 
 
 单例模式也是 Spring 的默认行为。默认情况下，Spring 容器中的 Bean 都是单例的，整个应用中只会有一个实例。这样可以节省内存，提高性能。当然我们也可以通过 @Scope 注解来改变 Bean 的作用域，比如设置为 prototype 就是每次获取都创建新实例。 
 
 代理模式在 AOP 中用得特别多。Spring AOP 的底层实现就是基于动态代理的，对于实现了接口的类用 JDK 动态代理，没有实现接口的类用 CGLIB 代理。比如我们用 @Transactional 注解的时候，Spring 会为我们的类创建一个代理对象，在方法执行前后添加事务处理逻辑。 
 模板方法模式在 Spring 里也很常见，比如 JdbcTemplate。它定义了数据库操作的基本流程：获取连接、执行 SQL、处理结果、关闭连接，但是具体的 SQL 语句和结果处理逻辑由我们来实现。 
 
 观察者模式在 Spring 的事件机制中有所体现。我们可以通过 ApplicationEvent 和 ApplicationListener 来实现事件的发布和监听。比如用户注册成功后，我们可以发布一个用户注册事件，然后有多个监听器来处理后续的业务逻辑，比如发送邮件、记录日志等。 
 
 这些设计模式的应用让 Spring 框架既灵活又强大，也让我在实际的开发中学到很多经典的设计思想。 
 
 Spring如何实现单例模式？ 
 传统的单例模式是在类的内部控制只能创建一个实例，比如用 private 构造方法加 static getInstance() 这种方式。但是 Spring 的单例是容器级别的，同一个 Bean 在整个 Spring 容器中只会有一个实例。 
 具体的实现机制是这样的：Spring 在启动的时候会把所有的 Bean 定义信息加载进来，然后在 DefaultSingletonBeanRegistry 这个类里面维护了一个叫 singletonObjects 的 ConcurrentHashMap，这个 Map 就是用来存储单例 Bean 的。key 是 Bean 的名称，value 就是 Bean 的实例对象。 
 
 当我们第一次获取某个 Bean 的时候，Spring 会先检查 singletonObjects 这个 Map 里面有没有这个 Bean，如果没有就会创建一个新的实例，然后放到 Map 里面。后面再获取同一个 Bean 的时候，直接从 Map 里面取就行了，这样就保证了单例。 
 
 还有一个细节就是 Spring 为了解决循环依赖的问题，还用了三级缓存。除了 singletonObjects 这个一级缓存，还有 earlySingletonObjects 二级缓存和 singletonFactories 三级缓存。这样即使有循环依赖，Spring 也能正确处理。 
 而且 Spring 的单例是线程安全的，因为用的是 ConcurrentHashMap，多线程访问不会有问题。 ### Spring容器和Web容器之间的区别知道吗？（补充） 
 
 2024 年 7 月 11 日增补 
 
 首先从概念上来说，Spring 容器是一个 IoC 容器，主要负责管理 Java 对象的生命周期和依赖关系。而 Web 容器，比如 Tomcat、Jetty 这些，是用来运行 Web 应用的容器，负责处理 HTTP 请求和响应，管理 Servlet 的生命周期。 
 /** 
 * SpringUtil . java 
 * 用于获取 Spring 容器中的 Bean ，技术派源码： https :// github . com / itwanger / paicoding 
 */ 
 @Component 
 public class SpringUtil implements ApplicationContextAware { 
 private volatile static ApplicationContext context ; 
 
 @Override 
 public void setApplicationContext ( ApplicationContext applicationContext ) { 
 SpringUtil . context = applicationContext ; 
 } 
 
 public static < T > T getBean ( Class < T > bean ) { 
 return context . getBean ( bean ); 
 } 
 } 
 从功能上看，Spring 容器专注于业务逻辑层面的对象管理，比如我们的 Service、Dao、Controller 这些 Bean 都是由 Spring 容器来创建和管理的。而 Web 容器主要处理网络通信，比如接收 HTTP 请求、解析请求参数、调用相应的 Servlet，然后把响应返回给客户端。 
 
 在实际项目中，这两个容器是相辅相成的。我们的 Web 项目部署在 Tomcat 上的时候，Tomcat 会负责接收 HTTP 请求，然后把请求交给 DispatcherServlet 处理，而 DispatcherServlet 又会去 Spring 容器中查找相应的 Controller 来处理业务逻辑。 
 /** 
 * GlobalViewInterceptor . java 
 * 用于全局拦截器，技术派源码： https :// github . com / itwanger / paicoding 
 */ 
 @Component 
 public class GlobalViewInterceptor implements HandlerInterceptor { 
 @Autowired 
 private GlobalInitService globalInitService ; 
 
 @Override 
 public boolean preHandle ( HttpServletRequest request , 
 HttpServletResponse response , 
 Object handler ) { 
 // Web 容器的 HTTP 请求 + Spring 容器的业务服务 
 } 
 } 
 还有一个重要的区别是生命周期。Web 容器的生命周期跟 Web 应用程序的部署和卸载相关，而 Spring 容器的生命周期是在 Web 应用启动的时候初始化，应用关闭的时候销毁。 
 现在我们都用 Spring Boot 了，Spring Boot 内置了 Tomcat，把 Web 容器和 Spring 容器都整合在一起了，我们只需要运行一个 jar 包就可以了。 
 @SpringBootApplication 
 public class QuickForumApplication { 
 public static void main ( String [] args ) { 
 SpringApplication . run ( QuickForumApplication . class , args ); 
 } 
 } 
 
 
 
 
 
 
 
 
 
 IoC ### 🌟说一说什么是IoC？ 
 IoC 的全称是 Inversion of Control，也就是控制反转。这里的“控制”指的是对象创建和依赖关系管理的控制权。 
 
 以前我们写代码的时候，如果 A 类需要用到 B 类，我们就在 A 类里面直接 new 一个 B 对象出来，这样 A 类就控制了 B 类对象的创建。 
 // 传统方式：对象主动创建依赖 
 public class UserService { 
 private UserDao userDao ; 
 
 public UserService () { 
 // 主动创建依赖对象 
 this . userDao = new UserDaoImpl (); 
 } 
 } 
 有了 IoC 之后，这个控制权就“反转”了，不再由 A 类来控制 B 对象的创建，而是交给外部的容器来管理。 
 /** 
 * 使用 Spring IoC 容器来管理 UserDao 的创建和注入 
 * 技术派源码： https :// github . com / itwanger / paicoding 
 */ 
 @Service 
 public class UserServiceImpl implements UserService { 
 @Autowired 
 private UserDao userDao ; 
 
 // 不需要主动创建 UserDao，由 Spring 容器注入 
 public BaseUserInfoDTO getAndUpdateUserIpInfoBySessionId ( String session , String clientIp ) { 
 // 直接使用注入的 userDao 
 return userDao . getBySessionId ( session ); 
 } 
 } 
 ----这部分面试中可以不背 start---- 
 没有 IoC 之前： 
 
 我需要一个女朋友，刚好大街上突然看到了一个小姐姐，人很好看，于是我就自己主动上去搭讪，要她的微信号，找机会聊天关心她，然后约她出来吃饭，打听她的爱好，三观。。。 
 
 有了 IoC 之后： 
 
 我需要一个女朋友，于是我就去找婚介所，告诉婚介所，我需要一个长的像赵露思的，会打 Dota2 的，于是婚介所在它的人才库里开始找，找不到它就直接说没有，找到它就直接介绍给我。 
 
 婚介所就相当于一个 IoC 容器，我就是一个对象，我需要的女朋友就是另一个对象，我不用关心女朋友是怎么来的，我只需要告诉婚介所我需要什么样的女朋友，婚介所就帮我去找。 
 
 ----这部分面试中可以不背 end---- 
 
 DI和IoC的区别了解吗？ 
 IoC 的思想是把对象创建和依赖关系的控制权由业务代码转移给 Spring 容器。这是一个比较抽象的概念，告诉我们应该怎么去设计系统架构。 
 
 而 DI，也就是依赖注入，它是实现 IoC 这种思想的具体技术手段。在 Spring 里，我们用 @Autowired 注解就是在使用 DI 的字段注入方式。 
 @Service 
 public class ArticleReadServiceImpl implements ArticleReadService { 
 @Autowired 
 private ArticleDao articleDao ; // 字段注入 
 
 @Autowired 
 private UserDao userDao ; 
 } 
 从实现角度来看，DI 除了字段注入，还有构造方法注入和 Setter 方法注入等方式。在做 技术派 项目的时候，我就尝试过构造方法注入的方式。 
 
 当然了，DI 并不是实现 IoC 的唯一方式，还有 Service Locator 模式，可以通过实现 ApplicationContextAware 接口来获取 Spring 容器中的 Bean。 
 
 之所以 ID 后成为 IoC 的首选实现方式，是因为代码更清晰、可读性更高。 
 IoC（控制反转）
├── DI（依赖注入） ← 主要实现方式
│ ├── 构造器注入
│ ├── 字段注入
│ └── Setter注入
├── 服务定位器模式
├── 工厂模式
└── 其他实现方式 
 
 
 为什么要使用 IoC 呢？ 
 在日常开发中，如果我们需要实现某一个功能，可能至少需要两个以上的对象来协助完成，在没有 Spring 之前，每个对象在需要它的合作对象时，需要自己 new 一个，比如说 A 要使用 B，A 就对 B 产生了依赖，也就是 A 和 B 之间存在了一种耦合关系。 
 // 传统方式：对象自己创建依赖 
 public class UserService { 
 private UserDao userDao = new UserDaoImpl (); // 硬编码依赖 
 
 public User getUser ( Long id ) { 
 return userDao . findById ( id ); 
 } 
 } 
 有了 Spring 之后，创建 B 的工作交给了 Spring 来完成，Spring 创建好了 B 对象后就放到容器中，A 告诉 Spring 我需要 B，Spring 就从容器中取出 B 交给 A 来使用。 
 // IoC 方式：依赖由外部注入 
 @Service 
 public class UserServiceImpl implements UserService { 
 @Autowired 
 private UserDao userDao ; // 依赖注入，不关心具体实现 
 
 public User getUser ( Long id ) { 
 return userDao . findById ( id ); 
 } 
 } 
 至于 B 是怎么来的，A 就不再关心了，Spring 容器想通过 newnew 创建 B 还是 new 创建 B，无所谓。 
 这就是 IoC 的好处，它降低了对象之间的耦合度，让每个对象只关注自己的业务实现，不关心其他对象是怎么创建的。 ### 能说一下IoC的实现机制吗？ 
 好的，Spring IoC 的实现机制还是比较复杂的，我尽量用比较通俗的方式来解释一下整个流程。 
 
 第一步是加载 Bean 的定义信息。Spring 会扫描我们配置的包路径，找到所有标注了 @Component 、 @Service 、 @Repository 这些注解的类，然后把这些类的元信息封装成 BeanDefinition 对象。 
 // Bean定义信息 
 public class BeanDefinition { 
 private String beanClassName ; // 类名 
 private String scope ; // 作用域 
 private boolean lazyInit ; // 是否懒加载 
 private String [] dependsOn ; // 依赖的Bean 
 private ConstructorArgumentValues constructorArgumentValues ; // 构造参数 
 private MutablePropertyValues propertyValues ; // 属性值 
 } 
 第二步是 Bean 工厂的准备。Spring 会创建一个 DefaultListableBeanFactory 作为 Bean 工厂来负责 Bean 的创建和管理。 
 
 第三步是 Bean 的实例化和初始化。这个过程比较复杂，Spring 会根据 BeanDefinition 来创建 Bean 实例。 
 
 对于单例 Bean，Spring 会先检查缓存中是否已经存在，如果不存在就创建新实例。创建实例的时候会通过反射调用构造方法，然后进行属性注入，最后执行初始化回调方法。 
 // 简化的Bean创建流程 
 public class AbstractBeanFactory { 
 
 protected Object createBean ( String beanName , BeanDefinition bd ) { 
 // 1. 实例化前处理 
 Object bean = resolveBeforeInstantiation ( beanName , bd ); 
 if ( bean != null ) { 
 return bean ; 
 } 
 
 // 2. 实际创建Bean 
 return doCreateBean ( beanName , bd ); 
 } 
 
 protected Object doCreateBean ( String beanName , BeanDefinition bd ) { 
 // 2.1 实例化 
 Object bean = createBeanInstance ( beanName , bd ); 
 
 // 2.2 属性填充（依赖注入） 
 populateBean ( beanName , bd , bean ); 
 
 // 2.3 初始化 
 Object exposedObject = initializeBean ( beanName , bean , bd ); 
 
 return exposedObject ; 
 } 
 } 
 依赖注入的实现主要是通过反射来完成的。比如我们用 @Autowired 标注了一个字段，Spring 在创建 Bean 的时候会扫描这个字段，然后从容器中找到对应类型的 Bean，通过反射的方式设置到这个字段上。 
 
 
 你是怎么理解 Spring IoC 的？ 
 IoC 本质上一个超级工厂，这个工厂的产品就是各种 Bean 对象。 
 
 我们通过 @Component 、 @Service 这些注解告诉工厂：“我要生产什么样的产品，这个产品有什么特性，需要什么原材料”。 
 然后工厂里各种生产线，在 Spring 中就是各种 BeanPostProcessor。比如 AutowiredAnnotationBeanPostProcessor 专门负责处理 @Autowired 注解。 
 工厂里还有各种缓存机制用来存放产品，比如说 singletonObjects 是成品仓库，存放完工的单例 Bean；earlySingletonObjects 是半成品仓库，用来解决循环依赖问题。 
 // Spring单例Bean注册表 
 public class DefaultSingletonBeanRegistry { 
 // 一级缓存：完成初始化的单例Bean 
 private final Map < String , Object > singletonObjects = new ConcurrentHashMap <>( 256 ); 
 
 // 二级缓存：早期暴露的单例Bean（解决循环依赖） 
 private final Map < String , Object > earlySingletonObjects = new HashMap <>( 16 ); 
 
 // 三级缓存：单例Bean工厂 
 private final Map < String , ObjectFactory <?>> singletonFactories = new HashMap <>( 16 ); 
 
 public Object getSingleton ( String beanName ) { 
 Object singletonObject = this . singletonObjects . get ( beanName ); 
 if ( singletonObject == null ) { 
 singletonObject = this . earlySingletonObjects . get ( beanName ); 
 if ( singletonObject == null ) { 
 ObjectFactory <?> singletonFactory = this . singletonFactories . get ( beanName ); 
 if ( singletonFactory != null ) { 
 singletonObject = singletonFactory . getObject (); 
 this . earlySingletonObjects . put ( beanName , singletonObject ); 
 this . singletonFactories . remove ( beanName ); 
 } 
 } 
 } 
 return singletonObject ; 
 } 
 } 
 最有意思的是，这个工厂还很智能，它知道产品之间的依赖关系。它会根据依赖关系来决定 Bean 的创建顺序。如果发现循环依赖，它还会用三级缓存机制来巧妙地解决。 
 
 
 能手写一个简单的 IoC 容器吗？ 
 1、首先定义基础的注解，比如说 @Component 、 @Autowired 等。 
 // 组件注解 
 @Target ( ElementType . TYPE ) 
 @Retention ( RetentionPolicy . RUNTIME ) 
 public @interface Component { 
 } 
 
 // 自动注入注解 
 @Target ( ElementType . FIELD ) 
 @Retention ( RetentionPolicy . RUNTIME ) 
 public @interface Autowired { 
 } 
 2、核心的 IoC 容器类，负责扫描包路径，创建 Bean 实例，并处理依赖注入。 
 public class SimpleIoC { 
 // Bean容器 
 private Map < Class <?>, Object > beans = new HashMap <>(); 
 
 /** 
 * 注册 Bean 
 */ 
 public void registerBean ( Class <?> clazz ) { 
 try { 
 // 创建实例 
 Object instance = clazz . getDeclaredConstructor (). newInstance (); 
 beans . put ( clazz , instance ); 
 } catch ( Exception e ) { 
 throw new RuntimeException ( "创建Bean失败: " + clazz . getName (), e ); 
 } 
 } 
 
 /** 
 * 获取 Bean 
 */ 
 @SuppressWarnings ( "unchecked" ) 
 public < T > T getBean ( Class < T > clazz ) { 
 return ( T ) beans . get ( clazz ); 
 } 
 
 /** 
 * 依赖注入 
 */ 
 public void inject () { 
 for ( Object bean : beans . values ()) { 
 injectFields ( bean ); 
 } 
 } 
 
 /** 
 * 字段注入 
 */ 
 private void injectFields ( Object bean ) { 
 Field [] fields = bean . getClass (). getDeclaredFields (); 
 for ( Field field : fields ) { 
 if ( field . isAnnotationPresent ( Autowired . class )) { 
 try { 
 field . setAccessible ( true ); 
 Object dependency = getBean ( field . getType ()); 
 field . set ( bean , dependency ); 
 } catch ( Exception e ) { 
 throw new RuntimeException ( "注入失败: " + field . getName (), e ); 
 } 
 } 
 } 
 } 
 } 
 3、使用示例，定义一些 Bean 类，并注册到 IoC 容器中。 
 // DAO层 
 @Component 
 class UserDao { 
 public void save ( String user ) { 
 System . out . println ( "保存用户: " + user ); 
 } 
 } 
 
 // Service层 
 @Component 
 class UserService { 
 @Autowired 
 private UserDao userDao ; 
 
 public void createUser ( String name ) { 
 userDao . save ( name ); 
 System . out . println ( "用户创建完成" ); 
 } 
 } 
 
 // 测试 
 public class Test { 
 public static void main ( String [] args ) { 
 SimpleIoC ioc = new SimpleIoC (); 
 
 // 注册Bean 
 ioc . registerBean ( UserDao . class ); 
 ioc . registerBean ( UserService . class ); 
 
 // 依赖注入 
 ioc . inject (); 
 
 // 使用 
 UserService userService = ioc . getBean ( UserService . class ); 
 userService . createUser ( "王二" ); 
 } 
 } 
 4、可以加上组件扫描。 
 import java . lang . reflect . Field ; 
 import java . util .*; 
 
 public class SimpleIoC { 
 private Map < Class <?>, Object > beans = new HashMap <>(); 
 
 /** 
 * 扫描并注册组件 
 */ 
 public void scan ( String packageName ) { 
 // 简化版：手动添加需要扫描的类 
 List < Class <?>> classes = getClassesInPackage ( packageName ); 
 
 for ( Class <?> clazz : classes ) { 
 if ( clazz . isAnnotationPresent ( Component . class )) { 
 registerBean ( clazz ); 
 } 
 } 
 
 // 依赖注入 
 inject (); 
 } 
 
 /** 
 * 获取包下的类（简化实现） 
 */ 
 private List < Class <?>> getClassesInPackage ( String packageName ) { 
 // 面试时可以说："实际实现需要扫描classpath，这里简化处理" 
 return Arrays . asList ( UserDao . class , UserService . class ); 
 } 
 
 private void registerBean ( Class <?> clazz ) { 
 try { 
 Object instance = clazz . getDeclaredConstructor (). newInstance (); 
 beans . put ( clazz , instance ); 
 } catch ( Exception e ) { 
 throw new RuntimeException ( "创建Bean失败" , e ); 
 } 
 } 
 
 @SuppressWarnings ( "unchecked" ) 
 public < T > T getBean ( Class < T > clazz ) { 
 return ( T ) beans . get ( clazz ); 
 } 
 
 private void inject () { 
 for ( Object bean : beans . values ()) { 
 Field [] fields = bean . getClass (). getDeclaredFields (); 
 for ( Field field : fields ) { 
 if ( field . isAnnotationPresent ( Autowired . class )) { 
 try { 
 field . setAccessible ( true ); 
 Object dependency = getBean ( field . getType ()); 
 field . set ( bean , dependency ); 
 } catch ( Exception e ) { 
 throw new RuntimeException ( "注入失败" , e ); 
 } 
 } 
 } 
 } 
 } 
 } 
 IoC 容器的核心是管理对象和依赖注入，首先定义注解，然后实现容器的三个核心方法：注册Bean、获取Bean、依赖注入；关键是用反射创建对象和注入依赖。 ### 说说BeanFactory和ApplicantContext的区别? 
 BeanFactory 算是 Spring 的“心脏”，而 ApplicantContext 可以说是 Spring 的完整“身躯”。 
 
 BeanFactory 提供了最基本的 IoC 能力。它就像是一个 Bean 工厂，负责 Bean 的创建和管理。他采用的是懒加载的方式，也就是说只有当我们真正去获取某个 Bean 的时候，它才会去创建这个 Bean。 
 
 它最主要的方法就是 getBean() ，负责从容器中返回特定名称或者类型的 Bean 实例。 
 public class BeanFactoryExample { 
 public static void main ( String [] args ) { 
 // 创建 BeanFactory 
 DefaultListableBeanFactory beanFactory = new DefaultListableBeanFactory (); 
 
 // 手动注册 Bean 定义 
 BeanDefinition beanDefinition = new RootBeanDefinition ( UserService . class ); 
 beanFactory . registerBeanDefinition ( "userService" , beanDefinition ); 
 
 // 懒加载：此时才创建 Bean 实例 
 UserService userService = beanFactory . getBean ( "userService" , UserService . class ); 
 } 
 } 
 ApplicationContext 是 BeanFactory 的子接口，在 BeanFactory 的基础上扩展了很多企业级的功能。它不仅包含了 BeanFactory 的所有功能，还提供了国际化支持、事件发布机制、AOP、JDBC、ORM 框架集成等等。 
 
 ApplicationContext 采用的是饿加载的方式，容器启动的时候就会把所有的单例 Bean 都创建好，虽然这样会导致启动时间长一点，但运行时性能更好。 
 @Configuration 
 public class AppConfig { 
 @Bean 
 public UserService userService () { 
 return new UserService (); 
 } 
 } 
 
 public class ApplicationContextExample { 
 public static void main ( String [] args ) { 
 // 创建 ApplicationContext，启动时就创建所有 Bean 
 ApplicationContext context = new AnnotationConfigApplicationContext ( AppConfig . class ); 
 
 // 获取 Bean 
 UserService userService = context . getBean ( UserService . class ); 
 
 // 发布事件 
 context . publishEvent ( new CustomEvent ( "Hello World" )); 
 } 
 } 
 从使用场景来说，实际开发中用得最多的是 ApplicationContext。像 AnnotationConfigApplicationContext、WebApplicationContext 这些都是 ApplicationContext 的实现类。 
 另外一个重要的区别是生命周期管理。ApplicationContext 会自动调用 Bean 的初始化和销毁方法，而 BeanFactory 需要我们手动管理。 
 在 Spring Boot 项目中，我们可以通过 @Autowired 注入 ApplicationContext，或者通过实现 ApplicationContextAware 接口来获取 ApplicationContext。 ### 🌟项目启动时Spring的IoC会做什么？ 
 第一件事是扫描和注册 Bean。IoC 容器会根据我们的配置，比如 @ComponentScan 指定的包路径，去扫描所有标注了 @Component 、 @Service 、 @Controller 这些注解的类。然后把这些类的元信息包装成 BeanDefinition 对象，注册到容器的 BeanDefinitionRegistry 中。这个阶段只是收集信息，还没有真正创建对象。 
 
 第二件事是 Bean 的实例化和注入。这是最核心的过程，IoC 容器会按照依赖关系的顺序开始创建 Bean 实例。对于单例 Bean，容器会通过反射调用构造方法创建实例，然后进行属性注入，最后执行初始化回调方法。 
 
 在依赖注入时，容器会根据 @Autowired 、 @Resource 这些注解，把相应的依赖对象注入到目标 Bean 中。比如 UserService 需要 UserDao，容器就会把 UserDao 的实例注入到 UserService 中。 
 
 说说Spring的Bean实例化方式？ 
 Spring 提供了 4 种方式来实例化 Bean，以满足不同场景下的需求。 
 第一种是通过构造方法实例化，这是最常用的方式。当我们用 @Component 、 @Service 这些注解标注类的时候，Spring 默认通过无参构造器来创建实例的。如果类只有一个有参构造方法，Spring 会自动进行构造方法注入。 
 @Service 
 public class UserService { 
 private UserDao userDao ; 
 
 public UserService ( UserDao userDao ) { // 构造方法注入 
 this . userDao = userDao ; 
 } 
 } 
 第二种是通过静态工厂方法实例化。有时候对象的创建比较复杂，我们会写一个静态工厂方法来创建，然后用 @Bean 注解来标注这个方法。Spring 会调用这个静态方法来获取 Bean 实例。 
 @Configuration 
 public class AppConfig { 
 @Bean 
 public static DataSource createDataSource () { 
 // 复杂的DataSource创建逻辑 
 return new HikariDataSource (); 
 } 
 } 
 第三种是通过实例工厂方法实例化。这种方式是先创建工厂对象，然后通过工厂对象的方法来创建Bean： 
 @Configuration 
 public class AppConfig { 
 @Bean 
 public ConnectionFactory connectionFactory () { 
 return new ConnectionFactory (); 
 } 
 
 @Bean 
 public Connection createConnection ( ConnectionFactory factory ) { 
 return factory . createConnection (); 
 } 
 } 
 第四种是通过 FactoryBean 接口实例化。这是 Spring 提供的一个特殊接口，当我们需要创建复杂对象的时候特别有用： 
 @Component 
 public class MyFactoryBean implements FactoryBean < MyObject > { 
 @Override 
 public MyObject getObject () throws Exception { 
 // 复杂的对象创建逻辑 
 return new MyObject (); 
 } 
 
 @Override 
 public Class <?> getObjectType () { 
 return MyObject . class ; 
 } 
 } 
 在实际工作中，用得最多的还是构造方法实例化，因为简单直接。工厂方法一般用在需要复杂初始化逻辑的场景，比如数据库连接池、消息队列连接这些。FactoryBean 主要是在框架开发或者需要动态创建对象的时候使用。 
 Spring 在实例化的时候会根据 Bean 的定义自动选择合适的方式，我们作为开发者主要是通过注解和配置来告诉 Spring 应该怎么创建对象。 ### 你是怎么理解Bean的？ 
 在我看来，Bean 本质上就是由 Spring 容器管理的 Java 对象，但它和普通的 Java 对象有很大区别。普通的 Java 对象我们是通过 new 关键字创建的。而 Bean 是交给 Spring 容器来管理的，从创建到销毁都由容器负责。 
 
 从实际使用的角度来说，我们项目里的 Service、Dao、Controller 这些都是 Bean。比如 UserService 被标注了 @Service 注解，它就成了一个 Bean，Spring 会自动创建它的实例，管理它的依赖关系，当其他地方需要用到 UserService 的时候，Spring 就会把这个实例注入进去。 
 
 这种依赖注入的方式让对象之间的关系变得松耦合。 
 Spring 提供了多种 Bean 的配置方式，基于注解的方式是最常用的。 
 
 基于 XML 配置的方式在 Spring Boot 项目中已经不怎么用了。Java 配置类的方式则可以用来解决一些比较复杂的场景，比如说主从数据源，我们可以用 @Primary 注解标注主数据源，用 @Qualifier 来指定备用数据源。 
 @Configuration 
 public class AppConfig { 
 
 @Bean 
 @Primary // 主要候选者 
 public DataSource primaryDataSource () { 
 return new HikariDataSource (); 
 } 
 
 @Bean 
 @Qualifier ( "secondary" ) 
 public DataSource secondaryDataSource () { 
 return new BasicDataSource (); 
 } 
 } 
 那在使用的时候，当我们直接用 @Autowired 注解注入 DataSource 时，Spring 默认会使用 HikariDataSource；当加上 @Qualifier("secondary") 注解时，Spring 则会注入 BasicDataSource。 
 @Autowired 
 private DataSource dataSource ; // 会注入 primaryDataSource（因为有 @Primary） 
 
 @Autowired 
 @Qualifier ( "secondary" ) 
 private DataSource secondaryDataSource ; 
 
 @Component 和 @Bean 有什么区别？ 
 首先从使用上来说， @Component 是标注在类上的，而 @Bean 是标注在方法上的。 @Component 告诉 Spring 这个类是一个组件，请把它注册为 Bean，而 @Bean 则告诉 Spring 请将这个方法返回的对象注册为 Bean。 
 @Component // Spring自动创建UserService实例 
 public class UserService { 
 @Autowired 
 private UserDao userDao ; 
 } 
 
 @Configuration 
 public class AppConfig { 
 @Bean // 我们手动创建DataSource实例 
 public DataSource dataSource () { 
 HikariDataSource ds = new HikariDataSource (); 
 ds . setJdbcUrl ( "jdbc:mysql://localhost:3306/test" ); 
 ds . setUsername ( "root" ); 
 ds . setPassword ( "123456" ); 
 return ds ; // 返回给Spring管理 
 } 
 } 
 从控制权的角度来说， @Component 是由 Spring 自动创建和管理的。 
 
 而 @Bean 则是由我们手动创建的，然后再交给 Spring 管理，我们对对象的创建过程有完全的控制权。 ### 🌟能说一下Bean的生命周期吗？ 
 好的。 
 Bean 的生命周期可以分为 5 个主要阶段，我按照实际的执行顺序来说一下。 
 
 第一个阶段是实例化。Spring 容器会根据 BeanDefinition，通过反射调用 Bean 的构造方法创建对象实例。如果有多个构造方法，Spring 会根据依赖注入的规则选择合适的构造方法。 
 
 第二阶段是属性赋值。这个阶段 Spring 会给 Bean 的属性赋值，包括通过 @Autowired 、 @Resource 这些注解注入的依赖对象，以及通过 @Value 注入的配置值。 
 
 第三阶段是初始化。这个阶段会依次执行： 
 
 @PostConstruct 标注的方法 
 InitializingBean 接口的 afterPropertiesSet 方法 
 通过 @Bean 的 initMethod 指定的初始化方法 
 
 
 我在项目中经常用 @PostConstruct 来做一些初始化工作，比如缓存预加载、DB 配置等等。 
 // CategoryServiceImpl中的缓存初始化 
 @PostConstruct 
 public void init () { 
 categoryCaches = CacheBuilder . newBuilder (). maximumSize ( 300 ). build ( new CacheLoader < Long , CategoryDTO >() { 
 @Override 
 public CategoryDTO load ( @NotNull Long categoryId ) throws Exception { 
 CategoryDO category = categoryDao . getById ( categoryId ); 
 // ... 
 } 
 }); 
 } 
 
 // DynamicConfigContainer中的配置初始化 
 @PostConstruct 
 public void init () { 
 cache = Maps . newHashMap (); 
 bindBeansFromLocalCache ( "dbConfig" , cache ); 
 } 
 初始化后，Spring 还会调用所有注册的 BeanPostProcessor 后置处理方法。这个阶段经常用来创建代理对象，比如 AOP 代理。 
 第五阶段是使用 Bean。比如我们的 Controller 调用 Service，Service 调用 DAO。 
 // UserController中的使用示例 
 @Autowired 
 private UserService userService ; 
 @GetMapping ( "/users/{id}" ) 
 public UserDTO getUser ( @PathVariable Long id ) { 
 return userService . getUserById ( id ); 
 } 
 // UserService中的使用示例 
 @Autowired 
 private UserDao userDao ; 
 public UserDTO getUserById ( Long id ) { 
 return userDao . getById ( id ); 
 } 
 // UserDao中的使用示例 
 @Autowired 
 private JdbcTemplate jdbcTemplate ; 
 public UserDTO getById ( Long id ) { 
 String sql = "SELECT * FROM users WHERE id = ?" ; 
 return jdbcTemplate . queryForObject ( sql , new Object []{ id }, new UserRowMapper ()); 
 } 
 最后是销毁阶段。当容器关闭或者 Bean 被移除的时候，会依次执行： 
 
 @PreDestroy 标注的方法 
 DisposableBean 接口的 destroy 方法 
 通过 @Bean 的 destroyMethod 指定的销毁方法 
 
 
 
 Aware 类型的接口有什么作用？ 
 Aware 接口在 Spring 中是一个很有意思的设计，它们的作用是让 Bean 能够感知到 Spring 容器的一些内部组件。 
 从设计理念来说，Aware 接口实现了一种“回调”机制。正常情况下，Bean 不应该直接依赖 Spring 容器，这样可以保持代码的独立性。但有些时候，Bean 确实需要获取容器的一些信息或者组件，Aware 接口就提供了这样一个能力。 
 我最常用的 Aware 接口是 ApplicationContextAware，它可以让 Bean 获取到 ApplicationContext 容器本身。 
 
 在 技术派项目 中，我就通过实现 ApplicationContextAware 和 EnvironmentAware 接口封装了一个 SpringUtil 工具类，通过 getBean 和 getProperty 方法来获取 Bean 和配置属性。 
 // 静态方法获取Bean，方便在非Spring管理的类中使用 
 public static < T > T getBean ( Class < T > clazz ) { 
 return context . getBean ( clazz ); 
 } 
 
 // 获取配置属性 
 public static String getProperty ( String key ) { 
 return environment . getProperty ( key ); 
 } 
 
 
 如果配置了 init-method 和 destroy-method，Spring 会在什么时候调用其配置的方法？ 
 init-method 指定的初始化方法会在 Bean 的初始化阶段被调用，具体的执行顺序是： 
 
 先执行 @PostConstruct 标注的方法 
 然后执行 InitializingBean 接口的 afterPropertiesSet() 方法 
 最后再执行 init-method 指定的方法 
 
 也就是说，init-method 是在所有其他初始化方法之后执行的。 
 @Component 
 public class MyService { 
 @Autowired 
 private UserDao userDao ; 
 
 @PostConstruct 
 public void postConstruct () { 
 System . out . println ( "1. @PostConstruct执行" ); 
 } 
 
 public void customInit () { // 通过@Bean的initMethod指定 
 System . out . println ( "3. init-method执行" ); 
 } 
 } 
 
 @Configuration 
 public class AppConfig { 
 @Bean ( initMethod = "customInit" ) 
 public MyService myService () { 
 return new MyService (); 
 } 
 } 
 destroy-method 会在 Bean 销毁阶段被调用。 
 @Component 
 public class MyService { 
 @PreDestroy 
 public void preDestroy () { 
 System . out . println ( "1. @PreDestroy执行" ); 
 } 
 
 public void customDestroy () { // 通过@Bean的destroyMethod指定 
 System . out . println ( "3. destroy-method执行" ); 
 } 
 } 
 不过在实际开发中，通常用 @PostConstruct 和 @PreDestroy 就够了，它们更简洁。 ### 为什么IDEA不推荐使用@Autowired注解注入Bean？ 
 前情提要：当使用 @Autowired 注解注入 Bean 时，IDEA 会提示“Field injection is not recommended”。 
 
 面试回答： 
 主要有几个原因。 
 第一个是字段注入不利于单元测试。字段注入需要使用反射或 Spring 容器才能注入依赖，测试更复杂；而构造方法注入可以直接通过构造方法传入 Mock 对象，测试起来更简单。 
 // 字段注入的测试困难 
 @Test 
 public void testUserService () { 
 UserService userService = new UserService (); 
 // 无法直接设置userRepository，需要反射或Spring容器 
 // userService.userRepository = Mockito.mock(UserRepository.class); 
 // 需要手动设置依赖，测试不方便 
 ReflectionTestUtils . setField ( userService , "userRepository" , Mockito . mock ( UserRepository . class )); 
 userService . doSomething (); 
 // ... 
 } 
 
 // 构造方法注入的测试简单 
 @Test 
 public void testUserService () { 
 UserRepository mockRepository = Mockito . mock ( UserRepository . class ); 
 UserService userService = new UserService ( mockRepository ); // 直接注入 
 } 
 第二个是字段注入会隐藏循环依赖问题，而构造方法注入会在项目启动时就去检查依赖关系，能更早发现问题。 
 第三个是构造方法注入可以使用 final 字段确保依赖在对象创建时就被初始化，避免了后续修改的风险。 
 在 技术派项目 中，我们已经在使用构造方法注入的方式来管理依赖关系。 
 
 不过话说回来， @Autowired 的字段注入方式在一些简单的场景下还是可以用的，主要看团队的编码规范吧。 
 
 @Autowired 和 @Resource 注解的区别？ 
 首先从来源上说， @Autowired 是 Spring 框架提供的注解，而 @Resource 是 Java EE 标准提供的注解。换句话说， @Resource 是 JDK 自带的，而 @Autowired 是 Spring 特有的。 
 虽然 IDEA 不推荐使用 @Autowired ，但对 @Resource 注解却没有任何提示。 
 
 从注入方式上说， @Autowired 默认按照类型，也就是 byType 进行注入，而 @Resource 默认按照名称，也就是 byName 进行注入。 
 当容器中存在多个相同类型的 Bean， 比如说有两个 UserRepository 的实现类，直接用 @Autowired 注入 UserRepository 时就会报错，因为 Spring 容器不知道该注入哪个实现类。 
 @Component 
 public class UserRepository21 implements UserRepository2 {} 
 
 @Component 
 public class UserRepository22 implements UserRepository2 {} 
 
 @Component 
 public class UserService2 { 
 @Autowired 
 private UserRepository2 userRepository ; // 冲突 
 } 
 这时候，有两种解决方案，第一种是使用 @Autowired + @Qualifier 指定具体的 Bean 名称来解决冲突。 
 @Component ( "userRepository21" ) 
 public class UserRepository21 implements UserRepository2 { 
 } 
 @Component ( "userRepository22" ) 
 public class UserRepository22 implements UserRepository2 { 
 } 
 @Autowired 
 @Qualifier ( "userRepository22" ) 
 private UserRepository2 userRepository22 ; 
 第二种是使用 @Resource 注解按名称进行注入。 
 @Resource ( name = "userRepository21" ) 
 private UserRepository2 userRepository21 ; ### @Autowired的实现原理了解吗？ 
 @Autowired 是 Spring 实现依赖注入的核心注解，其实现原理基于反射机制和 BeanPostProcessor 接口。 
 整个过程分为两个主要阶段。第一个阶段是依赖收集阶段，发生在 Bean 实例化之后、属性赋值之前。 Autowired 的 Processor 会扫描 Bean 的所有字段、方法和构造方法，找出标注了 @Autowired 注解的地方，然后把这些信息封装成 Injection 元数据对象缓存起来。这个过程用到了大量的反射操作，需要分析类的结构、注解信息等等。 
 
 第二个阶段是依赖注入阶段，Spring 会取出之前缓存的 Injection 元数据对象，然后逐个处理每个注入点。对于每个 @Autowired 标注的字段或方法，Spring 会根据类型去容器中查找匹配的 Bean。 
 // 1. 按类型查找（byType） 
 Map < String , Object > matchingBeans = BeanFactoryUtils . beansOfTypeIncludingAncestors ( 
 this . beanFactory , type ); 
 
 // 2. 如果找到多个候选者，按名称筛选（byName） 
 String autowiredBeanName = determineAutowireCandidate ( matchingBeans , descriptor ); 
 
 // 3. 考虑@Primary和@Priority注解 
 // 4. 最后按照字段名或参数名匹配 
 在具体的注入过程中，Spring 会使用反射来设置字段的值或者调用 setter 方法。比如对于字段注入，会调用 Field.set() 方法；对于 setter 注入，会调用 Method.invoke() 方法。 ### 什么是自动装配？ 
 自动装配的本质就是让 Spring 容器自动帮我们完成 Bean 之间的依赖关系注入，而不需要我们手动去指定每个依赖。简单来说，就是“我们不用告诉 Spring 具体怎么注入，Spring 自己会想办法找到合适的 Bean 注入进来”。 
 自动装配的工作原理简单来说就是，Spring 容器在启动时自动扫描 @ComponentScan 指定包路径下的所有类，然后根据类上的注解，比如 @Autowired 、 @Resource 等，来判断哪些 Bean 需要被自动装配。 
 @Configuration 
 @ComponentScan ( "com.github.paicoding.forum.service" ) 
 @MapperScan ( basePackages = { 
 "com.github.paicoding.forum.service.article.repository.mapper" , 
 "com.github.paicoding.forum.service.user.repository.mapper" 
 // ... 更多包路径 
 }) 
 public class ServiceAutoConfig { 
 // Spring自动扫描指定包下的所有组件并注册为Bean 
 } 
 之后分析每个 Bean 的依赖关系，在创建 Bean 的时候，根据装配规则自动找到合适的依赖 Bean，最后根据反射将这些依赖注入到目标 Bean 中。 
 
 Spring提供了哪几种自动装配类型？ 
 Spring 的自动装配方式有好几种，在 XML 配置时代，主要有 byName、byType、constructor 和 autodetect 四种方式。 
 
 到了注解驱动时代，用得最多的是 @Autowired 注解，默认按照类型装配。 
 @Service 
 public class UserService { 
 @Autowired // 按类型自动装配 
 private UserRepository userRepository ; 
 } 
 其次还有 @Resource 注解，它默认按照名称装配，如果找不到对应名称的 Bean，就会按类型装配。 
 Spring Boot 的自动装配还有一套更高级的机制，通过 @EnableAutoConfiguration 和各种 @Conditional 注解来实现，这个是框架级别的自动装配，会根据 classpath 中的类和配置来自动配置 Bean。 ### Bean的作用域有哪些? 
 Bean 的作用域决定了 Bean 实例的生命周期和创建策略，singleton 是默认的作用域。整个 Spring 容器中只会有一个 Bean 实例。不管在多少个地方注入这个 Bean，拿到的都是同一个对象。 
 @Component // 默认就是singleton 
 public class UserService { 
 // 整个应用中只有一个UserService实例 
 } 
 生命周期和 Spring 容器相同，容器启动时创建，容器销毁时销毁。 
 实际开发中，像 Service、Dao 这些业务组件基本都是单例的，因为单例既能节省内存，又能提高性能。 
 当把 scope 设置为 prototype 时，每次从容器中获取 Bean 的时候都会创建一个新的实例。 
 @Component 
 @Scope ( "prototype" ) 
 public class OrderProcessor { 
 // 每次注入或获取都是新的实例 
 } 
 当需要处理一些有状态的 Bean 时会用到 prototype，比如每个订单处理器需要维护不同的状态信息。 
 需要注意的是，在 singleton Bean 中注入 prototype Bean 时要小心，因为 singleton Bean 只创建一次，所以 prototype Bean 也只会注入一次。这时候可以用 @Lookup 注解或者 ApplicationContext 来动态获取。 
 @Component 
 public class SingletonService { 
 // 错误的做法，prototypeBean只会注入一次 
 @Autowired 
 private PrototypeBean prototypeBean ; 
 
 // 正确的做法，每次调用都获取新实例 
 @Lookup 
 public PrototypeBean getPrototypeBean () { 
 return null ; // Spring会重写这个方法 
 } 
 } 
 除了 singleton 和 prototype，Spring 还支持其他作用域，比如 request、session、application 和 websocket。 
 
 如果作用于是 request，表示在 Web 应用中，每个 HTTP 请求都会创建一个新的 Bean 实例，请求结束后 Bean 就被销毁。 
 @Component 
 @Scope ( "request" ) 
 public class RequestContext { 
 // 每个HTTP请求都有自己的实例 
 } 
 如果作用于是 session，表示在 Web 应用中，每个 HTTP 会话都会创建一个新的 Bean 实例，会话结束后 Bean 被销毁。 
 @Component 
 @Scope ( "session" ) 
 public class UserSession { 
 // 每个用户会话都有自己的实例 
 } 
 典型的使用场景是购物车、用户登录状态这些需要在整个会话期间保持的信息。 
 application 作用域表示在整个应用中只有一个 Bean 实例，类似于 singleton，但它的生命周期与 ServletContext 绑定。 
 @Component 
 @Scope ( "application" ) 
 public class AppConfig { 
 // 整个应用中只有一个实例 
 } 
 websocket 作用域表示在 WebSocket 会话中每个连接都有自己的 Bean 实例。WebSocket 连接建立时创建，连接关闭时销毁。 
 @Component 
 @Scope ( "websocket" ) 
 public class WebSocketHandler { 
 // 每个WebSocket连接都有自己的实例 
 } ### Spring中的单例Bean会存在线程安全问题吗？ 
 首先要明确一点。Spring 容器本身保证了 Bean 创建过程的线程安全，也就是说不会出现多个线程同时创建同一个单例 Bean 的情况。但是 Bean 创建完成后的使用过程，Spring 就不管了。 
 换句话说，单例 Bean 在被创建后，如果它的内部状态是可变的，那么在多线程环境下就可能会出现线程安全问题。 
 
 比如说在 技术派项目 中，有一个敏感词过滤的 Bean，我们就需要使用 volatile 关键字来保证多线程环境下的可见性。 
 @Service 
 public class SensitiveService { 
 private volatile SensitiveWordBs sensitiveWordBs ; // 使用volatile保证可见性 
 
 @PostConstruct 
 public void refresh () { 
 // 重新初始化sensitiveWordBs 
 } 
 } 
 如果 Bean 中没有成员变量，或者成员变量都是不可变的，final 修饰的，那么就不存在线程安全问题。 
 @Service 
 public class UserServiceImpl implements UserService { 
 @Resource 
 private UserDao userDao ; 
 @Autowired 
 private CountService countService ; 
 // 只有依赖注入的无状态字段 
 } 
 
 @Service 
 public class ConfigService { 
 private final String appName ; // final修饰，不可变 
 
 public ConfigService ( @Value ( "${app.name}" ) String appName ) { 
 this . appName = appName ; 
 } 
 } 
 
 单例Bean的线程安全问题怎么解决呢？ 
 第一种，使用局部变量，也就是使用无状态的单例 Bean，把所有状态都通过方法参数传递： 
 @Service 
 public class UserService { 
 @Autowired 
 private UserDao userDao ; 
 
 // 无状态方法，所有数据通过参数传递 
 public User processUser ( Long userId , String operation ) { 
 User user = userDao . findById ( userId ); 
 // 处理逻辑... 
 return user ; 
 } 
 } 
 第二种，当确实需要维护线程相关的状态时，可以使用 ThreadLocal 来保存状态。ThreadLocal 可以保证每个线程都有自己的变量副本，互不干扰。 
 @Service 
 public class UserContextService { 
 private static final ThreadLocal < User > userThreadLocal = new ThreadLocal <>(); 
 
 public void setCurrentUser ( User user ) { 
 userThreadLocal . set ( user ); 
 } 
 
 public User getCurrentUser () { 
 return userThreadLocal . get (); 
 } 
 
 public void clear () { 
 userThreadLocal . remove (); // 防止内存泄漏 
 } 
 } 
 第三种，如果需要缓存数据或者计数，使用 JUC 包下的线程安全类，比如说 AtomicInteger 、 ConcurrentHashMap 、 CopyOnWriteArrayList 等。 
 @Service 
 public class CacheService { 
 // 使用线程安全的集合 
 private final ConcurrentHashMap < String , Object > cache = new ConcurrentHashMap <>(); 
 private final AtomicLong counter = new AtomicLong ( 0 ); 
 
 public void put ( String key , Object value ) { 
 cache . put ( key , value ); 
 counter . incrementAndGet (); 
 } 
 } 
 第四种，对于复杂的状态操作，可以使用 synchronized 或 Lock： 
 @Service 
 public class CacheService { 
 private final Map < String , Object > cache = new HashMap <>(); 
 private final ReentrantLock lock = new ReentrantLock (); 
 
 public void put ( String key , Object value ) { 
 lock . lock (); 
 try { 
 cache . put ( key , value ); 
 } finally { 
 lock . unlock (); 
 } 
 } 
 } 
 第五种，如果 Bean 确实需要维护状态，可以考虑将其改为 prototype 作用域，这样每次注入都会创建一个新的实例，避免了多线程共享同一个实例的问题。 
 @Service 
 @Scope ( "prototype" ) // 每次注入都创建新实例 
 public class StatefulService { 
 private String state ; // 现在每个实例都有独立状态 
 
 public void setState ( String state ) { 
 this . state = state ; 
 } 
 } 
 或者使用 request 作用域，这样每个 HTTP 请求都会创建一个新的实例。 
 @Service 
 @Scope ( "request" ) 
 public class RequestScopedService { 
 private String requestData ; 
 // 每个请求都有独立的实例 
 } ### 什么是循环依赖? 
 简单来说就是两个或多个 Bean 相互依赖，比如说 A 依赖 B，B 依赖 A，或者 C 依赖 C，就成了循环依赖。 ### 🌟Spring怎么解决循环依赖呢？ 
 Spring 通过三级缓存机制来解决循环依赖： 
 
 一级缓存：存放完全初始化好的单例 Bean。 
 二级缓存：存放提前暴露的 Bean，实例化完成，但未初始化完成。 
 三级缓存：存放 Bean 工厂，用于生成提前暴露的 Bean。 
 
 
 以 A、B 两个类发生循环依赖为例： 
 
 第 1 步：开始创建 Bean A。 
 
 Spring 调用 A 的构造方法，创建 A 的实例。此时 A 对象已存在，但 b属性还是 null。 
 将 A 的对象工厂放入三级缓存。 
 开始进行 A 的属性注入。 
 
 
 第 2 步：A 需要注入 B，开始创建 Bean B。 
 
 发现需要 B，但 B 还不存在，所以开始创建 B。 
 调用 B 的构造方法，创建 B 的实例。此时 B 对象已存在，但 a 属性还是 null。 
 将 B 的对象工厂放入三级缓存。 
 开始进行 B 的属性注入。 
 
 第 3 步：B 需要注入 A，从缓存中获取 A。 
 
 B 需要注入 A，先从一级缓存找 A，没找到。 
 再从二级缓存找 A，也没找到。 
 最后从三级缓存找 A，找到了 A 的对象工厂。 
 调用 A 的对象工厂得到 A 的实例。这时 A 已经实例化了，虽然还没完全初始化。 
 将 A 从三级缓存移到二级缓存。 
 B 拿到 A 的引用，完成属性注入。 
 
 
 第 4 步：B 完成初始化。 
 
 B 的属性注入完成，执行 @PostConstruct 等初始化逻辑。 
 B 完全创建完成，从三级缓存移除，放入一级缓存。 
 
 第 5 步：A 完成初始化。 
 
 回到 A 的创建过程，A 拿到完整的 B 实例，完成属性注入。 
 A 执行初始化逻辑，创建完成。 
 A 从二级缓存移除，放入一级缓存。 
 
 
 用代码来模拟这个过程，是这样的： 
 // 模拟Spring的解决过程 
 public class CircularDependencyDemo { 
 // 三级缓存 
 Map < String , Object > singletonObjects = new HashMap <>(); 
 Map < String , Object > earlySingletonObjects = new HashMap <>(); 
 Map < String , ObjectFactory > singletonFactories = new HashMap <>(); 
 
 public Object getBean ( String beanName ) { 
 // 先从一级缓存获取 
 Object bean = singletonObjects . get ( beanName ); 
 if ( bean != null ) return bean ; 
 
 // 再从二级缓存获取 
 bean = earlySingletonObjects . get ( beanName ); 
 if ( bean != null ) return bean ; 
 
 // 最后从三级缓存获取 
 ObjectFactory factory = singletonFactories . get ( beanName ); 
 if ( factory != null ) { 
 bean = factory . getObject (); 
 earlySingletonObjects . put ( beanName , bean ); // 移到二级缓存 
 singletonFactories . remove ( beanName ); // 从三级缓存移除 
 } 
 
 return bean ; 
 } 
 } 
 
 哪些情况下Spring无法解决循环依赖？ 
 Spring 虽然能解决大部分循环依赖问题，但确实有几种情况是无法处理的，我来详细说说。 
 
 第一种，构造方法的循环依赖，这种情况 Spring 会直接抛出 BeanCurrentlyInCreationException 异常。 
 @Component 
 public class A { 
 private B b ; 
 
 public A ( B b ) { // 构造方法注入 
 this . b = b ; 
 } 
 } 
 
 @Component 
 public class B { 
 private A a ; 
 
 public B ( A a ) { // 构造方法注入 
 this . a = a ; 
 } 
 } 
 因为构造方法注入发生在实例化阶段，创建 A 的时候必须先有 B，但创建 B又必须先有 A，这时候两个对象都还没创建出来，无法提前暴露到缓存中。 
 第二种，prototype 作用域的循环依赖。prototype 作用域的 Bean 每次获取都会创建新实例，Spring 无法缓存这些实例，所以也无法解决循环依赖。 
 ----面试中可以不背，方便大家理解 start---- 
 我们来看一个实例，先是 PrototypeBeanA： 
 @Component 
 @Scope ( "prototype" ) 
 public class PrototypeBeanA { 
 private final PrototypeBeanB prototypeBeanB ; 
 
 @Autowired 
 public PrototypeBeanA ( PrototypeBeanB prototypeBeanB ) { 
 this . prototypeBeanB = prototypeBeanB ; 
 } 
 } 
 然后是 PrototypeBeanB： 
 @Component 
 @Scope ( "prototype" ) 
 public class PrototypeBeanB { 
 private final PrototypeBeanA prototypeBeanA ; 
 
 @Autowired 
 public PrototypeBeanB ( PrototypeBeanA prototypeBeanA ) { 
 this . prototypeBeanA = prototypeBeanA ; 
 } 
 } 
 再然后是测试： 
 @SpringBootApplication 
 public class DemoApplication { 
 
 public static void main ( String [] args ) { 
 SpringApplication . run ( DemoApplication . class , args ); 
 } 
 
 @Bean 
 CommandLineRunner commandLineRunner ( ApplicationContext ctx ) { 
 return args -> { 
 // 尝试获取PrototypeBeanA的实例 
 PrototypeBeanA beanA = ctx . getBean ( PrototypeBeanA . class ); 
 }; 
 } 
 } 
 运行结果： 
 
 ----面试中可以不背，方便大家理解 end---- ### 为什么需要三级缓存而不是两级？ 
 Spring 设计三级缓存主要是为了解决 AOP 代理的问题。 
 我举个具体的例子来说明一下。假设我们有 A 和 B 两个类相互依赖，A 的某个方法上面还标注了 @Transactional 注解，这意味着 A 最终需要被 Spring 创建成一个代理对象。 
 @Component 
 public class A { 
 @Autowired 
 private B b ; 
 
 @Transactional // A需要被AOP代理 
 public void doSomething () { 
 // 业务逻辑 
 } 
 } 
 
 @Component 
 public class B { 
 @Autowired 
 private A a ; 
 } 
 如果只有二级缓存的话，当创建 A 的时候，我们需要把 A 的原始对象提前放到缓存里面，然后 B 在创建的时候从缓存中拿到 A 的原始对象。 
 // 假设只有两级缓存 
 Map < String , Object > singletonObjects = new HashMap <>(); // 完整Bean 
 Map < String , Object > earlySingletonObjects = new HashMap <>(); // 半成品Bean 
 但是问题来了，A 完成初始化后，由于有 @Transactional 注解，Spring 会把 A 包装成一个代理对象放到容器中。这样就出现了一个很严重的问题：B 里面持有的是 A 的原始对象，而容器中存的是 A 的代理对象，同一个 Bean 居然有两个不同的实例，这肯定是不对的。 
 
 三级缓存就是为了解决这个问题而设计的。三级缓存里面存放的不是 Bean 的实例，而是一个对象工厂，这是一个函数式接口。 
 当 B 需要 A 的时候，会调用这个对象工厂的 getObject 方法，这个方法里面会判断 A 是否需要被代理。如果需要代理，就创建 A 的代理对象返回给 B；如果不需要代理，就返回 A 的原始对象。这样就保证了 B 拿到的 A 和最终放入容器的 A 是同一个对象。 
 Map < String , ObjectFactory <?>> singletonFactories = new HashMap <>(); 
 // Spring源码中的逻辑 
 addSingletonFactory ( beanName , () -> getEarlyBeanReference ( beanName , mbd , bean )); 
 protected Object getEarlyBeanReference ( String beanName , RootBeanDefinition mbd , Object bean ) { 
 Object exposedObject = bean ; 
 if (! mbd . isSynthetic () && hasInstantiationAwareBeanPostProcessors ()) { 
 for ( BeanPostProcessor bp : getBeanPostProcessors ()) { 
 if ( bp instanceof SmartInstantiationAwareBeanPostProcessor ) { 
 SmartInstantiationAwareBeanPostProcessor ibp = ( SmartInstantiationAwareBeanPostProcessor ) bp ; 
 // 关键：如果需要代理，这里会创建代理对象 
 exposedObject = ibp . getEarlyBeanReference ( exposedObject , beanName ); 
 } 
 } 
 } 
 return exposedObject ; 
 } 
 简单来说，三级缓存的核心作用就是延迟决策。它让 Spring 在真正需要 Bean 的时候才决定返回原始对象还是代理对象，这样就避免了对象不一致的问题。如果没有三级缓存，Spring 要么无法在循环依赖的情况下支持 AOP，要么就会出现同一个 Bean 有多个实例的问题，这些都是不可接受的。 
 
 
 如果缺少二级缓存会有什么问题？ 
 二级缓存 earlySingletonObjects 主要是用来存放那些已经通过三级缓存的对象工厂创建出来的早期 Bean 引用。 
 
 假设我们有 A、B、C 三个 Bean，A 依赖 B 和 C，B 和 C 都依赖 A，形成了一个复杂的循环依赖。在没有二级缓存的情况下，每次 B 或者 C 需要获取 A 的时候，都需要调用三级缓存中 A 的 ObjectFactory.getObject() 方法。这意味着如果 A 需要被代理的话，代理对象可能会被重复创建多次，这显然是不合理的。 
 // 没有二级缓存的伪代码 
 public Object getSingleton ( String beanName ) { 
 Object singletonObject = singletonObjects . get ( beanName ); 
 
 if ( singletonObject == null && isSingletonCurrentlyInCreation ( beanName )) { 
 // 直接从三级缓存获取 
 ObjectFactory <?> singletonFactory = singletonFactories . get ( beanName ); 
 if ( singletonFactory != null ) { 
 return singletonFactory . getObject (); // 每次都会创建新的代理对象！ 
 } 
 } 
 return singletonObject ; 
 } 
 我举个具体的例子。比如 A 有 @Transactional 注解需要被 AOP 代理，B 在初始化的时候需要 A，会调用一次对象工厂创建 A 的代理对象。接着 C 在初始化的时候也需要 A，又会调用一次对象工厂，可能又创建了一个 A 的代理对象。这样 B 和 C 拿到的可能就是两个不同的 A 代理对象，这就违反了单例 Bean 的语义。 
 @Service 
 public class ServiceA { 
 @Autowired 
 private ServiceB serviceB ; 
 
 @Transactional // 需要 AOP 代理 
 public void methodA () { 
 // 业务逻辑 
 } 
 } 
 
 @Service 
 public class ServiceB { 
 @Autowired 
 private ServiceA serviceA ; // 获得代理对象 A1 
 
 @Autowired 
 private ServiceC serviceC ; 
 } 
 
 @Service 
 public class ServiceC { 
 @Autowired 
 private ServiceA serviceA ; // 可能获得代理对象 A2 
 } 
 二级缓存就是为了解决这个问题。当第一次通过对象工厂创建了 A 的早期引用之后，就把这个引用放到二级缓存中，同时从三级缓存中移除对象工厂。 
 // 第一次获取 A 
 ObjectFactory < A > factory = singletonFactories . get ( "serviceA" ); 
 Object proxyA = factory . getObject (); // 创建代理 
 earlySingletonObjects . put ( "serviceA" , proxyA ); // 缓存代理 
 singletonFactories . remove ( "serviceA" ); 
 
 // 第二次获取 A 
 Object cachedA = earlySingletonObjects . get ( "serviceA" ); // 直接返回缓存的代理 
 // proxyA == cachedA ✓ 
 后续如果再有其他 Bean 需要 A，就直接从二级缓存中获取，不需要再调用对象工厂了。 
 
 
 
 
 
 
 
 
 
 
 AOP
