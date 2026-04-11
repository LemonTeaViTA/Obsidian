# Exchanger

> 来源： [并发编程篇](../并发编程篇.md)
> 相关： [CountDownLatch](CountDownLatch.md), [Semaphore](Semaphore.md)

## 核心结论

Exchanger 是一个线程间数据交换器，适合两个线程在同步点互换各自持有的数据。

## 入口

- exchange()
- 两个线程
- 数据交换
- 同步点
- 先到先等

## 基本用法

两个线程都调用 exchange()，先到的线程会阻塞，等另一个线程到达后完成数据交换。

```java
Exchanger<String> exchanger = new Exchanger<>();
String result = exchanger.exchange("A");
```

```java
class ExchangerExample {
	private static final Exchanger<String> exchanger = new Exchanger<>();

	public static void main(String[] args) {
		new Thread(() -> {
			try {
				String dataA = "数据 A";
				String received = exchanger.exchange(dataA);
				System.out.println("线程 A 收到：" + received);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			}
		}).start();

		new Thread(() -> {
			try {
				String dataB = "数据 B";
				String received = exchanger.exchange(dataB);
				System.out.println("线程 B 收到：" + received);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			}
		}).start();
	}
}
```

## 使用场景

它适合成对交换数据的场景，比如双缓冲、遗传算法、对账、双份录入校验。

## 核心理解

它不是普通队列，也不是广播工具，而是两两配对的“交换点”。两边都到场，才能完成交换。

它也常用于双份数据校验场景，比如两人分别录入同一批数据，然后在交换点比较两份结果是否一致。

## 关联页

- [CountDownLatch](CountDownLatch.md)
- [Semaphore](Semaphore.md)
