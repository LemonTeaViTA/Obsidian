### 🌟说说你对Spring事务的理解？ 
 Spring 提供了两种事务管理方式，编程式事务和声明式事务。编程式事务就是我们要手动调用事务的开始、提交、回滚这些操作，虽然灵活但是代码比较繁琐。声明式事务只需要在需要事务的方法上加上 @Transactional 注解就好了，Spring 会帮我们自动处理事务的整个生命周期。 
 
 ----这部分可以不背，方便大家理解 start---- 
 编程式事务可以使用 TransactionTemplate 和 PlatformTransactionManager 来实现，允许我们在代码中直接控制事务的边界。 
 public class AccountService { 
 private TransactionTemplate transactionTemplate ; 
 
 public void setTransactionTemplate ( TransactionTemplate transactionTemplate ) { 
 this . transactionTemplate = transactionTemplate ; 
 } 
 
 public void transfer ( final String out , final String in , final Double money ) { 
 transactionTemplate . execute ( new TransactionCallbackWithoutResult () { 
 @Override 
 protected void doInTransactionWithoutResult ( TransactionStatus status ) { 
 // 转出 
 accountDao . outMoney ( out , money ); 
 // 转入 
 accountDao . inMoney ( in , money ); 
 } 
 }); 
 } 
 } 
 ----这部分可以不背，方便大家理解 end---- 
 Spring 事务的底层实现是通过 AOP 来完成的。当我们在方法上加 @Transactional 注解后，Spring 会为这个 Bean 创建代理对象，在方法执行前开启事务，方法正常返回时提交事务，如果方法抛出异常就回滚事务。 
 声明式事务的优点是不需要在业务逻辑代码中掺杂事务管理的代码，缺点是，最细粒度只能到方法级别，无法到代码块级别。 
 @Service 
 public class AccountService { 
 @Autowired 
 private AccountDao accountDao ; 
 
 @Transactional 
 public void transfer ( String out , String in , Double money ) { 
 // 转出 
 accountDao . outMoney ( out , money ); 
 // 转入 
 accountDao . inMoney ( in , money ); 
 } 
 } ### 声明式事务的实现原理了解吗？ 
 Spring 的声明式事务管理是通过 AOP 和代理机制实现的，大致可以分为两个阶段。 
 第一个阶段发生在 Spring 容器启动时，它会扫描所有的 Bean。如果发现某个 Bean 的方法上标注了 @Transactional 注解，Spring 不会直接返回这个原始的 Bean 实例。而是为这个 Bean 创建一个代理对象。这个代理对象拥有和原始对象完全相同的方法，但在内部悄悄地包裹了事务处理的逻辑。 
 
 第二个阶段发生在方法调用的运行阶段，当我们的代码调用那个被 @Transactional 注解修饰的方法时，实际上调用的是 Spring 创建的那个代理对象的方法。 
 
 事务拦截器会在代理对象执行真正的业务逻辑之前，根据 @Transactional 注解的配置获取事务属性，比如传播行为、隔离级别等，然后通过事务管理器来开启一个新的事务。并从数据库连接池获取一个连接，关闭其自动提交。 
 public class TransactionInterceptor implements MethodInterceptor { 
 @Override 
 public Object invoke ( MethodInvocation invocation ) throws Throwable { 
 // 获取事务属性 
 TransactionAttribute txAttr = getTransactionAttribute ( invocation . getMethod (), invocation . getThis (). getClass ()); 
 // 开始事务 
 TransactionStatus status = transactionManager . getTransaction ( txAttr ); 
 try { 
 // 执行目标方法 
 Object retVal = invocation . proceed (); 
 // 提交事务 
 transactionManager . commit ( status ); 
 return retVal ; 
 } catch ( Throwable ex ) { 
 // 回滚事务 
 transactionManager . rollback ( status ); 
 throw ex ; 
 } 
 } 
 } 
 接着，代理对象会调用原始 Bean 实例中真正的业务方法，如果业务方法顺利执行完毕，没有抛出任何异常，那么拦截器就会通过事务管理器提交事务，将之前的所有数据库操作永久保存。 
 如果业务方法抛出了异常，拦截器会捕获到这个异常，并通过事务管理器回滚事务，将之前的所有数据库操作撤销。 
 最后，无论事务是提交还是回滚，拦截器都会释放数据库连接。 ### @Transactional在哪些情况下会失效？ 
 @Transactional 虽然用起来很方便，但确实有一些“坑”，如果使用不当是会导致事务失效的。根据我的理解和实践，主要有以下几种常见情况： 
 第一种， @Transactional 注解用在非 public 修饰的方法上。 
 Spring 的 AOP 代理机制决定了它无法代理 private 方法。因为 private 方法在子类中是不可见的，代理类无法覆盖它。因此，在 private 方法上加 @Transactional 注解是完全无效的。同理，protected 和 default 权限的方法也应避免使用。 
 protected TransactionAttribute computeTransactionAttribute ( Method method , 
 Class <?> targetClass ) { 
 // Don't allow no-public methods as required. 
 if ( allowPublicMethodsOnly () && ! Modifier . isPublic ( method . getModifiers ())) { 
 return null ; 
 } 
 } 
 第二种，方法内部调用，这也是最容易被忽略的一种失效场景。如果在一个类的方法 A 中，直接调用本类的另外一个加了 @Transactional 的方法 B，那么方法 B 的事务是不会生效的。 
 这是因为方法 A 调用方法 B 时，使用的是 this 引用，直接访问原始对象的方法，绕过了 Spring 的代理对象，也就导致代理对象中的事务逻辑没有机会执行。 
 public class UserService { 
 @Transactional 
 public void createUser ( User user ) { 
 // 直接调用本类的另一个方法，事务不会生效 
 saveUser ( user ); 
 } 
 
 private void saveUser ( User user ) { 
 // 保存用户逻辑 
 } 
 } 
 解决方法是把当前类作为一个 Bean 注入到自己中，然后通过这个注入的 Bean 来调用方法 B。 
 
 第三种，如果在事务方法内部用 try-catch 捕获了异常，但没有在 catch 块中将异常重新抛出，或者抛出一个新的能触发回滚的异常，那么 Spring 的事务拦截器就无法感知到异常的发生，也就没办法回滚。 
 @Transactional 
 public void process () { 
 try { 
 // 业务逻辑 
 } catch ( Exception e ) { 
 // 捕获异常但没有重新抛出 
 // 事务不会回滚 
 } 
 } 
 第四种，Spring 事务默认只对 RuntimeException 和 Error 类型的异常进行回滚。如果在代码中抛出的是一个Checked Exception，是 Exception 的子类但不是 RuntimeException 的子类，又没有通过 @Transactional(rollbackFor = Exception.class) 指定事务回归的异常类型，那么事务同样不会回滚。 
 @Transactional 
 public void process () throws Exception { 
 // 抛出一个 Checked Exception 
 throw new SQLException ( "This is a checked exception" ); 
 } ### 说说Spring事务的隔离级别？ 
 事务的隔离级别定义了一个事务可以受其他并发事务影响的程度。SQL 标准定义的四个隔离级别，Spring 都支持，定义在 TransactionDefinition 接口中。 
 
 Spring 在标准的隔离级别上定义了五个隔离级别： 
 其中 DEFAULT 表示使用底层数据库的默认隔离级别。比如说对于 MySQL 来说，默认的隔离级别是可重复读，那就用可重复读；对于 Oracle 来说，默认是读已提交，那就用读已提交。在实际项目中，我们也通常都用 DEFAULT，让数据库自己决定合适的隔离级别。 
 读未提交是最低的隔离级别，允许读取未提交的数据。这种级别会出现脏读问题，也就是一个事务可能会读到另一个事务还没提交的数据。比如 A 事务修改了一条数据但还没提交，B 事务就能读到这个修改后的值，如果 A 事务后来回滚了，B 事务读到的就是脏数据。这个级别在实际项目中基本不会使用，因为数据一致性无法保证。 
 读已提交解决了脏读问题，但会出现不可重复读问题，也就是在同一个事务中多次读取同一条数据，可能得到不同的结果。比如 A 事务先读了一条数据，然后 B 事务修改并提交了这条数据，A 事务再次读取时就会发现数据变了。 
 可重复读保证在同一个事务中多次读取同一条数据的结果是一致的，解决了不可重复读问题。但是会出现幻读问题，也就是在同一个事务中多次执行同一个查询，可能会看到不同数量的记录。比如 A 事务查询某个条件的记录数是 10 条，然后 B 事务插入了一条符合条件的记录并提交，A 事务再次查询时可能会看到 11 条记录。MySQL 的 InnoDB 存储引擎通过临键锁在很大程度上解决了幻读问题。 
 串行化是最高的隔离级别，完全串行化执行事务，可以解决所有并发问题，包括脏读、不可重复读和幻读。但是性能是最差的，因为事务基本上是排队执行的。在实际项目中很少使用，除非对数据一致性有极高的要求。 
 在 Spring 中设置隔离级别也很简单，可以在 @Transactional 注解中通过 isolation 属性来指定。 
 @Transactional ( isolation = Isolation . READ_UNCOMMITTED ) 
 public void someMethod () { 
 // 业务逻辑 
 } 
 不过在实际项目中，我们很少手动设置隔离级别，通常都是使用数据库的默认级别，只有在遇到特定的并发问题时才会考虑调整。 ### 🌟说说Spring的事务传播机制？ 
 简单来说，当一个事务方法 A 调用另一个事务方法 B 时，方法 B 的事务应该如何运行？是加入方法 A 的现有事务，还是开启一个新事务，或者以非事务方式运行？这就是事务传播机制要解决的问题。 
 Spring 定义了七种事务传播行为，其中 REQUIRED 是默认的传播行为，表示如果当前存在事务，则加入该事务；如果当前没有事务，则创建一个新的事务。 
 
 比如说在 技术派实战项目 中，一个用户解锁付费文章的操作，会涉及到创建支付订单、更新订单状态等好几个数据库操作。 
 
 这些不同操作的方法就可以放在一个 @Transactional 注解的方法里，它们就自动在同一个事务里了，要么一起成功，要么一起失败。 
 当然，还有一些特殊情况。比如，我们希望记录一些操作日志，但不想因为主业务失败导致日志回滚。这时候 REQUIRES_NEW 就派上用场了。它不管当前有没有事务，都重新开启一个全新的、独立的事务来执行。这样，日志保存的事务和主业务的事务就互不干扰，即使主业务失败回滚，日志也能妥妥地保存下来。 
 另外，还有像 SUPPORTS、 NOT_SUPPORTED 这些。SUPPORTS 比较佛系，有事务就用，没事务就不用，适合一些不重要的更新操作。而 NOT_SUPPORTED 则更干脆，它会把当前的事务挂起，以非事务的方式去执行。比如说我们的事务里需要调用一个第三方的、响应很慢的接口，如果这个调用也包含在事务里，就会长时间占用数据库连接。把它用 NOT_SUPPORTED 包起来，就可以避免这个问题。 
 @Transactional ( propagation = Propagation . NOT_SUPPORTED ) 
 public void callExternalApi () { 
 // 调用第三方接口 
 } 
 最后还有一个比较特殊的 NESTED，嵌套事务。它有点像 REQUIRES_NEW，但又不完全一样。NESTED 是父事务的一个子事务，父事务回滚，它肯定也得回滚。但它自己回滚，却不会影响到父事务。这个特性在处理一些批量操作，希望能部分回滚的场景下特别有用。不过它需要数据库支持 Savepoint 功能，MySQL 就支持。 
 
 事务能在新线程中传播吗？ 
 事务传播机制是通过 ThreadLocal 实现的，所以，如果调用的方法是在新线程中，事务传播就会失效。 
 @Transactional 
 public void parentMethod () { 
 new Thread (() -> childMethod ()). start (); 
 } 
 
 public void childMethod () { 
 // 这里的操作将不会在 parentMethod 的事务范围内执行 
 } 
 
 
 protected 和 private 方法加事务会生效吗？ 
 我的理解是：在 private 方法上加事务是肯定不会生效的，而 protected 方法在特定的代理模式下是可能生效的，但这两种用法都应该避免，不是推荐的使用方式。 
 这背后涉及到 Spring AOP 的代理机制。 
 我先说一下 JDK 动态代理，它要求目标类必须实现一个或者多个接口。也就意味着代理只能拦截接口中声明的方法，而 protected 和 private 方法并不能在接口中声明，因此在 JDK 动态代理下，这些方法的事务注解是会被直接忽略的。 
 那 Spring Boot 2.0 之后，Spring AOP 默认使用的是 CGLIB 代理。CGLIB 代理是通过继承目标类来创建代理对象的。 
 那对于 private 方法来说，由于无法被子类重写，所以 CGLIB 代理也无法拦截，事务也就无法生效。对于 protected 方法来说，因为它可以被子类重写，所以理论上事务是生效的。 
 ----这部分可以不背，方便大家理解 start---- 
 我们创建一个 protected 方法，名为 protectedTransactionalMethod ，它被 @Transactional 注解标记。这个方法会先向数据库中插入一条记录（一个 TestEntity 实例）。紧接着，它会立即抛出一个 RuntimeException 。 
 
 
 如果事务生效：当 RuntimeException 抛出时，Spring 的事务管理器会捕获它，并触发事务回滚。这意味着，之前插入数据库的那条记录会被撤销。最终，数据库里不会留下这条记录。 
 如果事务失效：即使 RuntimeException 被抛出，由于没有事务管理，已经执行的数据库插入操作不会被撤销。最终，数据库里会留下这条记录。 
 
 我们创建了一个 public 方法 testProtectedTransaction ，它通过 this.protectedTransactionalMethod() 的方式直接调用了那个 protected 方法。接着我们访问 /api/v1/test/transaction/protected 来触发这个调用。 
 结果：数据库中会留下一条名为 'test-protected' 的记录。这证明了由于是内部调用，绕过了 Spring AOP 代理， @Transactional 注解没有生效。 
 我们创建了另一个 public 方法 testProtectedTransactionWithSelfProxy 。在这个方法里，我们通过一个“自注入”的代理对象 self 来调用 self.protectedTransactionalMethod() 。接着我们通过访问 /api/v1/test/transaction/protected/proxy 来触发这个调用。 
 结果：数据库中不会留下名为 'test-protected-proxy' 的记录。这证明通过代理对象的调用，Spring AOP 成功拦截并开启了事务，最终在异常发生时正确地回滚了事务。 
 
 ----这部分可以不背，方便大家理解 end---- 
 
 
 
 
 
 
 
 
 
 
 MVC
