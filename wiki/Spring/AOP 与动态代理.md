---
module: Spring
tags: [Spring, AOP, 动态代理, CGLIB, JDK代理]
difficulty: hard
last_reviewed: 2026-04-20
---

# AOP 与动态代理

## AOP 基础

### 🌟说说什么是 AOP？

AOP，也就是面向切面编程，简单点说，AOP 就是把一些业务逻辑中的相同代码抽取到一个独立的模块中，让业务逻辑更加清爽。

从技术实现上来说，AOP 主要是通过动态代理来实现的。如果目标类实现了接口，就用 JDK 动态代理；如果没有实现接口，就用 CGLIB 来创建子类代理。代理对象会在方法执行前后插入我们定义的切面逻辑。

### Spring AOP 有哪些核心概念？

- **切面（Aspect）**：我们定义的一个类，包含了要在什么时候、什么地方执行什么逻辑。在 Spring 中，我们会用 `@Aspect` 注解来标识一个切面类。
- **切点（Pointcut）**：定义了在哪些地方应用切面逻辑。在 Spring 中用 `@Pointcut` 注解来定义，通常会写一些表达式，比如 `execution(* com.example.service.*.*(..))` 这样的。
- **通知（Advice）**：是切面中具体要执行的代码逻辑。有 `@Before`、`@After`、`@Around`、`@AfterReturning`、`@AfterThrowing` 几种类型。
- **连接点（Join Point）**：被拦截到的点，在 Spring 中，连接点指的是被拦截到的方法。
- **织入（Weaving）**：是把切面逻辑应用到目标对象的过程。Spring AOP 是在运行时通过动态代理来实现织入的。
- **目标对象（Target）**：被切面处理的对象，也就是我们平时写的 Service、Controller 等类。

```
切面（Aspect）
├── 切入点（Pointcut）─── 定义在哪里执行
└── 通知（Advice） ─── 定义何时执行什么
    ├── @Before
    ├── @After
    ├── @AfterReturning
    ├── @AfterThrowing
    └── @Around

目标对象（Target）──→ 代理对象（Proxy）──→ 织入（Weaving）
```

### Spring AOP 织入有哪几种方式？

**编译期织入**：在编译 Java 源码的时候就把切面逻辑织入到目标类中。这种方式最典型的实现就是 AspectJ 编译器，它会在编译的时候直接修改字节码。优点是性能最好，但需要使用特殊的编译器，在 Spring 项目中用得不多。

**类加载期织入**：在 JVM 加载 class 文件的时候进行织入。通过 Java 的 Instrumentation API 或者自定义的 ClassLoader 来实现，在类被加载到 JVM 之前修改字节码。AspectJ 的 Load-Time Weaving 就是这种方式的典型实现。

**运行时织入**：我们在 Spring 中最常见的方式，也就是通过动态代理来实现。Spring AOP 采用的就是这种方式。当 Spring 容器启动的时候，如果发现某个 Bean 需要被切面处理，就会为这个 Bean 创建一个代理对象。

### Spring AOP 有哪些通知方式？

**前置通知（@Before）**：在目标方法执行之前执行，主要用来做参数校验、权限检查、记录方法开始执行的日志等。无法阻止目标方法的执行，也无法修改方法的参数。

**后置通知（@After）**：在目标方法执行完成后执行，不管方法是正常返回还是抛出异常都会执行。主要用来做一些清理工作，拿不到方法的返回值，也捕获不到异常信息。

**返回通知（@AfterReturning）**：在目标方法正常返回后执行，可以获取到方法的返回值。如果方法抛出异常，返回通知不会执行。

**异常通知（@AfterThrowing）**：在目标方法抛出异常后执行，可以接收异常对象。主要用来做异常处理和记录，但不能处理异常，异常还是会继续向上抛出。

**环绕通知（@Around）**：最强大也是用得最多的一种通知。它可以在方法执行前后都执行逻辑，而且可以控制目标方法是否执行，还可以修改方法的参数和返回值。环绕通知的方法必须接收一个 ProceedingJoinPoint 参数，通过调用其 `proceed()` 方法来执行目标方法。

如果有多个切面，还可以通过 `@Order` 注解指定先后顺序，数字越小，优先级越高。

### Spring AOP 发生在什么时候？

Spring AOP 是在 Bean 的初始化阶段发生的，具体来说是在 Bean 生命周期的后置处理阶段。在 Bean 实例化完成、属性注入完成之后，Spring 会调用所有 BeanPostProcessor 的 `postProcessAfterInitialization` 方法，AOP 代理的创建就是在这个阶段完成的。

### 🌟AOP的应用场景有哪些？

**事务管理**是用得最多的场景，基本上每个项目都会用到。只需要在 Service 方法上加个 `@Transactional` 注解，Spring 就会自动帮我们管理事务的开启、提交和回滚。

**日志记录**也是一个很常见的应用。可以利用 AOP 来打印接口的入参和出参日志、执行时间，方便后期 bug 溯源和性能调优。

除此之外，还有**权限控制**、**性能监控**、**缓存处理**等场景。总的来说，任何需要在多个地方重复执行的通用逻辑，都可以考虑用 AOP 来实现。

### 说说 Spring AOP 和 AspectJ 区别？

Spring AOP 只支持方法级别的织入，而且只能拦截 Spring 容器管理的 Bean。但是 AspectJ 几乎可以织入任何地方，包括方法、字段、构造方法、异常处理等等。

从实现机制上来说，Spring AOP 是基于动态代理实现的，在运行时为目标对象创建代理，通过代理来执行切面逻辑。而 AspectJ 是通过字节码织入来实现的，它直接修改目标类的字节码，把切面逻辑编织到目标方法中。

在实际项目中，我们大部分时候用的都是 Spring AOP，因为它能满足绝大多数需求，而且使用简单。Spring AOP 借鉴了很多 AspectJ 的概念和注解，我们在 Spring 中使用的 `@Aspect`、`@Pointcut` 这些注解，其实都是 AspectJ 定义的。

### AOP和 OOP 的关系？

OOP 通过类和对象封装数据和行为，专注于核心业务逻辑。AOP 提供了解决横切关注点（如日志、权限、事务等）的机制，将这些逻辑集中管理。两者是互补的编程思想。

## 动态代理

### 🌟说说JDK动态代理和CGLIB代理的区别？

从使用条件来说，JDK 动态代理要求目标类必须实现至少一个接口，因为它是基于接口来创建代理的。而 CGLIB 代理不需要目标类实现接口，它是通过继承目标类来创建代理的。

从实现原理来说，JDK 动态代理是 Java 原生支持的，它通过反射机制在运行时动态创建一个实现了指定接口的代理类。当我们调用代理对象的方法时，会被转发到 InvocationHandler 的 `invoke` 方法中，我们可以在这个方法里插入切面逻辑，然后再通过反射调用目标对象的真实方法。

CGLIB 则是一个第三方的字节码生成库，它通过 ASM 字节码框架动态生成目标类的子类，然后重写父类的方法来插入切面逻辑。

在 Spring Boot 2.0 之后，Spring AOP 默认使用 CGLIB 代理。这是因为 Spring Boot 追求"约定优于配置"，选择 CGLIB 可以简化开发者的心智负担，避免因为忘记实现接口而导致 AOP 不生效的问题。

#### 选择 CGLIB 还是 JDK 动态代理？

如果目标对象没有实现任何接口，就只能使用 CGLIB 代理，比如说 Controller 层的类。

如果目标对象实现了接口，通常首选 JDK 动态代理，比如说 Service 层的类，一般都会先定义接口，再实现接口。

### 你会用 JDK 动态代理吗？

JDK 动态代理的核心是通过反射机制在运行时创建一个实现了指定接口的代理类。

```java
// 第一步：创建接口
public interface ISolver {
    void solve();
}

// 第二步：实现接口
public class Solver implements ISolver {
    @Override
    public void solve() {
        System.out.println("疯狂掉头发解决问题……");
    }
}

// 第三步：使用反射生成代理对象
public class ProxyFactory {
    private Object target;

    public ProxyFactory(Object target) {
        this.target = target;
    }

    public Object getProxyInstance() {
        return Proxy.newProxyInstance(
            target.getClass().getClassLoader(),
            target.getClass().getInterfaces(),
            new InvocationHandler() {
                @Override
                public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
                    System.out.println("请问有什么可以帮到您？");
                    Object returnValue = method.invoke(target, args);
                    System.out.println("问题已经解决啦！");
                    return null;
                }
            });
    }
}

// 第四步：使用代理对象
public class Client {
    public static void main(String[] args) {
        ISolver developer = new Solver();
        ISolver csProxy = (ISolver) new ProxyFactory(developer).getProxyInstance();
        csProxy.solve();
    }
}
```

### 你会用 CGLIB 动态代理吗？

CGLIB 代理不需要目标类实现任何接口，通过继承目标类来创建代理。

```java
// 第一步：定义目标类（不需要实现接口）
public class Solver {
    public void solve() {
        System.out.println("疯狂掉头发解决问题……");
    }
}

// 第二步：创建代理工厂
public class ProxyFactory implements MethodInterceptor {
    private Object target;

    public ProxyFactory(Object target) {
        this.target = target;
    }

    public Object getProxyInstance() {
        Enhancer en = new Enhancer();
        en.setSuperclass(target.getClass());
        en.setCallback(this);
        return en.create();
    }

    @Override
    public Object intercept(Object obj, Method method, Object[] args, MethodProxy proxy) throws Throwable {
        System.out.println("请问有什么可以帮到您？");
        Object returnValue = method.invoke(target, args);
        System.out.println("问题已经解决啦！");
        return null;
    }
}

// 第三步：使用代理对象
public class Client {
    public static void main(String[] args) {
        Solver developer = new Solver();
        Solver csProxy = (Solver) new ProxyFactory(developer).getProxyInstance();
        csProxy.solve();
    }
}
```

### AspectJ 是什么？

AspectJ 是一个 AOP 框架，它可以做很多 Spring AOP 干不了的事情，比如说编译时、编译后和类加载时织入切面。并且提供了很多复杂的切点表达式和通知类型。

Spring AOP 只支持方法级别的拦截，而且只能拦截 Spring 容器管理的 Bean。但是 AspectJ 可以拦截任何 Java 对象的方法调用、字段访问、构造方法执行、异常处理等等。

## 相关链接

- [[Spring 基础与 IoC]] — AOP 代理在 Bean 初始化阶段由 BeanPostProcessor 创建
- [[Spring 事务]] — @Transactional 是 AOP 最典型的应用场景
- [[JVM 类加载机制]] — CGLIB 通过字节码生成子类，与类加载密切相关
- [[线程基础与ThreadLocal]] — AOP 切面本身是单例，注意多线程下的状态安全
