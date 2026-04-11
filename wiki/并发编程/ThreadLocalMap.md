# ThreadLocalMap

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadLocal](ThreadLocal.md), [WeakReference](WeakReference.md), [ThreadLocal 内存泄露](ThreadLocal%20内存泄露.md), [InheritableThreadLocal](InheritableThreadLocal.md)

## 核心结论

ThreadLocalMap 是每个线程内部持有的映射结构，key 是 ThreadLocal，value 是线程私有数据。

## 源码结构

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

## set / get / remove

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

threadLocalHashCode 的计算有点东西，每创建一个 ThreadLocal 对象，它就会新增一个黄金分割数，可以让哈希码分布得非常均匀。

```java
private static final int HASH_INCREMENT = 0x61c88647;

private static int nextHashCode() {
	return nextHashCode.getAndAdd(HASH_INCREMENT);
}
```

这个常量 `0x61c88647` 也叫黄金分割数，它能让 ThreadLocal 的 hash 值分布更均匀，减少连续槽位冲突。

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

## 哈希冲突

开放定址法。

如果计算得到的槽位 i 已经被占用，ThreadLocalMap 会采用开放地址法中的线性探测来寻找下一个空闲槽位。

```java
private static int nextIndex(int i, int len) {
	return ((i + 1 < len) ? i + 1 : 0);
}
```

### 为什么要用线性探测法而不是HashMap 的拉链法来解决哈希冲突？

ThreadLocalMap 设计的目的是存储线程私有数据，不会有大量的 Key，所以采用线性探测更节省空间。
拉链法还需要单独维护一个链表，甚至红黑树，不适合 ThreadLocal 这种场景。

### 开放地址法了解吗？

简单来说，就是这个坑被人占了，那就接着去找空着的坑。

如果我们插入一个 value=27 的数据，通过 hash 计算后应该落入第 4 个槽位，而槽位 4 已经有数据了，而且 key 和当前的不等。
此时就会线性向后查找，一直找到 Entry 为 null 的槽位才会停止。

## 扩容机制

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

一句话总结：ThreadLocalMap 采用的是“先清理再扩容”的策略，扩容时，数组长度翻倍，并重新计算索引，如果发生哈希冲突，采用线性探测法来解决。

## 弱引用与泄露

Entry 继承了 WeakReference，它限定了 key 是一个弱引用，弱引用的好处是当内存不足时，JVM 会回收 ThreadLocal 对象，并且将其对应的 Entry.value 设置为 null，这样可以在很大程度上避免内存泄漏。

### 什么是弱引用，什么是强引用？

我先说一下强引用，比如 User user = new User("沉默王二") 中，user 就是一个强引用， new User("沉默王二") 就是强引用对象。
当 user 被置为 null 时（ user = null ）， new User("沉默王二") 对象就会被垃圾回收；否则即便是内存空间不足，JVM 也不会回收 new User("沉默王二") 这个强引用对象，宁愿抛出 OutOfMemoryError。

弱引用，比如说在使用 ThreadLocal 中，Entry 的 key 就是一个弱引用对象。

```java
ThreadLocal<User> userThreadLocal = new ThreadLocal<>();
userThreadLocal.set(new User("沉默王二"));
```

userThreadLocal 是一个强引用， new ThreadLocal<>() 是一个强引用对象； new User("沉默王二") 是一个强引用对象。
调用 set 方法后，会将 key = new ThreadLocal<>() 放入 ThreadLocalMap 中，此时的 key 是一个弱引用对象。当 JVM 进行垃圾回收时，如果发现了弱引用对象，就会将其回收。

其关系链就是：

- ThreadLocal 强引用 -> ThreadLocal 对象。
- Thread 强引用 -> ThreadLocalMap。
- ThreadLocalMap[i] 强引用了 -> Entry。
- Entry.key 弱引用 -> ThreadLocal 对象。
- Entry.value 强引用 -> 线程的局部变量对象。

### ThreadLocal 内存泄露是怎么回事？

ThreadLocalMap 的 Key 是弱引用，但 Value 是强引用。
如果一个线程一直在运行，并且 value 一直指向某个强引用对象，那么这个对象就不会被回收，从而导致内存泄漏。

### 那怎么解决内存泄漏问题呢？

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
	int i = key.threadLocalHashCode & (len - 1);

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

## 父子线程传值

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

### InheritableThreadLocal 的原理了解吗？

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
InheritableThreadLocal 变量存储在 inheritableThreadLocals 中，当 new Thread() 创建一个子线程时，Thread 的 init() 方法会检查父线程是否有 inheritableThreadLocals，如果有，就会拷贝 InheritableThreadLocal 变量到子线程。

## 关联页

- [ThreadLocal](ThreadLocal.md)
- [WeakReference](WeakReference.md)
- [ThreadLocal 内存泄露](ThreadLocal%20内存泄露.md)
- [InheritableThreadLocal](InheritableThreadLocal.md)
