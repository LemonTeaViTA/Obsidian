---
module: JVM
tags: [JVM, 调优, GC调优, 性能]
difficulty: hard
last_reviewed: 2026-04-20
---

# JVM 调优

## 性能监控工具

### 用过哪些性能监控的命令行工具？

操作系统层面，我用过 top、vmstat、iostat、netstat 等命令，可以监控系统整体的资源使用情况，比如说内存、CPU、IO 使用情况、网络使用情况。

JDK 自带的命令行工具层面，我用过 jps、jstat、jinfo、jmap、jhat、jstack、jcmd 等，可以查看 JVM 运行时信息、内存使用情况、堆栈信息等。

#### 你一般都怎么用 jmap？

①、使用 `jmap -heap <pid>` 查看堆内存摘要，包括新生代、老年代、元空间等。

②、使用 `jmap -histo <pid>` 查看对象分布。

③、生成堆转储文件：`jmap -dump:format=b,file=<path> <pid>`。

#### 了解哪些可视化的性能监控工具？

①、JConsole：JDK 自带的监控工具，可以用来监视 Java 应用程序的运行状态，包括内存使用、线程状态、类加载、GC 等。

②、VisualVM：一个基于 NetBeans 的可视化工具，在很长一段时间内，VisualVM 都是 Oracle 官方主推的故障处理工具。集成了多个 JDK 命令行工具的功能，非常友好。

③、Java Mission Control：JMC 最初是 JRockit VM 中的诊断工具，但在 Oracle JDK7 Update 40 以后，就绑定到了 HotSpot VM 中。

#### 用过哪些第三方的工具？

①、MAT：一个 Java 堆内存分析工具，主要用于分析和查找 Java 堆中的内存泄漏和内存消耗问题；可以从 Java 堆转储文件中分析内存使用情况，并提供丰富的报告，如内存泄漏疑点、最大对象和 GC 根信息；支持通过图形界面查询对象，以及检查对象间的引用关系。

②、GChisto：GC 日志分析工具，可以帮助我们优化垃圾收集行为和调整 GC 性能。

③、JProfiler：一个全功能的商业化 Java 性能分析工具，提供 CPU、内存和线程的实时分析。

④、arthas：阿里巴巴开源的 Java 诊断工具，主要用于线上的应用诊断；支持在不停机的情况下进行诊断；可以提供包括 JVM 信息查看、监控、Trace 命令、反编译等功能。

⑤、async-profiler：一个低开销的性能分析工具，支持生成火焰图，适用于复杂性能问题的分析。

## JVM 参数配置

### JVM 的常见参数配置知道哪些？

#### 配置堆内存大小的参数有哪些？

- `-Xms`：初始堆大小
- `-Xmx`：最大堆大小
- `-XX:NewSize=n`：设置年轻代大小
- `-XX:NewRatio=n`：设置年轻代和年老代的比值。如：n 为 3 表示年轻代和年老代比值为 1:3，年轻代占总和的 1/4
- `-XX:SurvivorRatio=n`：年轻代中 Eden 区与两个 Survivor 区的比值。如 n=3 表示 Eden 占 3，Survivor 占 2，一个 Survivor 区占整个年轻代的 1/5

#### 配置 GC 收集器的参数有哪些？

- `-XX:+UseSerialGC`：设置串行收集器
- `-XX:+UseParallelGC`：设置并行收集器
- `-XX:+UseParalledlOldGC`：设置并行老年代收集器
- `-XX:+UseConcMarkSweepGC`：设置并发收集器

#### 配置并行收集的参数有哪些？

- `-XX:MaxGCPauseMillis=n`：设置最大垃圾回收停顿时间
- `-XX:GCTimeRatio=n`：设置垃圾回收时间占程序运行时间的比例
- `-XX:+CMSIncrementalMode`：设置增量模式，适合单 CPU 环境
- `-XX:ParallelGCThreads=n`：设置并行收集器的线程数

#### 打印 GC 回收的过程日志信息的参数有哪些？

- `-XX:+PrintGC`：输出 GC 日志
- `-XX:+PrintGCDetails`：输出 GC 详细日志
- `-XX:+PrintGCTimeStamps`：输出 GC 的时间戳（以基准时间的形式）
- `-Xloggc:filename`：日志文件的输出路径

## JVM 调优实战

### 做过 JVM 调优吗？

做过。JVM 调优是一个复杂的过程，调优的对象包括堆内存、垃圾收集器和 JVM 运行时参数等。

如果堆内存设置过小，可能会导致频繁的垃圾回收。所以在技术派实战项目中，启动 JVM 的时候配置了 `-Xms` 和 `-Xmx` 参数，让堆内存最大可用内存为 2G。

在项目运行期间，我会使用 JVisualVM 定期观察和分析 GC 日志，如果发现频繁的 Full GC，我会特意关注一下老年代的使用情况。接着，通过分析 Heap dump 寻找内存泄漏的源头，看看是否有未关闭的资源，长生命周期的大对象等。之后进行代码优化，比如说减少大对象的创建、优化数据结构的使用方式、减少不必要的对象持有等。

### CPU 占用过高怎么排查？

首先，使用 top 命令查看 CPU 占用情况，找到占用 CPU 较高的进程 ID。

```bash
top
```

接着，使用 jstack 命令查看对应进程的线程堆栈信息。

```bash
jstack -l <pid> > thread-dump.txt
```

然后再使用 top 命令查看进程中线程的占用情况，找到占用 CPU 较高的线程 ID。

```bash
top -H -p <pid>
```

注意，top 命令显示的线程 ID 是十进制的，而 jstack 输出的是十六进制的，所以需要将线程 ID 转换为十六进制。

```bash
printf "%x\n" PID
```

接着在 jstack 的输出中搜索这个十六进制的线程 ID，找到对应的堆栈信息。

```text
"Thread-5" #21 prio=5 os_prio=0 tid=0x00007f812c018800 nid=0x1a85 runnable [0x00007f811c000000]
   java.lang.Thread.State: RUNNABLE
    at com.example.MyClass.myMethod(MyClass.java:123)
    at ...
```

最后，根据堆栈信息定位到具体的业务方法，查看是否有死循环、频繁的垃圾回收、资源竞争导致的上下文频繁切换等问题。

### 内存飙高问题怎么排查？

内存飙高一般是因为创建了大量的 Java 对象导致的，如果持续飙高则说明垃圾回收跟不上对象创建的速度，或者内存泄漏导致对象无法回收。

排查的方法主要分为以下几步：

第一，先观察垃圾回收的情况，可以通过 `jstat -gc PID 1000` 查看 GC 次数和时间。或者使用 `jmap -histo PID | head -20` 查看堆内存占用空间最大的前 20 个对象类型。

第二步，通过 jmap 命令 dump 出堆内存信息。

第三步，使用可视化工具分析 dump 文件，比如说 VisualVM，找到占用内存高的对象，再找到创建该对象的业务代码位置，从代码和业务场景中定位具体问题。

### 频繁 Minor GC 怎么办？

频繁的 Minor GC 通常意味着新生代中的对象频繁地被垃圾回收，可能是因为新生代空间设置的过小，或者是因为程序中存在大量的短生命周期对象（如临时变量）。

可以使用 GC 日志进行分析，查看 GC 的频率和耗时，找到频繁 GC 的原因。

```bash
-XX:+PrintGCDetails -Xloggc:gc.log
```

如果是因为新生代空间不足，可以通过 `-Xmn` 增加新生代的大小，减缓新生代的填满速度。

```bash
java -Xmn256m your-app.jar
```

如果对象需要长期存活，但频繁从 Survivor 区晋升到老年代，可以通过 `-XX:SurvivorRatio` 参数调整 Eden 和 Survivor 的比例。默认比例是 8:1，调整为 6 的话，会减少 Eden 区的大小，增加 Survivor 区的大小，以确保对象在 Survivor 区中存活的时间足够长，避免过早晋升到老年代。

```bash
-XX:SurvivorRatio=6
```

### 频繁 Full GC 怎么办？

频繁的 Full GC 通常意味着老年代中的对象频繁地被垃圾回收，可能是因为老年代空间设置的过小，或者是因为程序中存在大量的长生命周期对象。

#### 该怎么排查 Full GC 频繁问题？

一般会使用 JDK 的自带工具，包括 jmap、jstat 等。

```bash
# 查看堆内存各区域的使用率以及GC情况
jstat -gcutil -h20 pid 1000
# 查看堆内存中的存活对象，并按空间排序
jmap -histo pid | head -n20
# dump堆内存文件
jmap -dump:format=b,file=heap pid
```

或者使用一些可视化的工具，比如 VisualVM、JConsole 等，查看堆内存的使用情况。

- 假如是因为大对象直接分配到老年代导致的 Full GC 频繁，可以通过 `-XX:PretenureSizeThreshold` 参数设置大对象直接进入老年代的阈值，或者将大对象拆分成小对象，比如说分页。
- 假如是因为内存泄漏导致的频繁 Full GC，可以通过分析堆内存 dump 文件找到内存泄漏的对象，再找到内存泄漏的代码位置。
- 假如是因为长生命周期的对象进入到了老年代，要及时释放资源，比如说 ThreadLocal、数据库连接、IO 资源等。
- 假如是因为 GC 参数配置不合理导致的频繁 Full GC，可以通过调整 GC 参数来优化 GC 行为，或者直接更换更适合的 GC 收集器，如 G1、ZGC 等。

---

## GC 日志逐行解读

### 怎么看 Parallel / CMS 的 GC 日志？

```
2026-05-07T10:15:32.123+0800: 45.678: [GC (Allocation Failure)
  [PSYoungGen: 102400K->12800K(122880K)]
  204800K->120320K(262144K), 0.0567890 secs]
  [Times: user=0.15 sys=0.01, real=0.06 secs]
```

逐段解读：

| 片段 | 含义 |
|------|------|
| `45.678` | JVM 启动后 45.678 秒 |
| `GC (Allocation Failure)` | Minor GC，触发原因是分配失败（Eden 满） |
| `PSYoungGen: 102400K->12800K(122880K)` | 新生代：GC 前 100M → GC 后 12.5M，总容量 120M |
| `204800K->120320K(262144K)` | 整个堆：GC 前 200M → GC 后 117.5M，总容量 256M |
| `0.0567890 secs` | 本次 GC 耗时 ~57ms |
| `user=0.15 sys=0.01 real=0.06` | 用户态 CPU 0.15s、系统 CPU 0.01s、墙钟时间 0.06s |

==`user` 远大于 `real` 说明是多线程 GC（并行），正常==。
==`user < real` 或 `sys` 很大要警惕：可能是 GC 线程被操作系统调度抢占、有 IO 抖动==。

---

### G1 的 GC 日志怎么读？

```
2026-05-07T10:15:32.123+0800: 45.678: [GC pause (G1 Evacuation Pause) (young), 0.0234567 secs]
   [Parallel Time: 20.1 ms, GC Workers: 8]
   [Eden: 512.0M(512.0M)->0.0B(520.0M)
    Survivors: 8.0M->16.0M
    Heap: 1.5G(2.0G)->1.0G(2.0G)]
```

关键字：

- ==`G1 Evacuation Pause`==：G1 的核心操作，把存活对象从旧 Region 复制到新 Region
- ==`(young)`==：只回收年轻代；==`(mixed)`==：混合回收（年轻代 + 部分老年代 Region）
- ==`Parallel Time`==：并行阶段耗时
- ==`Eden / Survivors / Heap` 变化==：GC 前后的 Region 分配情况

**G1 特有的 GC 阶段**（完整并发周期）：

```
[GC pause (G1 Humongous Allocation) (young) (initial-mark)]  ← 初始标记（STW）
[GC concurrent-root-region-scan-start]                        ← 并发扫描
[GC concurrent-mark-start]                                    ← 并发标记
[GC remark]                                                   ← 最终标记（STW）
[GC cleanup]                                                  ← 清理（STW，统计 Region 回收价值）
```

---

## 典型故障案例

### 案例 1：CMS Concurrent Mode Failure

**症状**：CMS 日志出现 `concurrent mode failure` + 退化为 Serial Old（单线程 Full GC），STW 几秒。

**根因**：并发清理还没完成，老年代又满了，CMS 没办法只能 STW。

**常见触发场景：**

1. ==`CMSInitiatingOccupancyFraction` 设得太高==（默认 92%，太晚触发 CMS）
2. ==老年代碎片化严重==，有空间但没连续空间
3. ==新生代晋升速度过快==，CMS 来不及并发回收

**处理：**

```bash
# 提前触发 CMS（降低阈值）
-XX:CMSInitiatingOccupancyFraction=70
-XX:+UseCMSInitiatingOccupancyOnly    # 只看这个阈值，不自适应

# 控制晋升
-XX:MaxTenuringThreshold=15            # 年龄阈值
-XX:SurvivorRatio=8                    # Eden:Survivor = 8:1

# 定期压缩老年代，避免碎片
-XX:+UseCMSCompactAtFullCollection
-XX:CMSFullGCsBeforeCompaction=5       # 每 5 次 Full GC 压缩一次
```

> [!warning] CMS 已在 JDK 14 移除
> 如果面试官问 CMS，重点不是让你调 CMS，而是考察你是否理解"并发 GC 的核心矛盾"。CMS 的坑基本是 G1 解决的主要问题。

---

### 案例 2：G1 Humongous 对象导致的 Full GC

**症状**：明明堆还很空闲，却频繁 Full GC，日志里有 `G1 Humongous Allocation`。

**根因**：==超过 Region 50% 的大对象直接进老年代 Humongous 区==，且 Humongous 对象在 G1 里回收很激进——JDK 8u40 之前甚至只有 Full GC 才能回收 Humongous。

**定位：**

```bash
# 看日志里有没有 Humongous 字样
grep -i "humongous" gc.log

# 找出代码里的大对象
jmap -histo <pid> | head -20
```

**典型凶手：**

- 一次性查数据库几十万行，查出大 List/大 String
- 大的 JSON 序列化后的 byte[]
- 大的 Excel/PDF 导出缓冲区

**处理：**

```bash
# 增大 Region，让对象不再算 Humongous
-XX:G1HeapRegionSize=16m     # 默认 1-32M，按堆大小自适应

# 或者拆分业务：分页查询、流式处理
```

---

### 案例 3：Metaspace 持续增长导致 Full GC 频繁

**症状**：`Full GC` 频繁，但 `Old Gen` 使用率不高，`Metaspace` 使用率持续上涨。

**根因**：ClassLoader 泄漏 —— 动态生成的类（Groovy、Spring CGLIB、JSP）加载进来但无法被卸载。

**定位：**

```bash
# JDK 8+
jcmd <pid> GC.class_stats | sort -k3 -rn | head -20

# 或者 dump 看 ClassLoader
jmap -clstats <pid>
```

**典型凶手：**

- Spring Boot DevTools 热部署反复加载
- Groovy 脚本每次执行都 new GroovyClassLoader
- Fastjson 1.x 动态生成序列化类未复用

**处理：**

```bash
# 先让它早 OOM 暴露问题（别无脑调大）
-XX:MaxMetaspaceSize=256m
-XX:+HeapDumpOnOutOfMemoryError

# 代码层：复用 ClassLoader、关闭 DevTools、升级 Fastjson 2.x
```

---

## 相关链接

- [[JVM 内存管理]] — 内存区域划分是调优的基础
- [[JVM 垃圾收集]] — GC 收集器选型与 GC 日志分析
- [[JVM JIT与字节码]] — JIT 预热、CodeCache 调优
- [[JVM 类加载机制]] — 类加载问题排查
- [[线程基础与ThreadLocal]] — 线程数与线程栈大小影响内存分配
