---
module: 集合框架
tags: [集合, List, ArrayList, LinkedList]
difficulty: medium
last_reviewed: 2026-04-20
---

# List 体系

## ArrayList 与 LinkedList

### 🌟ArrayList 和 LinkedList 有什么区别？

ArrayList 是基于数组实现的，LinkedList 是基于链表实现的。
#### ArrayList 和 LinkedList 的用途有什么不同？
多数情况下，ArrayList 更利于查找，LinkedList 更利于增删。
1. 由于 ArrayList 是基于数组实现的，所以 `get(int index)` 可以直接通过数组下标获取，时间复杂度是 O(1)；LinkedList 是基于链表实现的，`get(int index)` 需要遍历链表，时间复杂度是 O(n)。
当然，`get(E element)` 这种查找，两种集合都需要遍历通过 `equals` 比较获取元素，所以时间复杂度都是 O(n)。
2. ArrayList 如果增删的是数组的尾部，时间复杂度是 O(1)；如果 add 的时候涉及到扩容，时间复杂度会上升到 O(n)。
但如果插入的是中间的位置，就需要把插入位置后的元素向前或者向后移动，甚至还有可能触发扩容，效率就会低很多，变成 O(n)。

LinkedList 因为是链表结构，插入和删除只需要改变前置节点、后置节点和插入节点的引用，因此不需要移动元素。
如果是在链表的头部插入或者删除，时间复杂度是 O(1)；如果是在链表的中间插入或者删除，时间复杂度是 O(n)，因为需要遍历链表找到插入位置；如果是在链表的尾部插入或者删除，时间复杂度是 O(1)。
#### ArrayList 和 LinkedList 是否支持随机访问？
1. ArrayList 是基于数组的，也实现了 `RandomAccess` 接口，所以它支持随机访问，可以通过下标直接获取元素。
2. LinkedList 是基于链表的，所以它没法根据下标直接获取元素，不支持随机访问。
#### ArrayList 和 LinkedList 内存占用有何不同？
ArrayList 是基于数组的，是一块连续的内存空间，所以它的内存占用是比较紧凑的；但如果涉及到扩容，就会重新分配内存，空间是原来的 1.5 倍。

LinkedList 是基于链表的，每个节点都有一个指向下一个节点和上一个节点的引用，于是每个节点占用的内存空间比 ArrayList 稍微大一点。
#### ArrayList 和 LinkedList 的使用场景有什么不同？
**ArrayList 适用于：**
- 随机访问频繁：需要频繁通过索引访问元素的场景。
- 读取操作远多于写入操作：如存储不经常改变的列表。
- 末尾添加元素：需要频繁在列表末尾添加元素的场景。

**LinkedList 适用于：**
- 频繁插入和删除：在列表中间频繁插入和删除元素的场景。
- 不需要快速随机访问：顺序访问多于随机访问的场景。
- 队列和栈：由于其双向链表的特性，LinkedList 可以实现队列（FIFO）和栈（LIFO）。
#### 链表和数组有什么区别？
- 数组在内存中占用的是一块连续的存储空间，因此我们可以通过数组下标快速访问任意元素。数组在创建时必须指定大小，一旦分配内存，数组的大小就固定了。
- 链表的元素存储在于内存中的任意位置，每个节点通过指针指向下一个节点。
### ArrayList 的扩容机制了解吗？

当往 ArrayList 中添加元素时，会先检查是否需要扩容，如果当前容量+1 超过数组长度，就会进行扩容。
扩容后的新数组长度是原来的 1.5 倍，然后再把原数组的值拷贝到新数组中。

```java
private void grow(int minCapacity) {
    // overflow-conscious code
    int oldCapacity = elementData.length;
    int newCapacity = oldCapacity + (oldCapacity >> 1);
    if (newCapacity - minCapacity < 0)
        newCapacity = minCapacity;
    if (newCapacity - MAX_ARRAY_SIZE > 0)
        newCapacity = hugeCapacity(minCapacity);
    // minCapacity is usually close to size, so this is a win:
    elementData = Arrays.copyOf(elementData, newCapacity);
}
```

### ArrayList 怎么序列化的知道吗？

`ArrayList` 通过以下两步实现了高效的自定义序列化：
1. **`transient` 阻断**：因为底层 `elementData` 数组通常存在冗余容量，为了不序列化多余的 `null`，该数组被 `transient` 修饰，屏蔽了 Java 的自动全量序列化。
2. **`writeObject` 重写**：通过重写 `writeObject` 方法，系统利用实际的 `size` 变量精确控制循环，仅将实际存在的“有效数据”写入流中，极大节省了空间和时间。

#### 为什么 ArrayList 不直接序列化元素数组呢？

出于效率的考虑，数组可能长度 100，但实际只用了 50，剩下的 50 没用到，也就不需要序列化。

```java
private void writeObject(java.io.ObjectOutputStream s) throws java.io.IOException {
    // 将当前 ArrayList 的结构进行序列化
    int expectedModCount = modCount;
    s.defaultWriteObject(); // 序列化非 transient 字段
    // 序列化数组的大小
    s.writeInt(size);
    // 序列化每个元素
    for (int i = 0; i < size; i++) {
        s.writeObject(elementData[i]);
    }
    // 检查是否在序列化期间发生了并发修改
    if (modCount != expectedModCount) {
        throw new ConcurrentModificationException();
    }
}
```

---
### 快速失败 fail-fast 了解吗？

`fail-fast` 是 Java 集合的一种错误检测机制。

在用迭代器遍历集合对象时，如果线程 A 遍历过程中，线程 B 对集合对象的内容进行了修改，就会抛出 `ConcurrentModificationException`。

迭代器在遍历时直接访问集合中的内容，并且在遍历过程中使用一个 `modCount` 变量。集合在被遍历期间如果内容发生变化，就会改变 `modCount` 的值。每当迭代器使用 `hasNext()`/`next()` 遍历下一个元素之前，都会检测 `modCount` 变量是否为 `expectedmodCount` 值，是的话就返回遍历；否则抛出异常，终止遍历。

异常的抛出条件是检测到 `modCount != expectedmodCount` 这个条件。如果集合发生变化时修改 `modCount` 值刚好又设置为了 `expectedmodCount` 值，则异常不会抛出。因此，不能依赖于这个异常是否抛出而进行并发操作的编程，这个异常只建议用于检测并发修改的 bug。

`java.util` 包下的集合类都是快速失败的，不能在多线程下发生并发修改（迭代过程中被修改），比如 `ArrayList` 类。

#### 什么是安全失败（fail-safe）呢？

采用安全失败机制的集合容器，在遍历时不是直接在集合内容上访问的，而是先复制原有集合内容，在拷贝的集合上进行遍历。

- **原理**：由于迭代时是对原集合的拷贝进行遍历，所以在遍历过程中对原集合所作的修改并不能被迭代器检测到，所以不会触发 `ConcurrentModificationException`。
- **缺点**：基于拷贝内容的优点是避免了 `ConcurrentModificationException`，但同样地，迭代器并不能访问到修改后的内容，即：迭代器遍历的是开始遍历那一刻拿到的集合拷贝，在遍历期间原集合发生的修改迭代器是不知道的。
- **场景**：`java.util.concurrent` 包下的容器都是安全失败，可以在多线程下并发使用，并发修改，比如 `CopyOnWriteArrayList` 类。

---

## 线程安全

### 有哪几种实现 ArrayList 线程安全的方法？ 

常用的有两种。

1. 可以使用 `Collections.synchronizedList()` 方法，它可以返回一个线程安全的 List。 
```java
SynchronizedList list = Collections.synchronizedList(new ArrayList());
```
内部是通过 `synchronized` 关键字加锁来实现的。

2. 也可以直接使用 `CopyOnWriteArrayList`，它是线程安全的 ArrayList，遵循写时复制的原则，每当对列表进行修改时，都会创建一个新副本，这个新副本会替换旧的列表，而对旧列表的所有读取操作仍然在原有的列表上进行。 
```java
CopyOnWriteArrayList list = new CopyOnWriteArrayList();
```
通俗的讲，CopyOnWrite 就是当我们往一个容器添加元素的时候，不直接往容器中添加，而是先复制出一个新的容器，然后在新的容器里添加元素，添加完之后，再将原容器的引用指向新的容器。多个线程在读的时候，不需要加锁，因为当前容器不会添加任何元素。这样就实现了线程安全。

#### ArrayList 和 Vector 的区别？ 
- `Vector` 属于 JDK 1.0 时期的遗留类，不推荐使用，仍然保留着是因为 Java 希望向后兼容。
- `ArrayList` 是在 JDK 1.2 时引入的，用于替代 Vector 作为主要的非同步动态数组实现。因为 `Vector` 所有的方法都使用了 `synchronized` 关键字进行同步，所以单线程环境下效率较低。

---

### CopyOnWriteArrayList 了解多少？ 

`CopyOnWriteArrayList` 是一种基于**写时复制**策略的并发容器。它的核心思想是读写分离：读操作是完全无锁的，直接读取当前底层的数组；而写操作内部会加锁（`ReentrantLock` 或 `synchronized`），先拷贝出一个新数组，在新数组上修改后，再将底层引用指向新数组。

这种设计的**优点**是极大地提高了并发读的性能。但**缺点**也很明显：一是每次写都要复制数组，极其消耗内存并容易引发频繁 GC；二是它只能保证数据的最终一致性，无法保证实时一致性（读线程可能会读到旧数据）。因此，它非常适合应用在**读多写少**的场景中，比如系统的白名单缓存或者事件监听器列表。
## 相关链接

- [[集合框架概述]] — 集合框架整体结构
- [[HashMap核心原理]] — Map 与 List 的使用场景对比
- [[锁]] — CopyOnWriteArrayList 使用 ReentrantLock 实现线程安全
- [[线程基础与ThreadLocal]] — ArrayList 非线程安全，多线程需用 CopyOnWriteArrayList
