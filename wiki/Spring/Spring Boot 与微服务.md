### 🌟介绍一下 SpringBoot？ 
 Spring Boot 可以说是 Spring 生态的一个重大突破，它极大地简化了 Spring 应用的开发和部署过程。 
 
 以前我们用 Spring 开发项目的时候，需要配置一大堆 XML 文件，包括 Bean 的定义、数据源配置、事务配置等等，非常繁琐。而且还要手动管理各种 jar 包的依赖关系，很容易出现版本冲突的问题。部署的时候还要单独搭建 Tomcat 服务器，整个过程很复杂。Spring Boot 就是为了解决这些痛点而生的。 
 “约定大于配置”是 Spring Boot 最核心的理念。它预设了很多默认配置，比如默认使用内嵌的 Tomcat 服务器，默认的日志框架是 Logback 等等。这样，我们开发者就只需要关注业务逻辑，不用再纠结于各种配置细节。 
 自动装配也是 Spring Boot 的一大特色，它会根据项目中引入的依赖自动配置合适的 Bean。比如说，我们引入了 Spring Data JPA，Spring Boot 就会自动配置数据源；比如说，我们引入了 Spring Security，Spring Boot 就会自动配置安全相关的 Bean。 
 Spring Boot 还提供了很多开箱即用的功能，比如 Actuator 监控、DevTools 开发工具、Spring Boot Starter 等等。Actuator 可以让我们轻松监控应用的健康状态、性能指标等；DevTools 可以加快开发效率，比如自动重启、热部署等；Spring Boot Starter 则是一些预配置好的依赖集合，让我们可以快速引入某些常用的功能。 
 
 Spring Boot常用注解有哪些？ 
 Spring Boot 的注解很多，我就挑两个说一下吧。 
 
 @SpringBootApplication ：这是 Spring Boot 的核心注解，它是一个组合注解，包含了 @Configuration 、 @EnableAutoConfiguration 和 @ComponentScan 。它标志着一个 Spring Boot 应用的入口。 
 @SpringBootTest ：用于测试 Spring Boot 应用的注解，它会加载整个 Spring 上下文，适合集成测试。 ### 🌟Spring Boot的自动装配原理了解吗？ 
 在 Spring Boot 中，开启自动装配的注解是 @EnableAutoConfiguration 。这个注解会告诉 Spring 去扫描所有可用的自动配置类。 
 
 Spring Boot 为了进一步简化，把这个注解包含到了 @SpringBootApplication 注解中。也就是说，当我们在主类上使用 @SpringBootApplication 注解时，实际上就已经开启了自动装配。 
 当 main 方法运行的时候，Spring 会去类路径下找 spring.factories 这个文件，读取里面配置的自动配置类列表。比如在我们的 技术派项目 中，paicoding-core 和 paicoding-service 模块里都有 spring.factories，分别注册了 ForumCoreAutoConfig 和 ServiceAutoConfig，这两个配置类就会在项目启动的时候被自动加载。 
 
 然后每个自动配置类内部，通常会有一个 @Configuration 注解，同时结合各种 @Conditional 注解来做条件控制。像 技术派 的 RabbitMqAutoConfig 类，就用了 @ConditionalOnProperty 注解来判断配置文件里有没有开启 rabbitmq.switchFlag，来决定是否初始化 RabbitMQ 消费线程。 
 
 另外一个常见的场景是自动注入 Bean，比如 技术派 的 ServiceAutoConfig 中就用了 @ComponentScan 来扫描 service 包， @MapperScan 扫描 MyBatis 的 mapper 接口，实现业务层和 DAO 层的自动装配。 
 具体的执行过程可以总结为：Spring Boot 项目在启动时加载所有的自动配置类，然后逐个检查它们的生效条件，当条件满足时就实例化并创建相应的 Bean。 
 
 自动装配的执行时机是在 Spring 容器启动的时候。具体来说是在 ConfigurationClassPostProcessor 这个 BeanPostProcessor 中处理的，它会解析 @Configuration 类，包括通过 @Import 导入的自动配置类。 
 protected AutoConfigurationEntry getAutoConfigurationEntry ( AnnotationMetadata annotationMetadata ) { 
 // 检查自动配置是否启用。如果@ConditionalOnClass等条件注解使得自动配置不适用于当前环境，则返回一个空的配置条目。 
 if (! isEnabled ( annotationMetadata )) { 
 return EMPTY_ENTRY ; 
 } 
 
 // 获取启动类上的@EnableAutoConfiguration注解的属性，这可能包括对特定自动配置类的排除。 
 AnnotationAttributes attributes = getAttributes ( annotationMetadata ); 
 
 // 从spring.factories中获取所有候选的自动配置类。这是通过加载META-INF/spring.factories文件中对应的条目来实现的。 
 List < String > configurations = getCandidateConfigurations ( annotationMetadata , attributes ); 
 
 // 移除配置列表中的重复项，确保每个自动配置类只被考虑一次。 
 configurations = removeDuplicates ( configurations ); 
 
 // 根据注解属性解析出需要排除的自动配置类。 
 Set < String > exclusions = getExclusions ( annotationMetadata , attributes ); 
 
 // 检查排除的类是否存在于候选配置中，如果存在，则抛出异常。 
 checkExcludedClasses ( configurations , exclusions ); 
 
 // 从候选配置中移除排除的类。 
 configurations . removeAll ( exclusions ); 
 
 // 应用过滤器进一步筛选自动配置类。过滤器可能基于条件注解如@ConditionalOnBean等来排除特定的配置类。 
 configurations = getConfigurationClassFilter (). filter ( configurations ); 
 
 // 触发自动配置导入事件，允许监听器对自动配置过程进行干预。 
 fireAutoConfigurationImportEvents ( configurations , exclusions ); 
 
 // 创建并返回一个包含最终确定的自动配置类和排除的配置类的AutoConfigurationEntry对象。 
 return new AutoConfigurationEntry ( configurations , exclusions ); 
 } ### 🌟如何自定义一个 SpringBoot Starter? 
 第一步，SpringBoot 官方建议第三方 starter 的命名格式是 xxx-spring-boot-starter，所以我们可以创建一个名为 my-spring-boot-starter 的项目，一共包括两个模块，一个是 autoconfigure 模块，包含自动配置逻辑；一个是 starter 模块，只包含依赖声明。 
 < properties > 
 < spring.boot.version >2.3.1.RELEASE</ spring.boot.version > 
 </ properties > 
 
 < dependencies > 
 < dependency > 
 < groupId >org.springframework.boot</ groupId > 
 < artifactId >spring-boot-autoconfigure</ artifactId > 
 < version >${spring.boot.version}</ version > 
 </ dependency > 
 < dependency > 
 < groupId >org.springframework.boot</ groupId > 
 < artifactId >spring-boot-starter</ artifactId > 
 < version >${spring.boot.version}</ version > 
 </ dependency > 
 </ dependencies > 
 第二步，创建一个自动配置类，通常在 autoconfigure 包下，该类的作用是根据配置文件中的属性来创建和配置 Bean。 
 @Configuration 
 @EnableConfigurationProperties ( MyStarterProperties . class ) 
 public class MyServiceAutoConfiguration { 
 
 @Bean 
 @ConditionalOnMissingBean 
 public MyService myService ( MyStarterProperties properties ) { 
 return new MyService ( properties . getMessage ()); 
 } 
 } 
 第三步，创建一个配置属性类，用于读取配置文件中的属性。通常使用 @ConfigurationProperties 注解来标记这个类。 
 @ConfigurationProperties ( prefix = "mystarter" ) 
 public class MyStarterProperties { 
 private String message = "二哥的 Java 进阶之路不错啊!" ; 
 
 public String getMessage () { 
 return message ; 
 } 
 
 public void setMessage ( String message ) { 
 this . message = message ; 
 } 
 } 
 第四步，创建一个简单的服务类，用于提供业务逻辑。 
 public class MyService { 
 private final String message ; 
 
 public MyService ( String message ) { 
 this . message = message ; 
 } 
 
 public String getMessage () { 
 return message ; 
 } 
 } 
 第五步，在 src/main/resources/META-INF 目录下创建一个名为 spring.factories 文件，告诉 SpringBoot 在启动时要加载我们的自动配置类。 
 org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
com.itwanger.mystarter.autoconfigure.MyServiceAutoConfiguration 
 第六步，使用 Maven 打包这个项目。 
 mvn clean install 
 第七步，在其他的 Spring Boot 项目中，通过 Maven 来添加这个自定义的 Starter 依赖，并通过 application.properties 配置信息： 
 mystarter.message=javabetter.cn 
 然后就可以在 Spring Boot 项目中注入 MyStarterProperties 来使用它。 
 
 启动项目，然后在浏览器中输入 localhost:8081/hello ，就可以看到返回的内容是 javabetter.cn ，说明我们的自定义 Starter 已经成功工作了。 
 
 
 Spring Boot Starter 的原理了解吗？ 
 Starter 的核心思想是把相关的依赖打包在一起，让开发者只需要引入一个 starter 依赖，就能获得完整的功能模块。 
 当我们在 pom.xml 中引入一个 starter 时，Maven 就会自动解析这个 starter 的依赖树，把所有需要的 jar 包都下载下来。 
 每个 starter 都会包含对应的自动配置类，这些配置类通过条件注解来判断是否应该生效。比如当我们引入了 spring-boot-starter-web ，它会自动配置 Spring MVC、内嵌的 Tomcat 服务器等。 
 spring.factories 文件是 Spring Boot 自动装配的核心，它位于每个 starter 的 META-INF 目录下。这个文件列出了所有的自动配置类，Spring Boot 在启动时会读取这个文件，加载对应的配置类。 
 org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
com.example.demo.autoconfigure.DemoAutoConfiguration,\
com.example.demo.autoconfigure.AnotherAutoConfiguration ### 🌟Spring Boot 启动原理了解吗？ 
 Spring Boot 的启动主要围绕两个核心展开，一个是 @SpringBootApplication 注解，一个是 SpringApplication.run() 方法。 
 
 我先说一下 @SpringBootApplication 注解，它是一个组合注解，包含了 @SpringBootConfiguration 、 @EnableAutoConfiguration 和 @ComponentScan ，这三个注解的作用分别是： 
 
 @SpringBootConfiguration ：标记这个类是一个 Spring Boot 配置类，相当于一个 Spring 配置文件。 
 @EnableAutoConfiguration ：告诉 Spring Boot 可以进行自动配置。比如说，项目引入了 Spring MVC 的依赖，那么 Spring Boot 就会自动配置 DispatcherServlet、HandlerMapping 等组件。 
 @ComponentScan ：扫描当前包及其子包下的组件，注册为 Bean。 
 
 
 好，接下来我再说一下 SpringApplication.run() 方法，它是 Spring Boot 项目的启动入口，内部流程大致可以分为 5 个步骤： 
 ①、创建 SpringApplication 实例，并识别应用类型，比如说是标准的 Servlet Web 还是响应式的 WebFlux，然后准备监听器和初始化监听容器。 
 ②、创建并准备 ApplicationContext，将主类作为配置源进行加载。 
 ③、刷新 Spring 上下文，触发 Bean 的实例化，比如说扫描并注册 @ComponentScan 指定路径下的 Bean。 
 ④、触发自动配置，在 Spring Boot 2.7 及之前是通过 spring.factories 加载的，3.x 是通过读取 AutoConfiguration.imports ，并结合 @ConditionalOn 系列注解依据条件注册 Bean。 
 ⑤、如果引入了 Web 相关依赖，会创建并启动 Tomcat 容器，完成 HTTP 端口监听。 
 关键的代码逻辑如下： 
 public ConfigurableApplicationContext run ( String ... args ) { 
 // 1. 创建启动时的监听器并触发启动事件 
 SpringApplicationRunListeners listeners = getRunListeners ( args ); 
 listeners . starting (); 
 
 // 2. 准备运行环境 
 ConfigurableEnvironment environment = prepareEnvironment ( listeners ); 
 configureIgnoreBeanInfo ( environment ); 
 
 // 3. 创建上下文 
 ConfigurableApplicationContext context = createApplicationContext (); 
 
 try { 
 // 4. 准备上下文 
 prepareContext ( context , environment , listeners , args ); 
 
 // 5. 刷新上下文，完成 Bean 初始化和装配 
 refreshContext ( context ); 
 
 // 6. 调用运行器 
 afterRefresh ( context , args ); 
 
 // 7. 触发启动完成事件 
 listeners . started ( context ); 
 } catch ( Exception ex ) { 
 handleRunFailure ( context , ex , listeners ); 
 } 
 
 return context ; 
 } 
 
 为什么 Spring Boot 在启动的时候能够找到 main 方法上的@SpringBootApplication 注解？ 
 其实 Spring Boot 并不是自己找到 @SpringBootApplication 注解的，而是我们通过程序告诉它的。 
 @SpringBootApplication 
 public class MyApplication { 
 public static void main ( String [] args ) { 
 SpringApplication . run ( MyApplication . class , args ); 
 } 
 } 
 我们把 Application.class 作为参数传给了 run 方法。这个 Application 类标注了 @SpringBootApplication 注解，用来告诉 Spring Boot：请用这个类作为配置类来启动。 
 然后，SpringApplication 在运行时就会把这个类注册到 Spring 容器中。 
 
 
 Spring Boot 默认的包扫描路径是什么？ 
 Spring Boot 默认的包扫描路径是主类所在的包及其子包。 
 比如说在 技术派实战项目 中，启动类 QuickForumApplication 所在的包是 com.github.paicoding.forum.web ，那么 Spring Boot 默认会扫描 com.github.paicoding.forum.web 包及其子包下的所有组件。 ### 说一下 SpringBoot 和 SpringMVC 的区别？（补充） 
 
 2024 年 04 月 04 日增补 
 
 SpringMVC 是 Spring 的一个模块，专门用来做 Web 开发，处理 HTTP 请求和响应。而Spring Boot 的目标是简化 Spring 应用的开发过程，可以通过 starter 的方式快速集成 SpringMVC。 
 传统的 Web 项目通常需要手动配置很多东西，比如 DispatcherServlet、ViewResolver、HandlerMapping 等等。而 Spring Boot 则通过自动装配的方式，帮我们省去了这些繁琐的配置。 
 Spring Boot 还内置了一个嵌入式的 Servlet 容器，比如 Tomcat，这样我们就不需要像传统的 Web 项目那样需要配置 Tomcat 容器，然后导出 war 包再运行。只需要打包成一个 JAR 文件，就可以直接通过 java -jar 命令运行。 ### Spring Boot 和 Spring 有什么区别？（补充） 
 
 2024 年 07 月 09 日新增 
 
 从定位上来说，Spring 是一个完整的应用开发框架，提供了 IoC 容器、AOP 等各种功能模块。Spring Boot 不是一个独立的框架，而是基于 Spring 框架的脚手架，它的目标是让 Spring 应用的开发和部署变得简单高效。 
 Spring 项目需要我们手动管理每个 jar 包的版本，经常会遇到版本冲突的问题。比如我们要用 Spring MVC，需要引入 spring-webmvc、jackson-databind、hibernate-validator 等一堆依赖，还要确保版本兼容。Spring Boot 通过 starter 机制解决了这个问题，只需要引入 spring-boot-starter-web 这一个依赖就可以了，它包含了所有相关的 jar 包，而且版本都是测试过的，可以兼容的。 
 
 
 
 
 
 
 
 
 Spring Cloud ### 对 SpringCloud 了解多少？ 
 Spring Cloud 其实是一套基于 Spring Boot 的微服务全家桶，帮我们把分布式系统里的基础设施做了一个“拿来即用”的封装，比如服务注册与发现、配置管理、负载均衡、熔断限流、链路追踪这些。 
 我自己用得比较多的是 Spring Cloud Alibaba 这一套， PmHub 这个项目 就是一个例子，比如： 
 
 我们使用 Nacos 做服务注册和配置中心，并且将配置信息持久化到了 MySQL 中，这样就可以统一管理注册信息和配置信息，还支持动态刷新配置。 
 使用 Gateway 做 API 网关，支持路由转发、全局过滤器、限流等功能。 
 使用 Sentinel 做熔断、限流、降级策略，结合业务自定义规则比较方便。 
 使用 OpenFeign 做服务间的声明式调用，比 RestTemplate 更省代码，也更清晰可维护。 
 使用 Seata 处理分布式事务，这个在订单、支付、审批流场景中用得比较多。 
 
 
 我觉得 Spring Cloud 最大的价值是统一了技术栈和编程模型，不需要我们去自己从零实现注册中心、熔断器这些基础设施。 
 
 什么是微服务？ 
 微服务就是把一个大的、复杂的单体应用，拆成一个个围绕业务功能独立部署的小服务，每个服务维护自己的数据和逻辑，服务之间通过轻量级的通信机制（比如 gRPC）来协作。 
 
 微服务的核心价值我认为是：业务之间的边界更清晰了，不同团队可以独立开发、部署、扩展某个功能，不会因为一个小的改动就要把整套系统重新上线。 
 像 PmHub 这个项目 就是从单体拆分成微服务的，包括启动网关、认证、流程、项目管理、代码生成等多个服务。 
 
 
 
 
 
 
 
 
 
 
 补充 ### SpringTask 了解吗？ 
 SpringTask 是 Spring 框架提供的一个轻量级的任务调度框架，它允许我们开发者通过简单的注解来配置和管理定时任务。 
 使用起来也非常方便，首先使用 @EnableScheduling 开启定时任务的支持。 
 
 然后在需要定时任务的方法上加上 @Scheduled 注解，支持 fixedRate、fixedDelay 和 cron 表达式。 技术派实战项目 中，就使用过 cron 表达式在每天凌晨定时刷新文章的 sitemap。 
 @Scheduled ( cron = "0 15 5 * * ?" ) 
 public void autoRefreshCache () { 
 log . info ( "开始刷新sitemap.xml的url地址，避免出现数据不一致问题!" ); 
 refreshSitemap (); 
 log . info ( "刷新完成！" ); 
 } 
 
 用SpringTask资源占用太高，有什么其他的方式解决？（补充） 
 
 2024年05月27日新增 
 
 首先我们需要分析一下 SpringTask 资源占用高的原因。 
 默认情况下，SpringTask 会使用单线程执行所有定时任务，如果某个任务执行时间长或者任务数量多，就会造成阻塞。而且它是基于内存的，所有任务信息都保存在 JVM 中，应用重启后任务状态就丢失了。 
 那我们可以通过配置线程池来解决这个问题。 
 @Configuration 
 @EnableScheduling 
 public class ScheduleConfig implements SchedulingConfigurer { 
 @Override 
 public void configureTasks ( ScheduledTaskRegistrar taskRegistrar ) { 
 taskRegistrar . setScheduler ( Executors . newScheduledThreadPool ( 10 )); 
 } 
 } 
 另外，就是可以将 SpringTask 迁移到其他的任务调度框架，比如 Quartz、XXL-JOB 等。 
 Quartz 功能更强大，支持集群、持久化、灵活的调度策略。还可以把任务信息持久化到数据库，支持集群部署，一个节点挂了其他节点可以接管任务。 
 使用 XXL-JOB 是分布式场景下更彻底的解决方案，有独立的调度中心，任务配置和执行可以分离；支持分片执行，大任务可以拆分成多个子任务并行处理。 
 /** 
 * 2、分片广播任务 
 */ 
 @XxlJob ( "shardingJobHandler" ) 
 public void shardingJobHandler () throws Exception { 
 // 分片参数 
 int shardIndex = com . xxl . job . core . context . XxlJobHelper . getShardIndex (); 
 int shardTotal = com . xxl . job . core . context . XxlJobHelper . getShardTotal (); 
 
 logger . info ( "分片广播任务开始执行，当前分片序号 = {}, 总分片数 = {}" , shardIndex , shardTotal ); 
 
 // 业务逻辑处理，根据分片参数处理不同的数据 
 for ( int i = shardIndex ; i < 100 ; i += shardTotal ) { 
 logger . info ( "第{}片, 处理数据: {}" , shardIndex , i ); 
 
 // 模拟处理数据的时间 
 TimeUnit . MILLISECONDS . sleep ( 100 ); 
 } 
 
 logger . info ( "分片广播任务执行完成" ); 
 } ### Spring Cache 了解吗？ 
 Spring Cache 是 Spring 框架提供的一套缓存抽象，它通过提供统一的接口来支持多种缓存实现，如 Redis、Caffeine 等。 
 
 我们只需要在方法上加几个注解，Spring 就会自动处理缓存的存取，这种声明式的缓存使用方式让业务代码和缓存逻辑能够完全分离。 
 最常用的注解是 @Cacheable ，用来标识方法的返回值需要被缓存。 
 @Cacheable ( value = "users" , key = "#id" ) 
 public User getUserById ( Long id ) { 
 return userDao . findById ( id ); 
 } 
 方法在第一次执行后会把结果缓存起来，后续的调用就直接从缓存中返回，不再执行方法体。 
 还有 @CacheEvict 注解，用于在方法执行前或执行后清除缓存。 
 @CacheEvict ( value = "users" , key = "#id" ) 
 public void deleteUserById ( Long id ) { 
 userDao . deleteById ( id ); 
 } 
 Spring Cache 是基于 AOP 实现的，通过拦截方法调用，在调用前后插入缓存逻辑。需要我们在配置中先启用缓存功能。 
 @Configuration 
 @EnableCaching 
 public class CacheConfig { 
 @Bean 
 public CacheManager cacheManager () { 
 RedisCacheManager . Builder builder = RedisCacheManager 
 . RedisCacheManagerBuilder 
 . fromConnectionFactory ( redisConnectionFactory ()) 
 . cacheDefaults ( cacheConfiguration ()); 
 return builder . build (); 
 } 
 } 
 
 Spring Cache 和 Redis 有什么区别？ 
 Spring Cache 和 Redis 的区别其实是抽象层和具体实现的区别。Spring Cache 只是提供了一套统一的接口和注解来管理缓存，本身并不提供缓存能力，而 Redis 是具体的缓存实现。 
 在使用层面上，Spring Cache 更简单，只需要在方法上添加注解就行，框架会帮我们自动处理。 
 @Cacheable ( "users" ) 
 public User getUser ( Long id ) { 
 return userDao . findById ( id ); 
 } 
 如果用 Redis 则需要我们手动处理缓存逻辑： 
 public User getUser ( Long id ) { 
 String key = "user:" + id ; 
 User user = ( User ) redisTemplate . opsForValue (). get ( key ); 
 if ( user == null ) { 
 user = userDao . findById ( id ); 
 redisTemplate . opsForValue (). set ( key , user , 30 , TimeUnit . MINUTES ); 
 } 
 return user ; 
 } 
 在实际的项目当中，我通常会选择使用 Spring Cache 来处理一些简单的缓存业务，但对于一些复杂的业务场景，对于复杂的业务逻辑，比如分布式锁、计数器、排行榜等，我会直接用 Redis。 
 
 
 有了 Redis 为什么还需要 Spring Cache？ 
 虽然 Redis 非常强大，但 Spring Cache 可以简化缓存的管理。我们直接在方法上加注解就能实现缓存逻辑，减少了手动操作 Redis 的代码量。 
 @Cacheable ( "users" ) 
 public User getUser ( Long id ) { 
 return userDao . findById ( id ); 
 } 
 此外，Spring Cache 还能灵活切换底层的缓存实现，比如说从 Redis 切换到 Caffeine。 
 
 
 说说 Spring Cache 的底层原理？ 
 Spring Cache 的底层是通过 AOP 实现的。当我们在方法上标注了 @Cacheable 注解时，Spring 会在项目启动的时候扫描这些注解，并创建代理对象。代理对象会拦截所有的方法调用，在方法执行前后插入缓存相关的逻辑。 
 
 具体的执行流程是这样的： 
 当用户调用一个被缓存注解标注的方法时，实际上调用的是代理对象而不是原始对象。 
 代理对象中的 CacheInterceptor 拦截器会先解析方法上的缓存注解，获取缓存名称、key 生成规则、过期时间这些配置信息。然后根据注解的类型执行不同的缓存策略，比如 @Cacheable 会先去缓存中查找数据，如果找到就直接返回，不执行原方法；如果没找到，就执行原方法获取结果，然后将结果存入缓存再返回。 
 缓存 key 的生成是通过 KeyGenerator 组件完成的，默认情况下会根据方法的参数来生成 key。如果我们在注解中指定了 key 属性，Spring 会使用 SpEL 表达式引擎来解析这个表达式，结合方法参数、返回值等上下文信息计算出具体的 key 值。 
 底层的缓存存储是通过 CacheManager 和 Cache 这两个抽象接口来管理的。CacheManager 负责管理多个缓存区域，每个 Cache 实例对应一个具体的缓存区域。 
 不管我们使用 Redis、Caffeine 还是其他缓存技术，都需要实现这两个接口。这样 Spring Cache 就能以统一的方式操作不同的缓存实现，实现了很好的解耦。 
 
 
 
 
 
 
 整整两个月，面渣逆袭 Spring 篇第二版终于整理完了，这一版几乎可以说是重写了，每天耗费了大量的精力在上面，可以说是改头换面，有一种士别俩月，当刮目相看的感觉（从 1.3 万字暴涨到 3.4 万字，加餐的同时区分高频低频版）。 
 
 网上的八股其实不少，有些还是付费的，我觉得是一件好事，可以给大家提供更多的选择，但面渣逆袭的含金量懂的都懂。 
 
 面渣逆袭第二版是在星球嘉宾三分恶的初版基础上，加入了二哥自己的思考，加入了 1000 多份真实面经之后的结果，并且从 24 届到 25 届，再到 26 届，帮助了很多小伙伴。未来的 27、28 届，也将因此受益，从而拿到心仪的 offer。 
 能帮助到大家，我很欣慰，并且在重制面渣逆袭的过程中，我也成长了很多，很多薄弱的基础环节都得到了加强，因此第二版的面渣逆袭不只是给大家的礼物，也是我在技术上蜕变的记录。 
 
 
 
 很多时候，我觉得自己是一个佛系的人，不愿意和别人争个高低，也不愿意去刻意宣传自己的作品。 
 我喜欢静待花开。 
 如果你觉得面渣逆袭还不错，可以告诉学弟学妹们有这样一份免费的学习资料，帮我做个口碑。 
 我还会继续优化，也不确定第三版什么时候会来，但我会尽力。 
 愿大家都有一个光明的未来。
