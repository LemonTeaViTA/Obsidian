# InheritableThreadLocal

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadLocal](ThreadLocal.md)

## 核心结论

InheritableThreadLocal 允许子线程继承父线程中的局部变量值，适合需要把上下文从父线程传递给子线程的场景。

## 入口

- inheritableThreadLocals
- 子线程继承
- 与 ThreadLocal 的区别
- 在线程池中的限制
- Thread 类的两个 ThreadLocalMap
- init() 复制父线程变量

## 关键点

Thread 类中同时存在 threadLocals 和 inheritableThreadLocals 两个成员。普通 ThreadLocal 存在 threadLocals 中，不会自动传给子线程；InheritableThreadLocal 存在 inheritableThreadLocals 中，子线程创建时会复制父线程中的值。

```java
public class Thread {
	ThreadLocal.ThreadLocalMap threadLocals = null;
	ThreadLocal.ThreadLocalMap inheritableThreadLocals = null;
}
```

## 使用场景

它适合传递一些“创建线程时就应该继承”的上下文，例如请求标识、用户上下文、日志链路标识等。

## 在线程池中的限制

线程池会复用线程，任务并不总是发生在“新建子线程”的时刻，所以 InheritableThreadLocal 往往不能直接满足线程池里的上下文传递需求。这个场景通常需要更专门的方案，比如 TransmittableThreadLocal。

## 和 ThreadLocal 的区别

ThreadLocal 只管当前线程自己的变量副本；InheritableThreadLocal 则在创建子线程时复制父线程变量。

## 关联页

- [ThreadLocal](ThreadLocal.md)
- [ThreadLocalMap](ThreadLocalMap.md)
- [ThreadLocal 改进方案](ThreadLocal%20改进方案.md)
