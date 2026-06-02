---
module: Java基础
tags: [Java, String, 字符串常量池, 不可变]
difficulty: medium
last_reviewed: 2026-05-06
---

# String
## String 基础

### String 是基本数据类型吗？可以被继承吗？

**答案：**

- `String` 不是基本类型，是引用类型（类）。
- `String` 不能被继承，因为它被 `final` 修饰。

`String` 被设计为不可变类（Immutable），底层存储：
- Java 8：`private final char[] value`
- Java 9+：`private final byte[] value`（Compact Strings 优化，Latin-1 字符只用 1 字节，内存减半）

**不可变的三个好处：**
1. **线程安全**：多线程共享同一个 String 对象不需要同步
2. **可安全用作 HashMap key**：hashCode 不会变，不会出现存进去找不到的问题
3. **字符串常量池复用的前提**：多个引用指向同一个对象，必须保证对象不可变

---

### String、StringBuilder、StringBuffer 的区别？

**答案：**

| 类 | 可变性 | 线程安全 | 性能 | 适用场景 |
|----|--------|---------|------|---------|
| `String` | 不可变 | 安全 | 拼接慢（每次新建对象） | 字符串不变或少量拼接 |
| `StringBuilder` | 可变 | 不安全 | 最快 | 单线程频繁拼接（推荐） |
| `StringBuffer` | 可变 | 安全（synchronized） | 较慢 | 多线程共享拼接（极少用） |

```java
// 错误：循环中用 + 拼接，每次都 new StringBuilder，性能差
String result = "";
for (int i = 0; i < 1000; i++) {
    result += i;  // 等价于 result = new StringBuilder(result).append(i).toString()
}

// 正确：循环外创建一个 StringBuilder
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 1000; i++) {
    sb.append(i);
}
String result = sb.toString();
```

> [!tip] StringBuffer 已基本被淘汰
> 现代代码中几乎不用 StringBuffer。需要线程安全的字符串拼接场景，通常用 `ThreadLocal<StringBuilder>` 或直接用 `ConcurrentLinkedQueue` 收集再 join，而不是 StringBuffer。

---

## String 与字符串常量池

### `new String("abc")` 创建了几个对象？

**答案：**

==1 个或 2 个==，取决于常量池中是否已有 `"abc"`：

```java
// 情况 1：常量池中没有 "abc"
// → 创建 2 个对象：常量池中的 "abc" + 堆上的 String 对象
String s1 = new String("abc");

// 情况 2：常量池中已有 "abc"（比如之前用过字面量）
String s0 = "abc";  // 常量池中创建 "abc"
String s1 = new String("abc");  // 只在堆上创建 1 个对象，复用常量池的 "abc"
```

**`"abc"` 和 `new String("abc")` 的区别：**

```java
String a = "abc";              // 引用指向常量池
String b = "abc";              // 同一个常量池对象
String c = new String("abc");  // 引用指向堆上新对象

a == b;  // true，同一个常量池对象
a == c;  // false，c 在堆上
a.equals(c);  // true，内容相同

// intern() 可以把堆上对象的引用换成常量池引用
String d = c.intern();
a == d;  // true
```

**字符串常量池的位置变化（面试高频）：**

| JDK 版本 | 常量池位置 | 原因 |
|---------|-----------|------|
| JDK 7 之前 | 方法区（PermGen 永久代） | 固定大小，容易 OOM |
| ==JDK 7+== | ==堆内存== | 可以被 GC 回收，避免 OOM |

> [!warning] 为什么要移到堆？
> PermGen 大小固定（默认 64MB），大量使用字符串常量池（如 `intern()`）容易导致 `java.lang.OutOfMemoryError: PermGen space`。移到堆后可以被 GC 回收，且堆大小可以通过 `-Xmx` 灵活配置。

---

### 混合使用 new 和 + 时创建了几个对象？（面试高频）

**答案：**

这类题要分清楚：**编译期常量折叠** vs **运行时创建**。

#### 规则

1. **纯字面量拼接**：编译期直接合并，只在常量池创建 1 个对象
2. **含变量或 new 的拼接**：运行时用 StringBuilder 完成，结果在堆上，不进常量池

#### 逐题分析

```java
// 题 1：纯字面量
String s1 = "a" + "b" + "c";
// 编译期折叠为 "abc"，常量池中 1 个对象（"abc"）
// "a"、"b"、"c" 是否单独存在取决于代码中是否有其他引用

// 题 2：new + 字面量
String s2 = new String("a") + "b";
// 创建：常量池 "a"（若无）、堆上 new String("a")、常量池 "b"（若无）
// 拼接用 StringBuilder，结果 "ab" 在堆上，不在常量池
// 共 3~4 个对象（取决于常量池是否已有 "a"、"b"）

// 题 3：new + new
String s3 = new String("a") + new String("b");
// 常量池 "a"（若无）、堆上 new String("a")
// 常量池 "b"（若无）、堆上 new String("b")
// StringBuilder 拼接，结果 "ab" 在堆上
// 共 5~6 个对象

// 题 4：变量拼接
String x = "a";
String s4 = x + "b";
// x 是变量（非 final），编译器不能折叠
// 运行时 new StringBuilder().append(x).append("b").toString()
// 结果 "ab" 在堆上，不在常量池
```

#### 经典考题：`==` 比较结果

```java
String s1 = "ab";
String s2 = "a" + "b";
System.out.println(s1 == s2);  // true！编译期折叠，都指向常量池 "ab"

String a = "a";
String s3 = a + "b";
System.out.println(s1 == s3);  // false！a 是变量，运行时拼接，结果在堆上

final String fa = "a";
String s4 = fa + "b";
System.out.println(s1 == s4);  // true！fa 是 final 常量，编译期可折叠
```

> [!tip] 判断规则总结
> - 拼接的所有部分都是**字面量或 final 常量** → 编译期折叠 → 结果在常量池
> - 只要有一个**变量或 new** → 运行时拼接 → 结果在堆上，不在常量池

---

### String 是不可变类吗？字符串拼接如何实现？

**答案：**

是不可变类。底层 `value` 数组是 `private final` 的，且没有提供修改它的公开方法。

**字符串拼接的底层实现：**

```java
// 编译期优化：简单拼接 → StringBuilder
String s = "Hello" + " " + "World";
// 等价于：new StringBuilder("Hello").append(" ").append("World").toString()

// 注意：循环中的 + 每次都 new StringBuilder，性能差（见上方示例）

// Java 9+ 优化：invokedynamic + StringConcatFactory
// JVM 可以在运行时选择最优的拼接策略，不一定是 StringBuilder
```

**为什么 String 不可变但 `+` 能拼接？**

每次拼接都是创建了一个新的 String 对象，原来的对象没有改变。`s = s + "x"` 只是让变量 `s` 指向了新对象。

---

### String 的 hashCode 是怎么计算的？

**答案：**

```java
// String.hashCode() 的实现
int hash = 0;
for (char c : value) {
    hash = 31 * hash + c;
}
```

**为什么用 31？**
- 31 是质数，减少哈希碰撞
- `31 * i = (i << 5) - i`，JVM 可以用位运算优化，性能好
- 经验值：实践中分布均匀

> [!tip] 面试追问：String 可以安全用作 HashMap key 的原因
> 1. 不可变 → hashCode 不会变 → 存进去一定能找到
> 2. 重写了 `equals` → 内容相同的字符串被认为是同一个 key
> 3. 字符串常量池 → 相同字面量复用同一对象，减少内存占用

---

### intern 方法有什么作用？什么时候用？

**答案：**

`intern()` 将字符串放入常量池并返回常量池中的引用：
- 若常量池已有等值字符串 → 返回池中引用
- 若没有 → 将当前字符串加入池中，返回其引用

```java
String s1 = new String("hello");  // 堆上对象
String s2 = s1.intern();          // 返回常量池中的引用
String s3 = "hello";              // 常量池引用

s1 == s2;  // false，s1 在堆上
s2 == s3;  // true，都指向常量池
```

**使用场景：** 大量重复字符串（如从数据库读取的城市名、状态码），用 `intern()` 可以减少内存占用。

> [!warning] intern() 的风险
> 大量调用 `intern()` 会导致常量池膨胀，JDK 7+ 常量池在堆中，会增加 GC 压力。实际项目中谨慎使用，通常用 `Map<String, String>` 手动缓存更可控。

---

## 相关链接

- [[基础语法]] — 基本类型与引用类型、`==` 和 `equals`
- [[包装类与 Object]] — String 重写了 hashCode/equals
- [[JVM 内存管理]] — 字符串常量池 JDK 7+ 移到堆中
- [[HashMap核心原理]] — String 作为 key 的特殊性（不可变 + hashCode 稳定）
