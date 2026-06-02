---
module: 并发编程
tags: [ThreadLocal, 内存泄漏, ThreadLocalMap, InheritableThreadLocal]
difficulty: hard
last_reviewed: 2026-06-01
---

## ThreadLocal

### 🌟ThreadLocal 是什么？
ThreadLocal 是一种用于实现线程局部变量的工具类。它允许每个线程都拥有自己的独立副本，从而实现线程隔离。

使用 ThreadLocal 通常分为四步：
①、创建 ThreadLocal
```java
// 创建一个ThreadLocal变量
public static ThreadLocal<String> localVariable = new ThreadLocal<>();
```
②、设置 ThreadLocal 的值
```java
// 设置ThreadLocal变量的值
localVariable.set("user-A");
```
③、获取 ThreadLocal 的值
```java
// 获取ThreadLocal变量的值
String value = localVariable.get();
```
④、删除 ThreadLocal 的值
```java
// 删除ThreadLocal变量的值
localVariable.remove();
```
在 Web 应用中,可以使用 ThreadLocal 存储用户会话信息，这样每个线程在处理用户请求时都能方便地访问当前用户的会话信息。
在数据库操作中，可以使用 ThreadLocal 存储数据库连接对象，每个线程有自己独立的数据库连接，从而避免了多线程竞争同一数据库连接的问题。
在格式化操作中，例如日期格式化，可以使用 ThreadLocal 存储 SimpleDateFormat 实例，避免多线程共享同一实例导致的线程安全问题。

#### ThreadLocal 有哪些优点？
每个线程访问的变量副本都是独立的，避免了共享变量引起的线程安全问题。由于 ThreadLocal 实现了变量的线程独占，使得变量不需要同步处理，因此能够避免资源竞争。
ThreadLocal 可用于跨方法、跨类时传递上下文数据，不需要在方法间传递参数。
 
### 你在工作中用到过 ThreadLocal 吗？
有用到过，用来存储用户信息。
技术派实战项目 是典型的 MVC 架构，登录后的用户每次访问接口，都会在请求头中携带一个 token，在控制层可以根据这个 token，解析出用户的基本信息。
假如在服务层和持久层也要用到用户信息，就可以在控制层拦截请求把用户信息存入 ThreadLocal。
这样我们在任何一个地方，都可以取出 ThreadLocal 中存的用户信息。
很多其它场景的 cookie、session 等等数据隔离都可以通过 ThreadLocal 去实现。

### 🌟ThreadLocal 怎么实现的呢？
当我们创建一个 ThreadLocal 对象并调用 set 方法时，其实是在当前线程中初始化了一个 ThreadLocalMap。

ThreadLocalMap 是 ThreadLocal 的一个静态内部类，它内部维护了一个 Entry 数组，key 是 ThreadLocal 对象，value 是线程的局部变量，这样就相当于为每个线程维护了一个变量副本。

Entry 继承了 WeakReference，限定了 key 是一个弱引用。 当外部的强引用断开，且**发生垃圾回收（GC）时**，JVM 会回收 ThreadLocal 对象，导致 Map 中出现 **Key 为 null 的废弃 Entry**。 由于 Value 是强引用且伴随线程同生共死，这**会导致内存泄漏**。 但正因为 Key 变成了 null，ThreadLocalMap 内部可以在后续调用 get/set 方法时，识别出这些 null Key，并主动将对应的 Value 置为 null 帮助 GC 清理。**不过，为了彻底避免内存泄漏，依然需要开发者手动调用 `remove()`。**
```java
static class Entry extends WeakReference<ThreadLocal<?>> {
	/** The value associated with this ThreadLocal. */
	Object value;

	// 节点类
	Entry(ThreadLocal<?> k, Object v) {
		// key赋值
		super(k);
		// value赋值
		value = v;
	}
}
```
总结一下：
ThreadLocal 的实现原理是，每个线程维护一个 Map，key 为 ThreadLocal 对象，value 为想要实现线程隔离的对象。
1、通过 ThreadLocal 的 set 方法将对象存入 Map 中。
2、通过 ThreadLocal 的 get 方法从 Map 中取出对象。
3、Map 的大小由 ThreadLocal 对象的多少决定。


#### 什么是弱引用，什么是强引用？
我先说一下强引用，比如 User user = new User("Tom") 中，user 就是一个强引用， new User("Tom") 就是强引用对象。
当 user 被置为 null 时（ user = null ）， new User("Tom") 对象就会被垃圾回收；否则即便是内存空间不足，JVM 也不会回收 new User("Tom") 这个强引用对象，宁愿抛出OutOfMemoryError。
弱引用，比如说在使用 ThreadLocal 中，Entry 的 key 就是一个弱引用对象。
```java
ThreadLocal<User> userThreadLocal = new ThreadLocal<>();
userThreadLocal.set(new User("Tom"));
```
userThreadLocal 是一个强引用， new ThreadLocal<>() 是一个强引用对象；
new User("Tom") 是一个强引用对象。
调用 set 方法后，会将 key = new ThreadLocal<>() 放入 ThreadLocalMap 中，此时的 key 是一个弱引用对象。当 JVM 进行垃圾回收时，如果发现了弱引用对象，就会将其回收。
 
其关系链就是：
ThreadLocal 强引用 -> ThreadLocal 对象。
Thread 强引用 -> ThreadLocalMap。
ThreadLocalMap[i] 强引用了 -> Entry。
Entry.key 弱引用 -> ThreadLocal 对象。
Entry.value 强引用 -> 线程的局部变量对象。

### 🌟ThreadLocal 内存泄露是怎么回事？
ThreadLocalMap 的 Key 是 弱引用，但 Value 是强引用。
如果一个线程一直在运行，并且 value 一直指向某个强引用对象，那么这个对象就不会被回收，从而导致内存泄漏。
 
#### 那怎么解决内存泄漏问题呢？

> [!warning] 必须在 finally 中调用 remove()
> Key 是弱引用会被 GC 回收，但 Value 是强引用，线程不终止就不会释放。线程池场景下线程复用，泄漏尤为严重。

很简单，使用完 ThreadLocal 后，及时调用 remove() 方法释放内存空间。
```java
try {
	threadLocal.set(value);
	// 执行业务操作
} finally {
	threadLocal.remove(); // 确保能够执行清理
}
```
remove() 会调用 ThreadLocalMap 的 remove 方法遍历哈希表，找到 key 等于当前 ThreadLocal 的 Entry，找到后会调用 Entry 的 clear 方法，将 Entry 的 value 设置为 null。
```java
private void remove(ThreadLocal<?> key) {
	Entry[] tab = table;
	int len = tab.length;
	// 计算 key 的 hash 值
	int i = key.threadLocalHashCode & (len - 1);
	// 遍历数组，找到 key 为 null 的 Entry
	for (Entry e = tab[i];
		 e != null;
		 e = tab[i = nextIndex(i, len)]) {
		if (e.get() == key) {
			// 将该 Entry 的 key 置为 null（即 Entry 失效）
			e.clear();
			// 清理过期的 entry
			expungeStaleEntry(i);
			return;
		}
	}
}

public void clear() {
	this.referent = null;
}
```
然后执行 expungeStaleEntry() 方法，清除 key 为 null 的 Entry。

#### 那为什么 key 要设计成弱引用？
弱引用的好处是，当内存不足的时候，JVM 能够及时回收掉弱引用的对象。
比如说：
```java
WeakReference key = new WeakReference(new ThreadLocal());
```
key 是弱引用， new WeakReference(new ThreadLocal()) 是弱引用对象，当 JVM 进行垃圾回收时，只要发现了弱引用对象，就会将其回收。
一旦 key 被回收，ThreadLocalMap 在进行 set、get 的时候就会对 key 为 null 的 Entry 进行清理。
总结一下，在 ThreadLocal 被垃圾收集后，下一次访问 ThreadLocalMap 时，Java 会自动清理那些键为 null 的 entry，这个过程会在执行 get() 、 set() 、 remove() 时触发。

#### 你了解哪些 ThreadLocal 的改进方案？
在 JDK 20 Early-Access Build 28 版本中，出现了 ThreadLocal 的改进方案，即 ScopedValue 。
还有 Netty 中的 FastThreadLocal，它是 Netty 对 ThreadLocal 的优化，内部维护了一个索引常量 index，每次创建 FastThreadLocal 中都会自动+1，用来取代 hash 冲突带来的损耗，用空间换时间。
```java
private final int index;

public FastThreadLocal() {
	index = InternalThreadLocalMap.nextVariableIndex();
}

public static int nextVariableIndex() {
	int index = nextIndex.getAndIncrement();
	if (index < 0) {
		nextIndex.decrementAndGet();
	}
	return index;
}
```
以及阿里的 TransmittableThreadLocal，不仅实现了子线程可以继承父线程 ThreadLocal 的功能，并且还可以跨线程池传递值。
```java
TransmittableThreadLocal<String> context = new TransmittableThreadLocal<>();

// 在父线程中设置
context.set("value-set-in-parent");

// 在子线程中可以读取，值是"value-set-in-parent"
String value = context.get();
```

### ThreadLocalMap 的源码看过吗？
有研究过。
ThreadLocalMap 虽然被叫做 Map，但它并没有实现 Map 接口，是一个简单的线性探测哈希表。
```java
static class ThreadLocalMap {
	static class Entry extends WeakReference<ThreadLocal<?>> {
		Object value;

		Entry(ThreadLocal<?> k, Object v) {
			super(k); // 这里的 Key 是 WeakReference
			value = v;
		}
	}

	private Entry[] table; // 存储 ThreadLocal 变量的数组
	private int size; // 当前 Entry 数量
	private int threshold; // 触发扩容的阈值
}
```
底层的数据结构也是数组，数组中的每个元素是一个 Entry 对象，Entry 对象继承了 WeakReference，key 是 ThreadLocal 对象，value 是线程的局部变量。

当调用 ThreadLocal.set(value) 时，会将 value 存入 ThreadLocalMap。
```java
public void set(T value) {
	Thread t = Thread.currentThread();
	ThreadLocalMap map = getMap(t);
	if (map != null) {
		map.set(this, value);
	} else {
		createMap(t, value);
	}
}
```
set() 方法是 ThreadLocalMap 的核心方法，通过 key 的哈希码与数组长度取模，计算出 key 在数组中的位置，这一点和 HashMap 的实现类似。
```java
private void set(ThreadLocal<?> key, Object value) {
	Entry[] tab = table;
	int len = tab.length;
	int i = key.threadLocalHashCode & (len - 1); // 计算索引

	for (Entry e = tab[i]; e != null; e = tab[nextIndex(i, len)]) {
		ThreadLocal<?> k = e.get();
		if (k == key) { // 如果 key 已存在，更新 value
			e.value = value;
			return;
		}
		if (k == null) { // Key 为 null，清理无效 Entry
			replaceStaleEntry(key, value, i);
			return;
		}
	}

	tab[i] = new Entry(key, value); // 直接插入 Entry
	size++;
	if (size >= threshold) {
		rehash();
	}
}
```
threadLocalHashCode 的计算有点东西，每创建一个 ThreadLocal 对象，它就会新增一个 黄金分割数 ，可以让哈希码 分布的非常均匀 。
```java
private static final int HASH_INCREMENT = 0x61c88647;

private static int nextHashCode() {
	return nextHashCode.getAndAdd(HASH_INCREMENT);
}
```
当调用 ThreadLocal.get() 时，会调用 ThreadLocalMap 的 getEntry() 方法，根据 key 的哈希码找到对应的线程局部变量。
```java
private Entry getEntry(ThreadLocal<?> key) {
	int i = key.threadLocalHashCode & (table.length - 1);
	Entry e = table[i];

	if (e != null && e.get() == key) { // 如果 key 存在，直接返回
		return e;
	} else {
		return getEntryAfterMiss(key, i, e); // 继续查找
	}
}
```
当调用 ThreadLocal.remove() 时，会调用 ThreadLocalMap 的 remove() 方法，根据 key 的哈希码找到对应的线程局部变量，将其清除，防止内存泄漏。
```java
private void remove(ThreadLocal<?> key) {
	Entry[] tab = table;
	int len = tab.length;
	int i = key.threadLocalHashCode & (len - 1);

	for (Entry e = tab[i]; e != null; e = tab[nextIndex(i, len)]) {
		if (e.get() == key) {
			e.clear(); // 清除 WeakReference
			e.value = null; // 释放 Value
			expungeStaleEntries();
			return;
		}
	}
}
```


### ThreadLocalMap 怎么解决 Hash 冲突的？
开放定址法 。
如果计算得到的槽位 i 已经被占用，ThreadLocalMap 会采用开放地址法中的线性探测来寻找下一个空闲槽位：
如果 i 位置被占用，尝试 i+1。
如果 i+1 也被占用，继续探测 i+2，直到找到一个空位。
如果到达数组末尾，则回到数组头部，继续寻找空位。
```java
private static int nextIndex(int i, int len) {
	return ((i + 1 < len) ? i + 1 : 0);
}
```

#### 为什么要用线性探测法而不是HashMap 的拉链法来解决哈希冲突？
ThreadLocalMap 设计的目的是存储线程私有数据，不会有大量的 Key，所以采用线性探测更节省空间。
拉链法还需要单独维护一个链表，甚至[[HashMap核心原理#你对红黑树了解多少？|红黑树]]，不适合 ThreadLocal 这种场景。

#### 开放地址法了解吗？
简单来说，就是这个坑被人占了，那就接着去找空着的坑。
如果我们插入一个 value=27 的数据，通过 hash 计算后应该落入第 4 个槽位，而槽位 4 已经有数据了，而且 key 和当前的不等。
此时就会线性向后查找，一直找到 Entry 为 null 的槽位才会停止。

### ThreadLocalMap 扩容机制了解吗？
了解。
与 HashMap 不同，ThreadLocalMap 并不会直接在元素数量达到阈值时立即扩容，而是先清理被 GC 回收的 key，然后在填充率达到四分之三时进行扩容。
```java
private void rehash() {
	// 清理被 GC 回收的 key
	expungeStaleEntries();

	// 扩容
	if (size >= threshold - threshold / 4)
		resize();
}
```
清理过程会遍历整个数组，将 key 为 null 的 Entry 清除。
```java
private void expungeStaleEntries() {
	Entry[] tab = table;
	int len = tab.length;
	for (int j = 0; j < len; j++) {
		Entry e = tab[j];
		// 如果 key 为 null，清理 Entry
		if (e != null && e.get() == null)
			expungeStaleEntry(j);
	}
}
```
阈值 threshold 的默认值是数组长度的三分之二。
```java
private void setThreshold(int len) {
	threshold = len * 2 / 3;
}
```
扩容时，会将数组长度翻倍，然后重新计算每个 Entry 的位置，采用线性探测法来寻找新的空位，然后将 Entry 放入新的数组中。
```java
private void resize() {
	Entry[] oldTab = table;
	int oldLen = oldTab.length;
	// 扩容为原来的两倍
	int newLen = oldLen * 2;
	Entry[] newTab = new Entry[newLen];

	int count = 0;
	// 遍历老数组
	for (int j = 0; j < oldLen; ++j) {
		Entry e = oldTab[j];
		if (e != null) {
			ThreadLocal<?> k = e.get();
			if (k == null) {
				e.value = null; // 释放 Value，防止内存泄漏
			} else {
				// 重新计算位置
				int h = k.threadLocalHashCode & (newLen - 1);
				while (newTab[h] != null) {
					// 线性探测寻找新位置
					h = nextIndex(h, newLen);
				}
				// 放入新数组
				newTab[h] = e;
				count++;
			}
		}
	}
	table = newTab;
	size = count;
	threshold = newLen * 2 / 3; // 重新计算扩容阈值
}
```
一句话总结：ThreadLocalMap 采用的是"先清理再扩容"的策略，扩容时，数组长度翻倍，并重新计算索引，如果发生哈希冲突，采用线性探测法来解决。

### 父线程能用 ThreadLocal 给子线程传值吗？
不能。
因为 ThreadLocal 变量存储在每个线程的 ThreadLocalMap 中，而子线程不会继承父线程的 ThreadLocalMap。
可以使用 InheritableThreadLocal 来解决这个问题。
子线程在创建的时候会拷贝父线程的 InheritableThreadLocal 变量。
来看一下使用示例：
```java
class InheritableThreadLocalExample {
	private static final InheritableThreadLocal<String> inheritableThreadLocal = new InheritableThreadLocal<>();

	public static void main(String[] args) {
		inheritableThreadLocal.set("父线程的值");

		new Thread(() -> {
			System.out.println("子线程获取的值：" + inheritableThreadLocal.get()); // 继承了父线程的值
		}).start();
	}
}
```

#### InheritableThreadLocal的原理了解吗？
了解。
在 Thread 类的定义中，每个线程都有两个 ThreadLocalMap：
```java
public class Thread {
	/* 普通 ThreadLocal 变量存储的地方 */
	ThreadLocal.ThreadLocalMap threadLocals = null;

	/* InheritableThreadLocal 变量存储的地方 */
	ThreadLocal.ThreadLocalMap inheritableThreadLocals = null;
}
```
普通 ThreadLocal 变量存储在 threadLocals 中，不会被子线程继承。
InheritableThreadLocal 变量存储在 inheritableThreadLocals 中，当 new Thread() 创建一个子线程时，Thread 的 init() 方法会检查父线程是否有 inheritableThreadLocals，如果有，就会拷贝 InheritableThreadLocal 变量到子线程：
```java
private void init(ThreadGroup g, Runnable target, String name, long stackSize) {
	// 获取当前父线程
	Thread parent = currentThread();
	// 复制 InheritableThreadLocal 变量
	if (parent.inheritableThreadLocals != null) {
		this.inheritableThreadLocals =
			ThreadLocal.createInheritedMap(parent.inheritableThreadLocals);
	}
}
```

## 相关链接
- [[并发基础概念]] — 线程安全基础
- [[线程基础与生命周期]] — 线程基础知识
- [[Java 内存模型]] — 线程可见性问题根源
- [[JVM 内存管理]] — 虚拟机栈与线程对应关系
- [[Spring 基础与 IoC]] — 单例Bean多线程安全隐患
