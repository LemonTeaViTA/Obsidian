# ThreadLocal 改进方案

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadLocal](ThreadLocal.md), [ThreadLocalMap](ThreadLocalMap.md)

## 核心结论

ThreadLocal 的改进方案主要有三类：JDK 20 的 ScopedValue、Netty 的 FastThreadLocal、阿里的 TransmittableThreadLocal。

## 入口

- ScopedValue
- FastThreadLocal
- TransmittableThreadLocal
- 为什么要做改进

## 为什么要改进

ThreadLocal 很适合线程隔离，但它在父子线程传递、线程池复用和性能优化上都有局限，所以就出现了不同方向的改进方案。

## ScopedValue

ScopedValue 是 JDK 20 之后提供的新方案，更适合结构化并发和“作用域内共享”的场景。它强调的是作用域，而不是把值长期挂在线程上。

## FastThreadLocal

FastThreadLocal 是 Netty 的优化实现，核心思路是用数组索引替代哈希查找，减少冲突成本。
它通过维护一个全局递增的索引常量 `index` 取代哈希计算：
```java
private final int index;

public FastThreadLocal() {
    index = InternalThreadLocalMap.nextVariableIndex();
}
```
这种方式用空间换时间，避免了线性探测法的损耗，能够做到真正的 $O(1)$ 时间复杂度。

## TransmittableThreadLocal

TransmittableThreadLocal 主要解决线程池场景下的上下文传递问题。它不仅实现了子线程继承父线程变量，还能跨线程池（线程复用）传递值。
```java
TransmittableThreadLocal<String> context = new TransmittableThreadLocal<>();
context.set("value-set-in-parent");

// 即使在线程池中复用线程，也能正确获取该值：
Runnable task = new TtlRunnable(() -> {
    System.out.println(context.get()); // "value-set-in-parent"
});
executor.submit(task);
```
它会在任务提交和执行过程中捕获并恢复上下文，比 InheritableThreadLocal 更适合线程池。

## 关联页

- [ThreadLocal](ThreadLocal.md)
- [ThreadLocalMap](ThreadLocalMap.md)
