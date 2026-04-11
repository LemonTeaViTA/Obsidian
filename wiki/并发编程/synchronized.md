# synchronized

> 来源： [并发编程篇](../并发编程篇.md)
> 关联： [Java 内存模型](Java%20内存模型.md), [Lock](Lock.md), [ReentrantLock](ReentrantLock.md)

## 核心结论

synchronized 依赖 JVM 的 Monitor 机制，既能保证互斥，也能保证可见性和有序性。

## 入口

- monitorenter / monitorexit
- 对象锁和类锁
- 可重入
- 锁升级
- 可见性
- 有序性

## 实现方式

synchronized 可以修饰普通方法、静态方法和代码块。修饰普通方法时，锁的是当前对象实例；修饰静态方法时，锁的是类的 Class 对象；修饰代码块时，锁的是括号里指定的对象。

```java
public synchronized void increment() {
	this.count++;
}

public static synchronized void reset() {
	count = 0;
}

public void update() {
	synchronized (this) {
		this.count++;
	}
}
```

在字节码层面，`synchronized` 代码块会对应 `monitorenter` 和 `monitorexit` 指令。javap 反编译后的指令对照如下：

| 指令 | 作用 |
| :--- | :--- |
| `monitorenter` | 获取锁，进入同步代码块 |
| `iconst_1` | 将整数 1 压入操作数栈 |
| `istore_1` | 存储 1 到局部变量 |
| `monitorexit` | 释放锁，退出同步代码块 |

方法级别的同步则会在方法签名上标记 `ACC_SYNCHRONIZED`。

## Monitor

Monitor 是 JVM 内部的同步机制。对象头中的 Mark Word 会记录锁相关信息，HotSpot 中对应的实现是 ObjectMonitor。

```java
ObjectMonitor() {
	_count = 0;
	_owner = NULL;
	_WaitSet = NULL;
	_cxq = NULL;
	_EntryList = NULL;
}
```

`_owner` 表示当前持有锁的线程，`_count` 表示重入次数，`_WaitSet` 存放调用 `wait()` 后进入等待状态的线程，`_cxq` 是阻塞队列，用于存放刚进入 Monitor 竞争的线程，`_EntryList` 是竞争队列，存放处于 `BLOCKED` 状态等待获取锁的线程。

锁的流转大致是这样的：
1. 线程获取锁成功后，`_owner` 指向当前线程，`_count` 递增；
2. 同一个线程再次进入时会继续累加；
3. 线程退出同步块时会递减，直到 `_count` 归零后才真正释放锁。
4. 调用 `wait()` 的线程会释放锁并进入 `_WaitSet`，等待 `notify()`/`notifyAll()` 唤醒后，会被转移到 `_cxq` 或 `_EntryList` 重新竞争锁。

## 可见性

线程进入 synchronized 之前，需要先从主内存获取最新数据；线程退出 synchronized 之后，会把修改刷回主内存。因此，后续拿到同一把锁的线程能够看到最新结果。

## 有序性

synchronized 通过 monitorenter 和 monitorexit 约束临界区内的执行顺序，避免关键代码被重排到同步边界之外。

## 可重入

同一个线程可以反复获取同一把锁，底层依赖 Monitor 的 owner 和 count 记录重入状态。

```java
class ReentrantExample {
	public synchronized void method1() {
		System.out.println("Method1 acquired lock");
		method2();
	}

	public synchronized void method2() {
		System.out.println("Method2 acquired lock");
	}
}
```

## 锁升级

JDK 1.6 之后，synchronized 具备偏向锁、轻量级锁和重量级锁的升级路径。无竞争时尽量走低开销路径，竞争加剧后再升级到更重的锁。

## 和 Lock 的区别

synchronized 是 JVM 原生关键字，自动加锁和解锁；Lock 是 JUC 接口，需要手动 lock() 和 unlock()，通常也更灵活。

## 关联页

- [Java 内存模型](Java%20内存模型.md)
- [Lock](Lock.md)
- [ReentrantLock](ReentrantLock.md)
