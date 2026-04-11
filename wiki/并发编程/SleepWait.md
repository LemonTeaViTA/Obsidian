# SleepWait

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [synchronized](synchronized.md), [Lock](Lock.md)

## 核心结论

sleep() 和 wait() 都能让线程暂停，但它们的所属类、锁行为、使用条件和唤醒方式都不同。

## 入口

- sleep()
- wait()
- 锁行为
- 唤醒方式
- TIMED_WAITING / WAITING

## 主要区别

- sleep() 是 Thread 的方法，wait() 是 Object 的方法。
- sleep() 不会释放锁，wait() 会释放当前对象锁。
- sleep() 可以在任何地方调用，wait() 必须在同步代码块或同步方法中调用。
- sleep() 到时间后自动恢复，wait() 需要 notify()/notifyAll() 唤醒。

如果在没有持有对象锁的情况下直接调用 wait()，会抛出 IllegalMonitorStateException 异常。

关于唤醒状态的转换：`sleep()` 过后或者 `wait()` 被唤醒后，线程不会立刻执行，而是从 `TIMED_WAITING` 或 `WAITING` 状态转换为 `RUNNABLE`（又或者如果是等待锁则可能进入 `BLOCKED`），并加入到 CPU 的调度队列中。

## 代码演示差异

以下通过两个代码示例展示 `sleep()` 和 `wait()` 在锁释放行为上的不同：

```java
// Demo 1: sleep 不释放锁
class SleepDoesNotReleaseLock {
    private static final Object lock = new Object();
    public static void main(String[] args) throws InterruptedException {
        Thread sleepingThread = new Thread(() -> {
            synchronized (lock) {
                System.out.println("Thread 1 睡眠并继续持有锁");
                try { Thread.sleep(5000); } catch (Exception e) {}
                System.out.println("Thread 1 醒来并释放锁");
            }
        });
        Thread waitingThread = new Thread(() -> {
            synchronized (lock) {
                System.out.println("Thread 2 进入同步块");
            }
        });
        sleepingThread.start();
        Thread.sleep(1000); // 确保 Thread 1 先拿到锁
        waitingThread.start(); 
        // 结果: Thread 2 必须等待 Thread 1 睡眠结束才能执行
    }
}
```

```java
// Demo 2: wait 释放锁
class WaitReleasesLock {
    private static final Object lock = new Object();
    public static void main(String[] args) throws InterruptedException {
        Thread waitingThread = new Thread(() -> {
            synchronized (lock) {
                try {
                    System.out.println("Thread 1 准备等待，释放锁");
                    lock.wait(5000);
                    System.out.println("Thread 1 重新唤醒并退出同步块");
                } catch (Exception e) {}
            }
        });
        Thread notifyingThread = new Thread(() -> {
            synchronized (lock) {
                System.out.println("Thread 2 拿到锁，并尝试唤醒等待线程");
                lock.notify();
            }
        });
        waitingThread.start();
        Thread.sleep(1000); // 确保 Thread 1 先拿到锁进入 wait
        notifyingThread.start();
        // 结果: Thread 1 wait 时立刻释放锁，Thread 2 得以执行并执行 notify。
    }
}
```

## 使用场景

sleep() 常用于暂停一段时间；wait() 常用于线程间协作，比如生产者-消费者。

## 关联页

- [synchronized](synchronized.md)
- [Lock](Lock.md)
