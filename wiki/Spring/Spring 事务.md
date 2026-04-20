---
module: Spring
tags: [Spring, 事务, 声明式事务, Transactional]
difficulty: hard
last_reviewed: 2026-04-20
---

# Spring 事务

## 事务基础

### 🌟说说你对Spring事务的理解？

Spring 提供了两种事务管理方式，编程式事务和声明式事务。编程式事务就是我们要手动调用事务的开始、提交、回滚这些操作，虽然灵活但是代码比较繁琐。声明式事务只需要在需要事务的方法上加上 `@Transactional` 注解就好了，Spring 会帮我们自动处理事务的整个生命周期。

Spring 事务的底层实现是通过 [[AOP 与动态代理|AOP]] 来完成的。当我们在方法上加 `@Transactional` 注解后，Spring 会为这个 Bean 创建代理对象，在方法执行前开启事务，方法正常返回时提交事务，��果方法抛出异常就回滚事务。

声明式事务的优点是不需要在业务逻辑代码中掺杂事务管理的代码，缺点是最细粒度只能到方法级别，无法到代码块级别。

```java
@Service
public class AccountService {
    @Autowired
    private AccountDao accountDao;

    @Transactional
    public void transfer(String out, String in, Double money) {
        accountDao.outMoney(out, money);
        accountDao.inMoney(in, money);
    }
}
```

### 声明式事务的实现原理了解吗？

Spring 的声明式事务管理是通过 AOP 和代理机制实现的，大致可以分为两个阶段。

第一个阶段发生在 Spring 容器启动时，它会扫描所有的 Bean。如果发现某个 Bean 的方法上标注了 `@Transactional` 注解，Spring 不会直接返回这个原始的 Bean 实例，而是为这个 Bean 创建一个代理对象。这个代理对象拥有和原始对象完全相同的方法，但在内部悄悄地包裹了事务处理的逻辑。

第二个阶段发生在方法调用的运行阶段，当我们的代码调用那个被 `@Transactional` 注解修饰的方法时，实际上调用的是 Spring 创建的那个代理对象的方法。

事务拦截器会在代理对象执行真正的业务逻辑之前，根据 `@Transactional` 注解的配置获取事务属性，然后通过事务管理器来开启一个新的事务，并从数据库连接池获取一个连接，关闭其自动提交。

如果业务方法顺利执行完毕，没有抛出任何异常，那么拦截器就会通过事务管理器提交事务。如果业务方法抛出了异常，拦截器会捕获到这个异常，并通过事务管理器回滚事务。最后，无论事务是提交还是回滚，拦截器都会释放数据库连接。

### @Transactional在哪些情况下会失效？

**第一种：注解用在非 public 修饰的方法上。** Spring 的 AOP 代理机制决定了它无法代理 private 方法。因为 private 方法在子类中是不可见的，代理类无法覆盖它。因此，在 private 方法上加 `@Transactional` 注解是完全无效的。同理，protected 和 default 权限的方法也应避免使用。

**第二种：方法内部调用。** 如果在一个类的方法 A 中，直接调用本类的另外一个加了 `@Transactional` 的方法 B，那么方法 B 的事务是不会生效的。这是因为方法 A 调用方法 B 时，使用的是 `this` 引用，直接访问原始对象的方法，绕过了 Spring 的代理对象。解决方法是把当前类作为一个 Bean 注入到自己中，然后通过这个注入的 Bean 来调用方法 B。

**第三种：异常被捕获未重新抛出。** 如果在事务方法内部用 try-catch 捕获了异常，但没有在 catch 块中将异常重新抛出，那么 Spring 的事务拦截器就无法感知到异常的发生，也就没办法回滚。

**第四种：异常类型不匹配。** Spring 事务默认只对 RuntimeException 和 Error 类型的异常进行回滚。如果在代码中抛出的是一个 Checked Exception，又没有通过 `@Transactional(rollbackFor = Exception.class)` 指定事务回滚的异常类型，那么事务同样不会回滚。

## 隔离级别与传播机制

### 说说Spring事务的隔离级别？

事务的隔离级别定义了一个事务可以受其他并发事务影响的程度。Spring 在标准的隔离级别上定义了五个隔离级别：

- **DEFAULT**：使用底层数据库的默认隔离级别。比如说对于 MySQL 来说，默认的隔离级别是可重复读。在实际项目中，我们通常都用 DEFAULT，让数据库自己决定合适的隔离级别。
- **READ_UNCOMMITTED（读未提交）**：最低的隔离级别，允许读取未提交的数据，会出现脏读问题。在实际项目中基本不会使用。
- **READ_COMMITTED（读已提交）**：解决了脏读问题，但会出现不可重复读问题，也就是在同一个事务中多次读取同一条数据，可能得到不同的结果。
- **REPEATABLE_READ（可重复读）**：保证在同一个事务中多次读取同一条数据的结果是一致的，解决了不可重复读问题。但是会出现幻读问题。MySQL 的 InnoDB 存储引擎通过临键锁在很大程度上解决了幻读问题。
- **SERIALIZABLE（串行化）**：最高的隔离级别，完全串行化执行事务，可以解决所有并发问题，但是性能是最差的。

在 Spring 中设置隔离级别可以在 `@Transactional` 注解中通过 `isolation` 属性来指定：

```java
@Transactional(isolation = Isolation.READ_UNCOMMITTED)
public void someMethod() {
    // 业务逻辑
}
```

### 🌟说说Spring的事务传播机制？

简单来说，当一个事务方法 A 调用另一个事务方法 B 时，方法 B 的事务应该如何运行？是加入方法 A 的现有事务，还是开启一个新事务，或者以非事务方式运行？这就是事务传播机制要解决的问题。

Spring 定义了七种事务传播行为：

- **REQUIRED（默认）**：如果当前存在事务，则加入该事务；如果当前没有事务，则创建一个新的事务。
- **REQUIRES_NEW**：不管当前有没有事务，都重新开启一个全新的、独立的事务来执行。这样，新事务和原事务就互不干扰，即使原事务失败回滚，新事务也能正常提交。适合记录操作日志等不想被主业务影响的场景。
- **SUPPORTS**：有事务就用，没事务就不用，适合一些不重要的查询操作。
- **NOT_SUPPORTED**：把当前的事务挂起，以非事务的方式去执行。比如说事务里需要调用一个响应很慢的第三方接口，用 NOT_SUPPORTED 包起来可以避免长时间占用数据库连接。
- **MANDATORY**：必须在一个已有的事务中执行，否则抛出异常。
- **NEVER**：必须在没有事务的情况下执行，否则抛出异常。
- **NESTED**：嵌套事务。父事务回滚，它肯定也得回滚。但它自己回滚，却不会影响到父事务。这个特性在处理一些批量操作、希望能部分回滚的场景下特别有用。需要数据库支持 Savepoint 功能，MySQL 就支持。

#### 事务能在新线程中传播吗？

事务传播机制是通过 ThreadLocal 实现的，所以，如果调用的方法是在新线程中，事务传播就会失效。

```java
@Transactional
public void parentMethod() {
    new Thread(() -> childMethod()).start(); // childMethod 不在 parentMethod 的事务范围内
}
```

#### protected 和 private 方法加事务会生效吗？

在 private 方法上加事务是肯定不会生效的，而 protected 方法在特定的代理模式下是可能生效的，但这两种用法都应该避免。

JDK 动态代理要求目标类必须实现接口，代理只能拦截接口中声明的方法，而 protected 和 private 方法并不能在接口中声明，因此在 JDK 动态代理下，这些方法的事务注解会被直接忽略。

Spring Boot 2.0 之后，Spring AOP 默认使用 CGLIB 代理。对于 private 方法来说，由于无法被子类重写，所以 CGLIB 代理也无法拦截，事务无法生效。对于 protected 方法来说，因为它可以被子类重写，所以理论上通过代理对象调用时事务是生效的，但通过 `this` 内部调用时仍然不生效。

## 相关链接

- [[AOP 与动态代理]] — 声明式事务底层通过 AOP 代理实现
- [[Spring 基础与 IoC]] — 事务管理器本身是 Spring 容器管理的 Bean
- [[MySQL 锁与事务机制]] — Spring 事务隔离级别直接映射到数据库事务
- [[线程基础与ThreadLocal]] — 事务传播通过 ThreadLocal 绑定连接实现
