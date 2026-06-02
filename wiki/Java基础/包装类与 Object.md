---
module: Java基础
tags: [Java, 包装类, Object, hashCode, equals, 自动装箱]
difficulty: medium
last_reviewed: 2026-05-06
---

# 包装类与 Object
## 包装类

### 为什么要有包装类？

**答案：**

基本类型（`int/long/boolean`...）不是对象，有四个场景必须用包装类：

1. **泛型**：`List<int>` 非法，必须用 `List<Integer>`
2. **集合**：`HashMap/HashSet` 只能存对象
3. **null 值**：基本类型不能为 null，包装类可以（数据库字段可能为 null）
4. **工具方法**：`Integer.parseInt()`、`Integer.MAX_VALUE`、`Integer.toBinaryString()` 等

---

### 自动装箱和拆箱是什么？有什么风险？

**答案：**

- **装箱**：基本类型 → 包装类，编译器自动调用 `Integer.valueOf(int)`
- **拆箱**：包装类 → 基本类型，编译器自动调用 `intValue()`

```java
Integer a = 10;      // 装箱：Integer.valueOf(10)
int b = a;           // 拆箱：a.intValue()

// 风险：拆箱时包装类为 null → NullPointerException
Integer x = null;
int y = x;           // NullPointerException！

// 常见陷阱：包装类参与运算时自动拆箱
Integer i = null;
if (i == 10) { }     // NullPointerException！i 拆箱时抛出
```

> [!warning] 三元运算符的拆箱陷阱
> `Integer result = flag ? 1 : null;` 安全，但 `int result = flag ? 1 : null;` 会 NPE，因为 null 被强制拆箱为 int。

---

### Integer 127 与 128 的 `==` 比较结果？各包装类缓存范围是多少？

**答案：**

```java
Integer a = 127, b = 127;  // a == b → true，复用缓存
Integer c = 128, d = 128;  // c == d → false，超出缓存范围
```

**各包装类的缓存范围：**

| 包装类 | 缓存范围 | 说明 |
|--------|---------|------|
| `Byte` | -128 ~ 127 | 全部缓存 |
| `Short` | -128 ~ 127 | |
| `Integer` | -128 ~ 127 | 可通过 `-XX:AutoBoxCacheMax` 调整上限 |
| `Long` | -128 ~ 127 | |
| `Character` | 0 ~ 127 | |
| `Boolean` | true / false | 只有两个值，全部缓存 |
| `Float` | 无缓存 | |
| `Double` | 无缓存 | |

> [!tip] 包装类比较永远用 equals，不要用 ==
> 只有缓存范围内的值才会复用对象，超出范围的 `==` 结果不可预测。

---

### String 怎么转 Integer？parseInt 和 valueOf 有什么区别？

**答案：**

```java
// parseInt：返回基本类型 int
int a = Integer.parseInt("123");    // 123
int b = Integer.parseInt("-456");   // -456
int c = Integer.parseInt("FF", 16); // 255，支持指定进制

// valueOf：返回包装类 Integer（内部调用 parseInt，然后 Integer.valueOf(int)）
Integer d = Integer.valueOf("123"); // 会复用缓存（-128~127 范围内）

// 转换失败：抛 NumberFormatException
Integer.parseInt("abc");   // NumberFormatException
Integer.parseInt("12.3");  // NumberFormatException（不支持小数）
```

**区别总结：**

| 方法 | 返回类型 | 缓存 | 适用场景 |
|------|---------|------|---------|
| `parseInt(String)` | `int` | 无 | 需要基本类型时 |
| `valueOf(String)` | `Integer` | 有（-128~127） | 需要包装类时 |

---

## Object 类

### Object 类有哪些常见方法？

**答案：**

| 方法 | 作用 | 备注 |
|------|------|------|
| `equals(Object)` | 判断对象相等 | 默认比较地址，通常需要重写 |
| `hashCode()` | 返回哈希码 | 重写 equals 时必须同时重写 |
| `toString()` | 返回字符串表示 | 默认 `类名@hashCode十六进制` |
| `getClass()` | 返回运行时 Class 对象 | final 方法，不能重写 |
| `clone()` | 浅拷贝 | 需实现 Cloneable，见 [[对象语义#说说深拷贝和浅拷贝的区别？]] |
| `wait/notify/notifyAll` | 线程协作 | 见 [[线程基础与ThreadLocal]] |
| `finalize()` | GC 前回调 | 已废弃，不推荐使用 |

---

### 如何正确重写 equals？

**答案：**

`equals` 必须满足 5 个契约（来自 Object 规范）：

1. **自反性**：`x.equals(x)` 必须为 true
2. **对称性**：`x.equals(y)` 为 true，则 `y.equals(x)` 也必须为 true
3. **传递性**：`x.equals(y)` 且 `y.equals(z)`，则 `x.equals(z)` 也为 true
4. **一致性**：多次调用结果不变（对象状态未改变的前提下）
5. **非空性**：`x.equals(null)` 必须为 false

**标准重写模板：**

```java
public class Person {
    private String name;
    private int age;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;           // 1. 自反性快速返回
        if (o == null || getClass() != o.getClass()) return false;  // 2. null 检查 + 类型检查
        Person person = (Person) o;           // 3. 安全强转
        return age == person.age && Objects.equals(name, person.name);  // 4. 字段比较
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, age);       // 5. 同步重写 hashCode
    }
}
```

> [!warning] getClass() vs instanceof 的选择
> - `getClass() != o.getClass()`：严格类型匹配，子类和父类不相等（推荐）
> - `!(o instanceof Person)`：允许子类和父类相等，但会破坏对称性（子类重写 equals 后可能出问题）

---

### 为什么重写 equals 必须同时重写 hashCode？

**答案：**

`equals` 和 `hashCode` 有一个强制契约：**equals 相等的两个对象，hashCode 必须相等**。

`HashMap/HashSet` 的工作流程：先用 `hashCode` 定位桶，再用 `equals` 判等。

```java
// 反例：只重写 equals，不重写 hashCode
public class BadKey {
    private String id;

    @Override
    public boolean equals(Object o) {
        return o instanceof BadKey && ((BadKey) o).id.equals(this.id);
    }
    // 没有重写 hashCode！
}

Map<BadKey, String> map = new HashMap<>();
BadKey k1 = new BadKey("001");
map.put(k1, "value");

BadKey k2 = new BadKey("001");
map.get(k2);  // 返回 null！
// k1.equals(k2) == true，但 k1.hashCode() != k2.hashCode()
// 两个对象落在不同的桶里，get 找不到
```

---

### toString 的默认实现是什么？

**答案：**

默认实现：`getClass().getName() + "@" + Integer.toHexString(hashCode())`

```java
Object obj = new Object();
System.out.println(obj);  // java.lang.Object@1b6d3586

// 实际开发中应该重写 toString，方便调试
@Override
public String toString() {
    return "Person{name='" + name + "', age=" + age + "}";
}
// 或者用 IDE 自动生成，或者用 Lombok @ToString
```

---

### getClass() 和 instanceof 有什么区别？

**答案：**

```java
class Animal {}
class Dog extends Animal {}

Dog dog = new Dog();

// getClass()：精确匹配，不考虑继承
dog.getClass() == Dog.class;    // true
dog.getClass() == Animal.class; // false

// instanceof：考虑继承关系
dog instanceof Dog;    // true
dog instanceof Animal; // true（Dog 是 Animal 的子类）

// Java 16+ 模式匹配 instanceof
if (dog instanceof Animal a) {
    a.eat();  // 直接使用，不需要强转
}
```

**在 equals 中的选择：**
- 用 `getClass()`：子类和父类永远不相等，更安全（推荐）
- 用 `instanceof`：允许子类和父类相等，但可能破坏对称性

---

## 相关链接

- [[基础语法]] — 基本类型与包装类转换、自动装箱陷阱
- [[对象语义]] — 深拷贝/浅拷贝（clone）、equals 与 hashCode 的深入讨论
- [[String]] — String 重写了 equals/hashCode
- [[HashMap核心原理]] — hashCode/equals 是 HashMap 的基础
- [[JVM 内存管理]] — 自动装箱拆箱与对象创建
- [[线程基础与ThreadLocal]] — wait/notify/notifyAll 的使用
