# volatile

> 来源： [并发编程篇](../并发编程篇.md)
> 关联： [Java 内存模型](Java%20内存模型.md), [synchronized](synchronized.md)

## 核心结论

volatile 主要解决可见性和有序性问题，不保证复合操作的原子性。

## 入口

- 可见性
- 有序性
- 读写屏障
- 与 synchronized 的区别
- 指令重排
- 基本类型和引用类型

## 核心作用

volatile 主要解决两个问题：让一个线程写入的最新值对其他线程可见，阻止与 volatile 变量相关的指令重排。它不保证复合操作的原子性，所以 count++ 这类操作仍然需要加锁或使用原子类。

## 可见性

线程写 volatile 变量时，JVM 会插入写屏障，把工作内存中的最新值刷新到主内存；线程读 volatile 变量时，会插入读屏障，确保从主内存读取最新值。

```java
private static volatile boolean flag = true;

public static void main(String[] args) {
	new Thread(() -> {
		while (flag) {
		}
		System.out.println("线程退出");
	}).start();

	flag = false;
}
```

## 有序性

volatile 通过内存屏障限制编译器和 CPU 的重排行为。它不能替代锁，但适合状态标记、单次发布、停止信号这类场景。

在底层实现上，volatile 的读写会插入相应的内存屏障。在一些讲解里，也会把它和 CPU 的 lock 指令联系起来理解，比如写操作需要先把缓存中的数据刷新到主内存，再让其他线程尽快看到最新值。

## 和 synchronized 的区别

volatile 只作用于变量，强调可见性和有序性；synchronized 作用于代码块或方法，强调互斥、可见性和有序性。

## 基本类型和引用类型

volatile 修饰基本类型时，保证变量读写的可见性。修饰引用类型时，只保证引用本身可见，不保证引用对象内部状态线程安全。

```java
private volatile SomeObject obj = new SomeObject();
```

## 关联页

- [Java 内存模型](Java%20内存模型.md)
- [synchronized](synchronized.md)
