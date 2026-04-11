# WeakReference

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadLocalMap](ThreadLocalMap.md)

## 核心结论

弱引用的对象在发生垃圾回收时更容易被回收，ThreadLocalMap 的 key 之所以使用弱引用，就是为了减少 ThreadLocal 对象无法释放的问题。

## 入口

- 强引用
- 弱引用
- ThreadLocalMap 的 key
- 与内存泄漏的关系

## 强引用

强引用是最常见的引用方式，只要引用链还在，对象就不会被回收。

```java
Object value = new Object();
```

## 弱引用

弱引用不会阻止垃圾回收。只要 JVM 发现只有弱引用在指向对象，就可以在 GC 时把对象回收掉。

```java
WeakReference<Object> reference = new WeakReference<>(new Object());
```

## 和 ThreadLocalMap 的关系

ThreadLocalMap 的 Entry 继承了 WeakReference，key 是 ThreadLocal，value 是线程局部变量。这样做可以避免 ThreadLocal 对象本身一直被 Map 强引用住。

但是，value 仍然是强引用，所以如果线程长期存活又不及时 remove()，仍然可能出现内存泄露。

## 关联页

- [ThreadLocalMap](ThreadLocalMap.md)
- [ThreadLocal 内存泄露](ThreadLocal%20内存泄露.md)
