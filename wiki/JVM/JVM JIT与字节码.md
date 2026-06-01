---
module: JVM
tags: [JVM, JIT, 字节码, 分层编译, 方法内联, invokedynamic]
difficulty: hard
last_reviewed: 2026-05-07
---

# JVM JIT 与字节码

## JIT 编译基础

### 为什么需要 JIT？解释执行到底慢在哪？

Java 的执行路径是：`.java → .class 字节码 → JVM 解释执行 / JIT 编译执行`。

==解释执行的瓶颈不在"翻译"这一步，而在于每次循环都要重新走一遍翻译流程，且无法做跨指令优化==：

- **重复翻译**：热点方法可能被调用百万次，解释器要翻译百万次。
- **无法优化**：解释器看到的是单条字节码，做不了内联、循环展开、逃逸分析。
- **寄存器利用率低**：每条字节码都通过操作数栈进行，寄存器几乎用不上。

JIT（Just-In-Time Compiler）==在运行时把热点代码编译成本地机器码==并缓存到 CodeCache，后续直接执行机器码，同时在编译时结合运行时信息（类型反馈、分支概率）做激进优化。

> [!tip] "运行时信息"是 JIT 的超能力
> 静态编译的 C++ 无法知道"这个虚方法 99% 调用的是 ArrayList 的 get"，但 JIT 能基于类型反馈把虚调用去虚拟化（devirtualize），甚至内联进调用点。这是 JVM 能在稳态下接近 C++ 性能的关键。

---

### 什么是热点代码？怎么识别？

HotSpot 采用==基于计数器的热点探测==，每个方法有两个计数器：

- **方法调用计数器**（Invocation Counter）：统计方法被调用的次数
- **回边计数器**（Back Edge Counter）：统计循环体执行的次数（循环回跳称作回边）

当任一计数器超过阈值，就触发 JIT 编译。

> [!note] 阈值在分层编译下不一样
> 经典值 "C1 默认 1500、C2 默认 10000" 指的是**关闭分层编译**时的 client/server 模式 `CompileThreshold`。而 JDK 8 起默认开启分层编译，实际触发用的是分层阈值，如 `Tier3InvocationThreshold≈200`、`Tier4InvocationThreshold≈5000`（还会结合回边计数综合判定）。作为面试简化记 1500/10000 可以，但要知道分层下不是这两个数。

```bash
# 查看 JIT 编译情况
-XX:+PrintCompilation

# 输出示例：
#  155    1       3       java.lang.String::hashCode (55 bytes)
#  ^      ^       ^       ^                          ^
# 时间   编译ID  层级    方法全名                    字节码大小
```

> [!warning] 计数器会衰减
> 方法计数器默认会随时间衰减（`-XX:CounterHalfLifeTime`），防止长期运行但单位时间内调用不频繁的方法被误判为热点。

---

### 分层编译（Tiered Compilation）5 个级别是什么？

JDK 8 默认开启分层编译（`-XX:+TieredCompilation`），结合解释器 + C1 + C2：

| 层级 | 执行方式 | 特点 |
|------|---------|------|
| Level 0 | 解释执行 | 最慢，但启动快、收集 profile |
| Level 1 | C1 编译，无 profile | 简单优化，不插桩 |
| Level 2 | C1 编译，有限 profile | 插桩收集调用/回边计数 |
| Level 3 | C1 编译，完全 profile | 插桩收集所有 profile 信息（默认） |
| Level 4 | C2 编译 | 激进优化，基于 Level 3 的 profile |

==正常路径是 `0 → 3 → 4`==：解释器启动 → C1 编译带完整 profile 版本 → 达到 C2 阈值后 C2 基于 profile 做激进优化。

```bash
# 关闭分层编译，只用 C2（启动慢，稳态可能略快）
-XX:-TieredCompilation

# 只用 C1（启动快，稳态峰值低，适合短生命周期应用）
-XX:TieredStopAtLevel=1
```

> [!tip] AWS Lambda 为什么推荐 `TieredStopAtLevel=1`？
> Serverless 函数每次冷启动都要重新 JIT。C2 编译虽然能带来 20-30% 峰值性能，但要积累数万次调用才能生效；函数实例可能跑 100 次就被回收，C2 的优化根本没收益。C1 反而更划算。

---

### C1 和 C2 编译器的区别？

| 维度 | C1（Client Compiler） | C2（Server Compiler） |
|------|---------------------|---------------------|
| 优化强度 | 轻量 | 激进 |
| 编译速度 | 快 | 慢 |
| 峰值性能 | 中等 | 高 |
| 典型优化 | 方法内联（小方法）、去虚拟化 | 激进内联、逃逸分析、标量替换、循环展开、向量化 |
| 适用场景 | GUI/启动敏感应用 | 长期运行的服务端应用 |

早期（JDK 9-16）曾在 OpenJDK 主线提供实验性的 **Graal JIT 编译器**（用 Java 写的，经 JVMCI 接入，`-XX:+UseJVMCICompiler` 开启），优化能力更强，尤其对 Scala/Kotlin 这种高阶函数密集的代码。

> [!warning] 实验性 Graal JIT 已在 JDK 17 移除
> [JEP 410](https://openjdk.org/jeps/410) 在 **JDK 17** 移除了 OpenJDK 主线里的实验性 AOT（`jaotc`）与实验性 Graal JIT，`-XX:+UseJVMCICompiler` 在主线 OpenJDK 已不可用。该能力现仅存在于 **GraalVM 发行版 / Oracle GraalVM** 中。对 2026 年主流的 JDK 17/21 而言，"用 Graal 替代 C2"特指换用 GraalVM 发行版，而非在标准 OpenJDK 里开个开关。

---

## 字节码基础

### 类文件结构（Class File）

```
ClassFile {
    u4  magic;              // 魔数 0xCAFEBABE
    u2  minor_version;
    u2  major_version;      // 主版本号（JDK 8 = 52, JDK 17 = 61）
    u2  constant_pool_count;
    cp_info constant_pool[];  // 常量池
    u2  access_flags;       // public/final/abstract 等
    u2  this_class;
    u2  super_class;
    u2  interfaces_count;
    u2  interfaces[];
    u2  fields_count;
    field_info fields[];    // 字段表
    u2  methods_count;
    method_info methods[];  // 方法表
    u2  attributes_count;
    attribute_info attributes[];  // 属性表（包括字节码）
}
```

查看字节码：`javap -v -p MyClass.class`

---

### 五大 invoke 指令族（面试高频）

字节码层面的方法调用有 5 条指令，分别对应不同的调用语义：

| 指令 | 调用对象 | 分派方式 | 典型场景 |
|------|---------|---------|---------|
| `invokestatic` | 静态方法 | 静态分派（编译期确定） | `Math.max(a, b)` |
| `invokespecial` | 构造器、private、super.X | 静态分派 | `new X()`、`super.method()` |
| `invokevirtual` | 普通实例方法 | **动态分派**（运行时查 vtable） | `list.add(x)` |
| `invokeinterface` | 接口方法 | **动态分派**（查 itable，比 vtable 慢） | `map.get(k)` |
| `invokedynamic` | 动态绑定 | **运行时通过 BootstrapMethod 解析** | Lambda、字符串拼接（JDK9+） |

```java
public class InvokeDemo {
    public static void sm() {}        // invokestatic
    private void pm() {}              // invokespecial
    public void vm() {}               // invokevirtual

    public void test() {
        sm();                          // invokestatic
        pm();                          // invokespecial
        vm();                          // invokevirtual
        List<Integer> l = new ArrayList<>();
        l.add(1);                      // invokeinterface (List 是接口)
        Runnable r = () -> sm();       // invokedynamic (Lambda)
    }
}
```

---

### invokedynamic 与 Lambda 实现原理

==Lambda 表达式在字节码层面不是匿名内部类==——它通过 `invokedynamic` + `LambdaMetafactory` 在运行时动态生成实现类。

```java
Runnable r = () -> System.out.println("hi");
```

字节码大致是：

```
invokedynamic #2, 0  // InvokeDynamic #0:run:()Ljava/lang/Runnable;
```

第一次执行时，JVM 调用 `LambdaMetafactory.metafactory()` 生成一个实现 Runnable 的类（类似 `MyClass$$Lambda$1/0x00000001`），之后缓存 CallSite 直接跳转。

> [!tip] 为什么不用匿名内部类？
> 匿名内部类每个 Lambda 都要在编译期生成 `.class` 文件，启动时加载。invokedynamic 让类在**首次用到时**才生成，降低类加载压力，而且实现策略可以在不改字节码的前提下由 JVM 版本升级自动优化。JDK 9+ 的字符串拼接 `"a" + b + "c"` 也改用了 invokedynamic。

---

## JIT 核心优化

### 方法内联（Method Inlining）

==方法内联是 JIT 所有优化的"入场券"==——只有方法被内联到调用点，后续的逃逸分析、常量传播、死代码消除才能跨方法生效。

```java
// 内联前
public int calc(int x) { return add(x, 10); }
public int add(int a, int b) { return a + b; }

// JIT 内联后（概念上）
public int calc(int x) { return x + 10; }
```

**触发条件：**

```bash
-XX:MaxInlineSize=35      # 默认 35 字节码，方法体小于此值才考虑内联
-XX:FreqInlineSize=325    # 热点方法放宽到 325 字节码
-XX:MaxInlineLevel=9      # 最大内联深度
-XX:InlineSmallCode=2000  # 已编译方法大小限制
```

**内联的障碍：**

1. ==方法体过大==（超过 `MaxInlineSize`）——所以手写"大一统"方法反而会阻碍优化
2. ==虚方法调用无法静态确定目标==——需要类型反馈去虚拟化后才能内联
3. ==native 方法==——JIT 看不到字节码
4. ==方法被频繁重写/类被频繁加载==——JIT 可能被迫反优化（deoptimization）

> [!warning] 不要过度手工内联
> 很多人为了"性能"把短方法全部写成一个大方法。JIT 对 `MaxInlineSize=35` 以下的方法几乎无成本内联，手工内联反而会**阻止** JIT 的类型反馈优化。小方法 + 好命名 > 大方法。

---

### 逃逸分析的三大优化

JDK 7+ 默认开启（`-XX:+DoEscapeAnalysis`）。分析对象的"逃逸等级"后做三种优化：

#### 1. 栈上分配（Stack Allocation）

对象不逃逸出方法 → 分配在栈上，随栈帧自动回收，GC 零压力。

```java
public int sum() {
    Point p = new Point(1, 2);  // 未逃逸
    return p.x + p.y;            // JIT 可能分配到栈
}
```

#### 2. 标量替换（Scalar Replacement）

==比栈上分配更激进==——直接把对象"拆解"为基本类型变量，连对象都不创建。

```java
// 优化前
Point p = new Point(1, 2);
int s = p.x + p.y;

// 标量替换后（概念上）
int p_x = 1;
int p_y = 2;
int s = p_x + p_y;
```

> [!tip] 面试陷阱：栈上分配其实很少发生
> HotSpot 实际的"栈上分配"主要是通过标量替换实现的，真正的"对象整体分配到栈"很少。如果面试官问起，说"HotSpot 主要通过标量替换实现栈上分配效果"更准确。

#### 3. 同步消除（Lock Elision）

对象不逃逸出线程 → 对它的 synchronized 直接消除。

```java
public String concat(String a, String b) {
    StringBuffer sb = new StringBuffer();  // 不逃逸
    sb.append(a);  // synchronized 被消除
    sb.append(b);
    return sb.toString();
}
```

这就是为什么 JDK 新代码里大家敢用 StringBuffer（虽然还是推荐 StringBuilder）。

---

### OSR（On-Stack Replacement）是什么？

==方法还没返回，循环体已经热了怎么办？== 这就是 OSR 要解决的问题。

正常 JIT 流程：方法被调用 N 次 → 编译完成 → **下次调用**生效。但如果一个方法里有个跑 1 亿次的循环，这方法一次都没返回，普通 JIT 永远触发不了。

OSR 的做法：==在循环的回边处植入检查点==，当回边计数器达到阈值，JVM 在循环执行过程中直接把栈帧替换为编译后的版本，从当前循环状态继续跑编译后的代码。

```bash
-XX:OnStackReplacePercentage=140  # OSR 触发的回边阈值比例
```

面试场景：为什么我的 main 里 while(true) 循环刚启动很慢、跑一会儿突然变快？——OSR 发生了。

---

## CodeCache

### CodeCache 是什么？满了会怎样？

CodeCache 是 JVM 中==存放 JIT 编译后本地机器码的专属内存区域==，独立于堆和元空间。

```bash
-XX:InitialCodeCacheSize=160m
-XX:ReservedCodeCacheSize=240m   # 默认 240M
-XX:+PrintCodeCache              # 退出时打印使用情况
```

**满了的后果（JDK 9 前是坑点）：**

- JDK 8 及之前：CodeCache 满 → JIT **直接停止编译** → 所有代码退回解释执行 → 性能悬崖式下跌
- JDK 9+：引入分段 CodeCache（Segmented CodeCache，`-XX:+SegmentedCodeCache`），按 non-profiled / profiled / non-method 分区，满了会扫描回收冷代码

**排查症状**：服务跑了几天后 CPU 飙高、吞吐骤降，但堆内存、GC 正常——大概率 CodeCache 满了。

```bash
# JDK 9+ 可以看分段情况
jcmd <pid> Compiler.CodeHeap_Analytics
```

---

## 反优化（Deoptimization）

### JIT 编译后的代码为什么还会失效？

JIT 的优化==基于假设==：

- "这个虚方法目前只有一种实现"→ 去虚拟化
- "这个分支 99% 走 true"→ 分支预测优化
- "这个类型反馈永远是 ArrayList"→ 内联具体实现

一旦假设被打破（加载了新实现类、分支反转、出现未见过的类型），JIT 会触发**反优化**：丢弃编译后的代码，回退到解释执行，重新收集 profile 再编译。

```bash
-XX:+PrintCompilation  # 会打印 "made not entrant"、"made zombie"
```

> [!warning] 频繁反优化是性能杀手
> 如果一个方法反复被编译、反优化、再编译，说明类型反馈极不稳定。典型场景：一个 List 变量时而接 ArrayList 时而接 LinkedList 时而接 CopyOnWriteArrayList。写代码时让热路径上的类型稳定，能显著提升 JIT 优化效果。

---

## 预热问题

### 为什么线上要做 JVM 预热？

Java 服务刚启动时：==解释执行 → 收集 profile → C1 编译 → C2 编译==，这个过程可能持续几分钟。期间：

- 首个请求响应时间可能是稳态的 10-100 倍
- 全量接入流量会导致大量请求超时
- 分布式系统里可能触发熔断/下游服务雪崩

**预热方案：**

1. **代码预热**：启动后主动调用核心路径 N 次（如 5000 次），触发 JIT 编译
2. **流量预热**：网关/负载均衡对新实例渐进式放量（1% → 10% → 100%）
3. **CDS / AppCDS / 动态 CDS**：类数据共享，把类元数据预先归档，加速类加载（JDK 10 引入 AppCDS、JDK 13 引入动态 CDS）。不解决 JIT 但显著改善启动
4. **GraalVM Native Image**：彻底 AOT，编译期生成本地镜像、无解释阶段，启动近乎瞬时，但失去 JIT 的运行时优化能力（峰值吞吐通常低于 JIT 稳态）

> [!note] jaotc 已成历史，别再背
> JDK 9（JEP 295）曾引入实验性 AOT 工具 `jaotc`，但它已在 **JDK 17（JEP 410）连同实验性 Graal JIT 一起被移除**。2026 年谈"提前编译"应落在 GraalVM Native Image、AppCDS/动态 CDS，以及面向未来的 [Project Leyden](https://openjdk.org/projects/leyden/)（AOT 缓存方向），而不是 jaotc。

---

## 相关链接

- [[JVM 概述]] — JIT 是执行引擎的核心
- [[JVM 垃圾收集]] — 逃逸分析降低 GC 压力
- [[JVM 内存管理]] — CodeCache 是堆外内存的一部分
- [[JVM 类加载机制]] — 类加载触发 JIT 反优化的场景
- [[Java基础/注解、反射与 Java 8]] — Lambda 基于 invokedynamic 实现
