# ThreadSafety

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [synchronized](synchronized.md), [Lock](Lock.md), [AtomicInteger](AtomicInteger.md), [ThreadLocal](ThreadLocal.md), [ConcurrentHashMap](ConcurrentHashMap.md), [CopyOnWriteArrayList](CopyOnWriteArrayList.md)

## 核心结论

线程安全是指程序在多线程并发访问时仍能保持正确结果，不出现数据错乱。可以从三个要素来确保线程安全：

- **原子性**：一个操作要么完全执行，要么完全不执行，不会出现中间状态。
- **可见性**：当一个线程修改了共享变量，其他线程能够立即看到变化。
- **有序性**：要确保线程不会因为死锁、饥饿、活锁等问题导致无法继续执行。

## 入口

- synchronized
- volatile
- Atomic
- ThreadLocal
- 并发容器
- Lock

## 保证方式

- 使用 synchronized 保护临界区。
- 使用 Lock 提供更灵活的互斥控制。
- 使用 volatile 保证可见性。例如：`private volatile String itwanger = "沉默王二";`
- 使用 Atomic 原子类处理简单原子操作。例如：`AtomicInteger count = new AtomicInteger(0); count.incrementAndGet();`
- 使用 ThreadLocal 做线程隔离。
- 使用并发容器管理共享数据。

## 竞态示例

有个 int 的变量为 0，十个线程轮流对其进行++操作（循环10000次），最终结果通常会小于预期值（10万）。原因是 `count++` 不是原子操作，它会拆成读取旧值、加 1、写回新值三个步骤。

如果在代码中，线程 1 读取变量值为 0，线程 2 也读取变量值为 0。线程 1 进行加法运算并将结果 1 写回，然后线程 2 进行同样操作并将结果 1 写回，就会覆盖线程 1 的结果，导致丢失更新。

可以通过 `synchronized` 或者 `AtomicInteger` 来解决这个问题：

```java
class Main {
    private static int count = 0;

    public static void main(String[] args) throws InterruptedException {
        Runnable task = () -> {
            for (int i = 0; i < 10000; i++) {
                synchronized (Main.class) { // 或使用 AtomicInteger 及 incrementAndGet()
                    count++;
                }
            }
        };

        List<Thread> threads = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            Thread thread = new Thread(task);
            threads.add(thread);
            thread.start();
        }

        for (Thread thread : threads) {
            thread.join();
        }
        
        System.out.println("count：" + count);
    }
}
```

## 关联页

- [synchronized](synchronized.md)
- [Lock](Lock.md)
- [AtomicInteger](AtomicInteger.md)
- [ThreadLocal](ThreadLocal.md)
- [ConcurrentHashMap](ConcurrentHashMap.md)
- [CopyOnWriteArrayList](CopyOnWriteArrayList.md)
