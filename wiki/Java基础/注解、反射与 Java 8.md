---
module: Java基础
tags: [Java, 反射, 注解, Lambda, Stream, Optional]
difficulty: hard
last_reviewed: 2026-05-07
---

# 注解、反射与 Java 8
## 注解与反射

### 说一下你对注解的理解？

**答案：**

注解本质是==元数据标记==，用于在编译期或运行期驱动行为。本质上是一个继承了 `Annotation` 的接口，运行时由 JVM 用动态代理实现。

**四个元注解（修饰注解的注解）：**

| 元注解 | 作用 |
|--------|------|
| `@Target` | 指定注解可以用在哪里（类、方法、字段等） |
| `@Retention` | 指定注解的生命周期（SOURCE/CLASS/RUNTIME） |
| `@Documented` | 是否包含在 JavaDoc 中 |
| `@Inherited` | 子类是否继承父类的注解 |

**生命周期：**
- `SOURCE`：编译后丢弃（如 `@Override`、`@SuppressWarnings`）
- `CLASS`：保留到字节码，运行期不可见（默认值，较少用）
- `RUNTIME`：运行时可通过反射读取（Spring 注解大多是这个）

**自定义注解示例：**

```java
@Target(ElementType.METHOD)       // 只能用在方法上
@Retention(RetentionPolicy.RUNTIME) // 运行时可读
public @interface Log {
    String value() default “”;     // 注解属性，有默认值
    boolean async() default false;
}

// 使用
public class UserService {
    @Log(value = “查询用户”, async = true)
    public User getUser(Long id) { ... }
}

// 通过反射读取注解
Method method = UserService.class.getMethod(“getUser”, Long.class);
Log log = method.getAnnotation(Log.class);
System.out.println(log.value());  // “查询用户”
```

典型场景：[[AOP 与动态代理|AOP]]、依赖注入（Spring `@Autowired`）、代码生成（Lombok）、参数校验（`@NotNull`）。

---

### 什么是反射？应用？原理？

**答案：**

==反射允许在运行时检查并操作类信息==（字段、方法、构造器），即使在编译期不知道具体类型。

**核心 API：**

```java
// 获取 Class 对象（三种方式）
Class<?> c1 = String.class;                    // 类字面量
Class<?> c2 = "hello".getClass();              // 对象.getClass()
Class<?> c3 = Class.forName("java.lang.String"); // 全限定名（最常用于框架）

// 创建对象
Constructor<User> ctor = User.class.getDeclaredConstructor(String.class, int.class);
User user = ctor.newInstance("张三", 25);

// 访问字段（包括 private）
Field field = User.class.getDeclaredField("name");
field.setAccessible(true);   // 突破访问限制
String name = (String) field.get(user);
field.set(user, "李四");

// 调用方法（包括 private）
Method method = User.class.getDeclaredMethod("privateMethod", String.class);
method.setAccessible(true);
Object result = method.invoke(user, "参数");
```

**典型应用：**
- [[Spring 基础与 IoC|Spring IoC]]：通过反射创建 Bean、注入依赖
- [[AOP 与动态代理|JDK 动态代理]]：基于反射调用目标方法
- 测试框架（JUnit）：自动发现并执行 `@Test` 方法
- 序列化框架（Jackson）：通过反射读写字段

**反射的性能问题：**

反射比直接调用慢（早期约慢 10-100 倍），原因是：
1. 需要动态解析类型，无法 JIT 内联优化
2. 参数需要装箱/拆箱
3. 安全检查开销

> [!tip] 实际影响没那么大
> 现代 JVM（JDK 8+）对反射有优化（inflation 机制：前 15 次用 JNI，之后生成字节码），高频调用性能接近直接调用。框架中大量使用反射，实际性能瓶颈通常不在反射本身。

---

## Java 8 新特性

### JDK 1.8 有哪些新特性？

**答案：**

高频特性：

- Lambda 表达式。
- 接口默认方法与静态方法。
- Stream API。
- 新日期时间 API（`java.time`）。
- `Optional`。

---

### Lambda 表达式了解多少？

**答案：**

Lambda 是函数式接口实例的简写形式，核心作用是==让行为参数化，减少样板代码==。

```java
// 传统匿名内部类
Runnable r1 = new Runnable() {
    @Override
    public void run() { System.out.println("hello"); }
};

// Lambda 简写
Runnable r2 = () -> System.out.println("hello");

// 方法引用（:: 语法）
List<String> list = Arrays.asList("b", "a", "c");
list.sort(String::compareTo);           // 实例方法引用
list.forEach(System.out::println);      // 实例方法引用
list.stream().map(String::toUpperCase); // 实例方法引用
Stream.of(1,2,3).map(Integer::valueOf); // 静态方法引用
```

**四大内置函数式接口：**

| 接口 | 方法签名 | 用途 |
|------|---------|------|
| `Function<T,R>` | `R apply(T t)` | 转换：输入 T，输出 R |
| `Consumer<T>` | `void accept(T t)` | 消费：输入 T，无返回 |
| `Supplier<T>` | `T get()` | 生产：无输入，返回 T |
| `Predicate<T>` | `boolean test(T t)` | 判断：输入 T，返回 boolean |

```java
Function<String, Integer> len = String::length;
len.apply("hello");  // 5

Consumer<String> print = System.out::println;
print.accept("hello");

Supplier<List<String>> listFactory = ArrayList::new;
List<String> newList = listFactory.get();

Predicate<String> isEmpty = String::isEmpty;
isEmpty.test("");  // true
```

---

### Optional 了解吗？

**答案：**

`Optional` 用于表达”值可能为空”，降低空指针风险。

```java
// 创建
Optional<String> opt1 = Optional.of(“hello”);      // 不能传 null，否则 NPE
Optional<String> opt2 = Optional.ofNullable(null); // 可以传 null
Optional<String> opt3 = Optional.empty();

// 错误用法：isPresent + get，和判断 null 没区别
if (opt1.isPresent()) {
    String s = opt1.get();  // 不推荐
}

// 正确用法：链式操作
String result = opt2.orElse(“默认值”);                    // 为空时返回默认值
String result2 = opt2.orElseGet(() -> computeDefault()); // 为空时执行 Supplier
opt1.ifPresent(s -> System.out.println(s));               // 有值时执行
String upper = opt1.map(String::toUpperCase).orElse(“”);  // 转换后取值
opt2.orElseThrow(() -> new RuntimeException(“值为空”));   // 为空时抛异常
```

> [!warning] Optional 的正确使用场景
> Optional 设计用于**方法返回值**，表示”可能没有结果”。不应该用于字段、方法参数、集合元素。

---

### Stream 流用过吗？

**答案：**

`Stream` 是面向集合处理的声明式 API，支持链式操作。

```java
List<String> names = Arrays.asList("Alice", "Bob", "Charlie", "David", "Eve");

// 常见操作链
List<String> result = names.stream()
    .filter(s -> s.length() > 3)       // 中间操作：过滤
    .map(String::toUpperCase)           // 中间操作：转换
    .sorted()                           // 中间操作：排序
    .limit(3)                           // 中间操作：限制数量
    .collect(Collectors.toList());      // 终端操作：收集

// 统计
long count = names.stream().filter(s -> s.startsWith("A")).count();

// reduce 聚合
int sum = Stream.of(1, 2, 3, 4, 5).reduce(0, Integer::sum);  // 15

// 分组
Map<Integer, List<String>> byLength = names.stream()
    .collect(Collectors.groupingBy(String::length));
```

**==惰性求值==（重要）：** ==中间操作不立即执行，只有遇到终端操作才触发==

```java
// 中间操作不立即执行，只有遇到终端操作才触发
Stream<String> stream = names.stream()
    .filter(s -> { System.out.println("filter: " + s); return s.length() > 3; })
    .map(s -> { System.out.println("map: " + s); return s.toUpperCase(); });
// 此时什么都没打印！

stream.findFirst();  // 触发执行，且只处理到找到第一个为止（短路）
```

**并行流的注意事项：**

```java
// 并行流：多线程处理，适合 CPU 密集型、数据量大的场景
long sum = LongStream.rangeClosed(1, 1_000_000).parallel().sum();

// 注意：并行流不适合有状态操作
List<Integer> result = new ArrayList<>();
Stream.of(1,2,3).parallel().forEach(result::add);  // 线程不安全！
// 正确：用 collect
List<Integer> safe = Stream.of(1,2,3).parallel().collect(Collectors.toList());
```

| 操作类型 | 方法 | 说明 |
|---------|------|------|
| 中间操作（惰性） | `filter/map/flatMap/sorted/distinct/limit/skip/peek` | 返回 Stream，不立即执行 |
| 终端操作（触发执行） | `forEach/collect/count/reduce/findFirst/anyMatch/toArray` | 触发整个流水线 |

---

## 相关链接

- [[面向对象]] — 反射基于 Class 对象
- [[AOP 与动态代理]] — JDK 动态代理基于反射实现
- [[Spring 基础与 IoC]] — Spring 依赖注入基于反射
- [[JVM 类加载机制]] — 反射涉及类加载过程
