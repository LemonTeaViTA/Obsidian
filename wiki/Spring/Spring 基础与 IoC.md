---
module: Spring
tags: [Spring, IoC, Bean, 依赖注入]
difficulty: medium
last_reviewed: 2026-04-20
---

# Spring 基础与 IoC

## Spring 概述

### Spring是什么？

Spring 是一个 Java 后端开发框架，其最核心的作用是帮我们管理 Java 对象。

其最重要的特性就是 IoC，也就是控制反转。以前我们要使用一个对象时，都要自己先 new 出来。但有了 Spring 之后，我们只需要告诉 Spring 我们需要什么对象，它就会自动帮我们创建好并注入到 Spring 容器当中。

另外，Spring 还提供了 [[AOP 与动态代理|AOP]]，也就是面向切面编程，在我们需要做一些通用功能的时候特别有用，比如说日志记录、权限校验、事务管理这些，我们不用在每个方法里都写重复的代码，直接用 AOP 就能统一处理。

Spring 的生态也特别丰富，像 Spring Boot 能让我们快速搭建项目，Spring MVC 能帮我们处理 web 请求，Spring Data 能帮我们简化数据库操作，Spring Cloud 能帮我们做微服务架构等等。

### Spring有哪些特性？

首先最核心的就是 IoC 控制反转和 DI 依赖注入。Spring 能帮我们管理对象的创建和依赖关系。

第二个就是 AOP 面向切面编程。在我们处理一些横切关注点的时候特别有用，比如说我们要给某些 Controller 方法都加上权限控制，用了 AOP 之后，我们只需要写一个切面类，定义好切点和通知，就能统一处理了。

还有就是 Spring 对各种企业级功能的集成支持也特别好。比如数据库访问，不管我们用 JDBC、MyBatis-Plus 还是 Hibernate，Spring 都能很好地集成。

另外 Spring 的配置也很灵活，既支持 XML 配置，也支持注解配置，现在我们基本都用注解了，写起来更简洁。

### Spring有哪些模块呢？

首先是 Spring Core 模块，这是整个 Spring 框架的基础，包含了 IoC 容器和依赖注入等核心功能。还有 Spring Beans 模块，负责 Bean 的配置和管理。

然后是 Spring Context 上下文模块，它在 Core 的基础上提供了更多企业级的功能，比如国际化、事件传播、资源加载这些。ApplicationContext 就是在这个模块里面的。

Spring AOP 模块提供了面向切面编程的支持，我们用的 `@Transactional`、自定义切面这些都是基于这个模块。

Web 开发方面，Spring Web 模块提供了基础的 Web 功能，Spring WebMVC 就是我们常用的 MVC 框架，用来处理 HTTP 请求和响应。

数据访问方面，Spring JDBC 简化了 JDBC 的使用，Spring ORM 提供了对 MyBatis-Plus 等 ORM 框架的集成支持。

Spring Test 模块提供了测试支持，可以很方便地进行单元测试和集成测试。

### Spring有哪些常用注解呢？

Bean 管理相关的注解：`@Component` 是最基础的，用来标识一个类是 Spring 组件。像 `@Service`、`@Repository`、`@Controller` 这些都是 `@Component` 的特化版本，分别用在服务层、数据访问层和控制器层。

依赖注入方面，`@Autowired` 是用得最多的，可以标注在字段、setter 方法或者构造方法上。`@Qualifier` 在有多个同类型 Bean 的时候用来指定具体注入哪一个。`@Resource` 和 `@Autowired` 功能差不多，不过它是按名称注入的。

配置相关的注解：`@Configuration` 标识配置类，`@Bean` 用来定义 Bean，`@Value` 用来注入配置文件中的属性值。

Web 开发的注解：`@RestController` 相当于 `@Controller` 加 `@ResponseBody`，用来做 RESTful 接口。`@RequestMapping` 及其变体 `@GetMapping`、`@PostMapping`、`@PutMapping`、`@DeleteMapping` 用来映射 HTTP 请求。

AOP 相关的注解：`@Aspect` 定义切面，`@Pointcut` 定义切点，`@Before`、`@After`、`@Around` 这些定义通知类型。

生命周期相关的：`@PostConstruct` 在 Bean 初始化后执行，`@PreDestroy` 在 Bean 销毁前执行。

### 🌟Spring用了哪些设计模式？

首先是工厂模式，BeanFactory 就是一个典型的工厂，它负责创建和管理所有的 Bean 对象。我们平时用的 ApplicationContext 其实也是 BeanFactory 的一个实现。

单例模式也是 Spring 的默认行为。默认情况下，Spring 容器中的 Bean 都是单例的，整个应用中只会有一个实例。

代理模式在 AOP 中用得特别多。Spring AOP 的底层实现就是基于[[AOP 与动态代理|动态代理]]的，对于实现了接口的类用 JDK 动态代理，没有实现接口的类用 CGLIB 代理。

模板方法模式在 Spring 里也很常见，比如 JdbcTemplate。它定义了数据库操作的基本流程：获取连接、执行 SQL、处理结果、关闭连接，但是具体的 SQL 语句和结果处理逻辑由我们来实现。

观察者模式在 Spring 的事件机制中有所体现。我们可以通过 ApplicationEvent 和 ApplicationListener 来实现事件的发布和监听。

### Spring容器和Web容器之间的区别知道吗？

首先从概念上来说，Spring 容器是一个 IoC 容器，主要负责管理 Java 对象的生命周期和依赖关系。而 Web 容器，比如 Tomcat、Jetty 这些，是用来运行 Web 应用的容器，负责处理 HTTP 请求和响应，管理 Servlet 的生命周期。

从功能上看，Spring 容器专注于业务逻辑层面的对象管理，比如我们的 Service、Dao、Controller 这些 Bean 都是由 Spring 容器来创建和管理的。而 Web 容器主要处理网络通信，比如接收 HTTP 请求、解析请求参数、调用相应的 Servlet，然后把响应返回给客户端。

在实际项目中，这两个容器是相辅相成的。我们的 Web 项目部署在 Tomcat 上的时候，Tomcat 会负责接收 HTTP 请求，然后把请求交给 DispatcherServlet 处理，而 DispatcherServlet 又会去 Spring 容器中查找相应的 Controller 来处理业务逻辑。

现在我们都用 Spring Boot 了，Spring Boot 内置了 Tomcat，把 Web 容器和 Spring 容器都整合在一起了，我们只需要运行一个 jar 包就可以了。

## IoC

### 🌟说一说什么是IoC？

IoC 的全称是 Inversion of Control，也就是控制反转。这里的"控制"指的是对象创建和依赖关系管理的控制权。

以前我们写代码的时候，如果 A 类需要用到 B 类，我们就在 A 类里面直接 new 一个 B 对象出来，这样 A 类就控制了 B 类对象的创建。有了 IoC 之后，这个控制权就"反转"了，不再由 A 类来控制 B 对象的创建，而是交给外部的容器来管理。

```java
// 传统方式：对象主动创建依赖
public class UserService {
    private UserDao userDao;

    public UserService() {
        this.userDao = new UserDaoImpl(); // 主动创建依赖对象
    }
}

// IoC 方式：依赖由外部注入
@Service
public class UserServiceImpl implements UserService {
    @Autowired
    private UserDao userDao; // 不需要主动创建，由 Spring 容器注入
}
```

#### DI和IoC的区别了解吗？

IoC 的思想是把对象创建和依赖关系的控制权由业务代码转移给 Spring 容器。这是一个比较抽象的概念，告诉我们应该怎么去设计系统架构。

而 DI，也就是依赖注入，它是实现 IoC 这种思想的具体技术手段。在 Spring 里，我们用 `@Autowired` 注解就是在使用 DI 的字段注入方式。DI 除了字段注入，还有构造方法注入和 Setter 方法注入等方式。

```
IoC（控制反转）
├── DI（依赖注入） ← 主要实现方式
│   ├── 构造器注入
│   ├── 字段注入
│   └── Setter注入
├── 服务定位器模式
└── 其他实现方式
```

#### 为什么要使用 IoC 呢？

在日常开发中，如果我们需要实现某一个功能，可能至少需要两个以上的对象来协助完成，在没有 Spring 之前，每个对象在需要它的合作对象时，需要自己 new 一个，这就导致对象之间存在耦合关系。

有了 Spring 之后，创建 B 的工作交给了 Spring 来完成，Spring 创建好了 B 对象后就放到容器中，A 告诉 Spring 我需要 B，Spring 就从容器中取出 B 交给 A 来使用。这就是 IoC 的好处，它降低了对象之间的耦合度，让每个对象只关注自己的业务实现。

### 能说一下IoC的实现机制吗？

第一步是加载 Bean 的定义信息。Spring 会扫描我们配置的包路径，找到所有标注了 `@Component`、`@Service`、`@Repository` 这些注解的类，然后把这些类的元信息封装成 BeanDefinition 对象。

第二步是 Bean 工厂的准备。Spring 会创建一个 DefaultListableBeanFactory 作为 Bean 工厂来负责 Bean 的创建和管理。

第三步是 Bean 的实例化和初始化。Spring 会根据 BeanDefinition 来创建 Bean 实例。对于单例 Bean，Spring 会先检查缓存中是否已经存在，如果不存在就创建新实例。创建实例的时候会通过反射调用构造方法，然后进行属性注入，最后执行初始化回调方法。

依赖注入的实现主要是通过反射来完成的。比如我们用 `@Autowired` 标注了一个字段，Spring 在创建 Bean 的时候会扫描这个字段，然后从容器中找到对应类型的 Bean，通过反射的方式设置到这个字段上。

### 说说BeanFactory和ApplicationContext的区别？

BeanFactory 算是 Spring 的"心脏"，而 ApplicationContext 可以说是 Spring 的完整"身躯"。

BeanFactory 提供了最基本的 IoC 能力，负责 Bean 的创建和管理。它采用的是懒加载的方式，也就是说只有当我们真正去获取某个 Bean 的时候，它才会去创建这个 Bean。

ApplicationContext 是 BeanFactory 的子接口，在 BeanFactory 的基础上扩展了很多企业级的功能，还提供了国际化支持、事件发布机制、AOP、JDBC、ORM 框架集成等等。

ApplicationContext 采用的是饿加载的方式，容器启动的时候就会把所有的单例 Bean 都创建好，虽然这样会导致启动时间长一点，但运行时性能更好。

另外一个重要的区别是生命周期管理。ApplicationContext 会自动调用 Bean 的初始化和销毁方法，而 BeanFactory 需要我们手动管理。

### 🌟项目启动时Spring的IoC会做什么？

第一件事是扫描和注册 Bean。IoC 容器会根据我们的配置，比如 `@ComponentScan` 指定的包路径，去扫描所有标注了 `@Component`、`@Service`、`@Controller` 这些注解的类。然后把这些类的元信息包装成 BeanDefinition 对象，注册到容器的 BeanDefinitionRegistry 中。这个阶段只是收集信息，还没有真正创建对象。

第二件事是 Bean 的实例化和注入。IoC 容器会按照依赖关系的顺序开始创建 Bean 实例。对于单例 Bean，容器会通过反射调用构造方法创建实例，然后进行属性注入，最后执行初始化回调方法。

在依赖注入时，容器会根据 `@Autowired`、`@Resource` 这些注解，把相应的依赖对象注入到目标 Bean 中。

### Spring源码看过吗？

看过一些，主要是带着问题去看的，比如遇到一些技术难点或者想深入理解某个功能的时候。

我重点看过的是 IoC 容器的初始化过程，特别是 ApplicationContext 的启动流程。从 `refresh()` 方法开始，包括 Bean 的定义和加载、Bean 工厂的准备、Bean 的实例化和初始化这些关键步骤。

看源码的时候发现 Spring 用了很多设计模式，比如工厂模式、单例模式、模板方法模式等等，这对我平时写代码也很有启发。

还有就是 Spring 的 Bean 生命周期，从 BeanDefinition 的创建到 Bean 的实例化、属性注入、初始化回调，再到最后的销毁，整个过程还是挺复杂的。看了源码之后对 `@PostConstruct`、`@PreDestroy` 这些注解的执行时机就更清楚了。

### 能手写一个简单的 IoC 容器吗？

1、首先定义基础的注解，比如说 `@Component`、`@Autowired` 等。

```java
// 组件注解
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface Component {
}

// 自动注入注解
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Autowired {
}
```

2、核心的 IoC 容器类，负责扫描包路径，创建 Bean 实例，并处理依赖注入。

```java
public class SimpleIoC {
    // Bean容器
    private Map<Class<?>, Object> beans = new HashMap<>();

    /**
     * 注册 Bean
     */
    public void registerBean(Class<?> clazz) {
        try {
            Object instance = clazz.getDeclaredConstructor().newInstance();
            beans.put(clazz, instance);
        } catch (Exception e) {
            throw new RuntimeException("创建Bean失败: " + clazz.getName(), e);
        }
    }

    /**
     * 获取 Bean
     */
    @SuppressWarnings("unchecked")
    public <T> T getBean(Class<T> clazz) {
        return (T) beans.get(clazz);
    }

    /**
     * 依赖注入
     */
    public void inject() {
        for (Object bean : beans.values()) {
            injectFields(bean);
        }
    }

    /**
     * 字段注入
     */
    private void injectFields(Object bean) {
        Field[] fields = bean.getClass().getDeclaredFields();
        for (Field field : fields) {
            if (field.isAnnotationPresent(Autowired.class)) {
                try {
                    field.setAccessible(true);
                    Object dependency = getBean(field.getType());
                    field.set(bean, dependency);
                } catch (Exception e) {
                    throw new RuntimeException("注入失败: " + field.getName(), e);
                }
            }
        }
    }
}
```

3、使用示例，定义一些 Bean 类，并注册到 IoC 容器中。

```java
// DAO层
@Component
class UserDao {
    public void save(String user) {
        System.out.println("保存用户: " + user);
    }
}

// Service层
@Component
class UserService {
    @Autowired
    private UserDao userDao;

    public void createUser(String name) {
        userDao.save(name);
        System.out.println("用户创建完成");
    }
}

// 测试
public class Test {
    public static void main(String[] args) {
        SimpleIoC ioc = new SimpleIoC();

        // 注册Bean
        ioc.registerBean(UserDao.class);
        ioc.registerBean(UserService.class);

        // 依赖注入
        ioc.inject();

        // 使用
        UserService userService = ioc.getBean(UserService.class);
        userService.createUser("王二");
    }
}
```

IoC 容器的核心是管理对象和依赖注入，首先定义注解，然后实现容器的三个核心方法：注册 Bean、获取 Bean、依赖注入；关键是用反射创建对象和注入依赖。

## Bean

### 你是怎么理解Bean的？

在我看来，Bean 本质上就是由 Spring 容器管理的 Java 对象，但它和普通的 Java 对象有很大区别。普通的 Java 对象我们是通过 new 关键字创建的。而 Bean 是交给 Spring 容器来管理的，从创建到销毁都由容器负责。

Spring 提供了多种 Bean 的配置方式，基于注解的方式是最常用的。基于 XML 配置的方式在 Spring Boot 项目中已经不怎么用了。Java 配置类的方式则可以用来解决一些比较复杂的场景，比如说主从数据源，我们可以用 `@Primary` 注解标注主数据源，用 `@Qualifier` 来指定备用数据源。

#### @Component 和 @Bean 有什么区别？

首先从使用上来说，`@Component` 是标注在类上的，而 `@Bean` 是标注在方法上的。`@Component` 告诉 Spring 这个类是一个组件，请把它注册为 Bean，而 `@Bean` 则告诉 Spring 请将这个方法返回的对象注册为 Bean。

从控制权的角度来说，`@Component` 是由 Spring 自动创建和管理的。而 `@Bean` 则是由我们手动创建的，然后再交给 Spring 管理，我们对对象的创建过程有完全的控制权。

### 说说Spring的Bean实例化方式？

第一种是通过构造方法实例化，这是最常用的方式。当我们用 `@Component`、`@Service` 这些注解标注类的时候，Spring 默认通过无参构造器来创建实例的。如果类只有一个有参构造方法，Spring 会自动进行构造方法注入。

第二种是通过静态工厂方法实例化。有时候对象的创建比较复杂，我们会写一个静态工厂方法来创建，然后用 `@Bean` 注解来标注这个方法。

第三种是通过实例工厂方法实例化。先创建工厂对象，然后通过工厂对象的方法来创建 Bean。

第四种是通过 FactoryBean 接口实例化。这是 Spring 提供的一个特殊接口，当我们需要创建复杂对象的时候特别有用。

### 🌟能说一下Bean的生命周期吗？

Bean 的生命周期可以分为 5 个主要阶段：

**第一阶段：实例化。** Spring 容器会根据 BeanDefinition，通过反射调用 Bean 的构造方法创建对象实例。

**第二阶段：属性赋值。** Spring 会给 Bean 的属性赋值，包括通过 `@Autowired`、`@Resource` 这些注解注入的依赖对象，以及通过 `@Value` 注入的配置值。

**第三阶段：初始化。** 这个阶段会依次执行：
- `@PostConstruct` 标注的方法
- InitializingBean 接口的 `afterPropertiesSet` 方法
- 通过 `@Bean` 的 `initMethod` 指定的初始化方法

初始化后，Spring 还会调用所有注册的 BeanPostProcessor 后置处理方法。这个阶段经常用来创建代理对象，比如 AOP 代理。

**第四阶段：使用 Bean。** 比如我们的 Controller 调用 Service，Service 调用 DAO。

**第五阶段：销毁。** 当容器关闭或者 Bean 被移除的时候，会依次执行：
- `@PreDestroy` 标注的方法
- DisposableBean 接口的 `destroy` 方法
- 通过 `@Bean` 的 `destroyMethod` 指定的销毁方法

#### Aware 类型的接口有什么作用？

Aware 接口在 Spring 中是一个很有意思的设计，它们的作用是让 Bean 能够感知到 Spring 容器的一些内部组件。

正常情况下，Bean 不应该直接依赖 Spring 容器，这样可以保持代码的独立性。但有些时候，Bean 确实需要获取容器的一些信息或者组件，Aware 接口就提供了这样一个能力。

最常用的 Aware 接口是 ApplicationContextAware，它可以让 Bean 获取到 ApplicationContext 容器本身，方便在非 Spring 管理的类中通过静态方法获取 Bean 和配置属性。

#### 如果配置了 init-method 和 destroy-method，Spring 会在什么时候调用？

`init-method` 指定的初始化方法会在 Bean 的初始化阶段被调用，具体的执行顺序是：先执行 `@PostConstruct` 标注的方法，然后执行 InitializingBean 接口的 `afterPropertiesSet()` 方法，最后再执行 `init-method` 指定的方法。

`destroy-method` 会在 Bean 销毁阶段被调用，执行顺序同理：先 `@PreDestroy`，再 DisposableBean 的 `destroy()`，最后 `destroy-method`。

### Bean的作用域有哪些？

`singleton` 是默认的作用域，整个 Spring 容器中只会有一个 Bean 实例。不管在多少个地方注入这个 Bean，拿到的都是同一个对象。实际开发中，像 Service、Dao 这些业务组件基本都是单例的。

当把 scope 设置为 `prototype` 时，每次从容器中获取 Bean 的时候都会创建一个新的实例。当需要处理一些有状态的 Bean 时会用到 prototype。

需要注意的是，在 singleton Bean 中注入 prototype Bean 时要小心，因为 singleton Bean 只创建一次，所以 prototype Bean 也只会注入一次。这时候可以用 `@Lookup` 注解或者 ApplicationContext 来动态获取。

除了 singleton 和 prototype，Spring 还支持其他作用域：
- `request`：在 Web 应用中，每个 HTTP 请求都会创建一个新的 Bean 实例
- `session`：在 Web 应用中，每个 HTTP 会话都会创建一个新的 Bean 实例
- `application`：在整个应用中只有一个 Bean 实例，生命周期与 ServletContext 绑定

### Spring如何实现单例模式？

Spring 的单例是容器级别的，同一个 Bean 在整个 Spring 容器中只会有一个实例。

具体的实现机制是：Spring 在 DefaultSingletonBeanRegistry 这个类里面维护了一个叫 `singletonObjects` 的 ConcurrentHashMap，这个 Map 就是用来存储单例 Bean 的。key 是 Bean 的名称，value 就是 Bean 的实例对象。

当我们第一次获取某个 Bean 的时候，Spring 会先检查 `singletonObjects` 这个 Map 里面有没有这个 Bean，如果没有就会创建一个新的实例，然后放到 Map 里面。后面再获取同一个 Bean 的时候，直接从 Map 里面取就行了。

Spring 为了解决循环依赖的问题，还用了三级缓存：
- `singletonObjects`：一级缓存，存放完成初始化的单例 Bean
- `earlySingletonObjects`：二级缓存，存放早期暴露的单例 Bean（解决循环依赖）
- `singletonFactories`：三级缓存，存放单例 Bean 工厂

## 依赖注入

### 为什么IDEA不推荐使用@Autowired注解注入Bean？

主要有几个原因。

第一个是字段注入不利于单元测试。字段注入需要使用反射或 Spring 容器才能注入依赖，测试更复杂；而构造方法注入可以直接通过构造方法传入 Mock 对象，测试起来更简单。

第二个是字段注入会隐藏循环依赖问题，而构造方法注入会在项目启动时就去检查依赖关系，能更早发现问题。

第三个是构造方法注入可以使用 final 字段确保依赖在对象创建时就被初始化，避免了后续修改的风险。

### @Autowired 和 @Resource 注解的区别？

首先从来源上说，`@Autowired` 是 Spring 框架提供的注解，而 `@Resource` 是 Java EE 标准提供的注解。

从注入方式上说，`@Autowired` 默认按照类型（byType）进行注入，而 `@Resource` 默认按照名称（byName）进行注入。

当容器中存在多个相同类型的 Bean 时，直接用 `@Autowired` 注入就会报错，因为 Spring 容器不知道该注入哪个实现类。这时候有两种解决方案：使用 `@Autowired + @Qualifier` 指定具体的 Bean 名称，或者使用 `@Resource` 注解按名称进行注入。

### @Autowired的实现原理了解吗？

`@Autowired` 是 Spring 实现依赖注入的核心注解，其实现原理基于反射机制和 BeanPostProcessor 接口。

整个过程分为两个主要阶段。第一个阶段是依赖收集阶段，发生在 Bean 实例化之后、属性赋值之前。AutowiredAnnotationBeanPostProcessor 会扫描 Bean 的所有字段、方法和构造方法，找出标注了 `@Autowired` 注解的地方，然后把这些信息封装成 Injection 元数据对象缓存起来。

第二个阶段是依赖注入阶段，Spring 会取出之前缓存的 Injection 元数据对象，然后逐个处理每个注入点。对于每个 `@Autowired` 标注的字段或方法，Spring 会根据类型去容器中查找匹配的 Bean，如果找到多个候选者，再按名称筛选，同时考虑 `@Primary` 和 `@Priority` 注解。

在具体的注入过程中，Spring 会使用反射来设置字段的值或者调用 setter 方法。

## 相关链接

- [[AOP 与动态代理]] — AOP 是 Spring 的核心特性，事务、权限等均基于此实现
- [[Spring 事务]] — 声明式事务依赖 IoC 容器管理的 Bean 代理
- [[Spring MVC 架构]] — DispatcherServlet 本身也是一个 Spring Bean
- [[Spring Boot 与微服务]] — Spring Boot 自动装配建立在 IoC 容器之上
- [[JVM 内存管理]] — Bean 实例存储在堆内存，理解内存有助于排查 OOM
- [[线程基础与ThreadLocal]] — 单例 Bean 在多线程环境下的安全问题
