# ThreadLocal 内存泄露

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [ThreadLocalMap](ThreadLocalMap.md), [WeakReference](WeakReference.md)

## 核心结论

ThreadLocalMap 的 key 是弱引用，但 value 是强引用；如果线程长期存活且不及时清理，就可能出现内存泄露。

## 入口

- key 是弱引用
- value 是强引用
- remove() 清理
- expungeStaleEntry()

## 关联页

- [ThreadLocalMap](ThreadLocalMap.md)
- [WeakReference](WeakReference.md)
