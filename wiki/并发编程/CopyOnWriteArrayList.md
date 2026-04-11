# CopyOnWriteArrayList

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [BlockingQueue](BlockingQueue.md)

## 核心结论

CopyOnWriteArrayList 是 ArrayList 的线程安全版本，适合读多写少的场景。

## 入口

- Copy On Write
- volatile 数组
- ReentrantLock
- 读无锁
- 写复制

## 核心思想

写入时先复制一份新数组，在新数组上修改，最后把引用替换掉原数组。这样读线程始终读到的是稳定快照。

```java
private transient volatile Object[] array;
```

## 写入流程

写操作会先拿锁，再复制数组并追加元素，最后替换引用。

```java
public boolean add(E e) {
	final ReentrantLock lock = this.lock;
	lock.lock();
	try {
		Object[] elements = getArray();
		Object[] newElements = Arrays.copyOf(elements, elements.length + 1);
		newElements[elements.length] = e;
		setArray(newElements);
		return true;
	} finally {
		lock.unlock();
	}
}
```

## 适用场景

适合读远多于写的场景，比如配置列表、白名单、订阅列表。

## 缺点

写操作需要复制整个数组，数组越大，写入成本越高，内存占用也更大。

另外它读取的是快照，读线程看到的可能是旧数组，因此它更偏向最终一致性，不适合对实时一致性要求很高的写密集场景。

## 关联页

- [BlockingQueue](BlockingQueue.md)
- [ConcurrentHashMap](ConcurrentHashMap.md)
