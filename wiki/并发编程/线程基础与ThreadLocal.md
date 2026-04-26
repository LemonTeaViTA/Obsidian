---
module: 并发编程
tags: [并发, 线程, ThreadLocal]
difficulty: medium
last_reviewed: 2026-04-20
---

# 线程基础与ThreadLocal

## 并发基础概念

### 并行跟并发有什么区别？

 并行是多核 CPU 上的多任务处理，多个任务在同一时间真正地同时执行。
 并发是单核 CPU 上的多任务处理，多个任务在同一时间段内交替执行，通过时间片轮转实现交替执行，用于解决 IO 密集型任务的瓶颈。


 举个例子，就好像我们去食堂打饭，并行就是每个人对应一个阿姨，同时打饭；而并发就是一个阿姨，轮流给每个人打饭，假如有个人磨磨唧唧，阿姨就会吆喝下一个人，这样就能提高食堂的打饭效率。


#### 你是如何理解线程安全的？
 如果一段代码块或者一个方法被多个线程同时执行，还能够正确地处理共享数据，那么这段代码块或者这个方法就是线程安全的。
 可以从三个要素来确保线程安全：
 ①、原子性 ：一个操作要么完全执行，要么完全不执行，不会出现中间状态。

 可以通过同步关键字 synchronized 或原子操作，如 AtomicInteger 来保证原子性。
```java
AtomicInteger count = new AtomicInteger(0);
count.incrementAndGet(); // 原子操作
```
 ②、可见性 ：当一个线程修改了共享变量，其他线程能够立即看到变化。

 可以通过 volatile 关键字来保证可见性。
```java
private volatile String itwanger = "沉默王二";
```
 ③、有序性 ：程序的执行顺序按照代码的先后顺序执行，在多线程环境下，需要保证指令不会因为 JVM 的指令重排序而导致执行顺序与预期不符。








### 🌟说说进程和线程的区别？
 进程说简单点就是我们在电脑上启动的一个个应用。它是操作系统分配资源的最小单位。
 线程是进程中的独立执行单元。多个线程可以共享同一个进程的资源，如内存；每个线程都有自己独立的栈和寄存器。


#### 如何理解协程？
 协程被视为比线程更轻量级的并发单元，可以在单线程中实现并发执行，由我们开发者显式调度。
 协程是在用户态进行调度的，避免了线程切换时的内核态开销。
 Java 自身是不支持协程的，我们可以使用 Quasar、Kotlin 等框架来实现协程。
```kotlin
fun main() = runBlocking {
	launch {
		delay(1000L)
		println("World!")
	}
	println("Hello,")
}
```


#### 线程间是如何进行通信的？
 原则上可以通过消息传递和共享内存两种方法来实现。Java 采用的是共享内存的并发模型。
 这个模型被称为 Java 内存模型，简写为 JMM，它决定了一个线程对共享变量的写入，何时对另外一个线程可见。当然了，本地内存是 JMM 的一个抽象概念，并不真实存在。
 用一句话来概括就是：共享变量存储在主内存中，每个线程的私有本地内存，存储的是这个共享变量的副本。

 线程 A 与线程 B 之间如要通信，需要要经历 2 个步骤：

 线程 A 把本地内存 A 中的共享变量副本刷新到主内存中。
 线程 B 到主内存中读取线程 A 刷新过的共享变量，再同步到自己的共享变量副本中。



## 线程基础

### 🌟说说线程有几种创建方式？
 有三种，分别是继承 Thread 类、实现 Runnable 接口、实现 Callable 接口。

 第一种需要重写父类 Thread 的 run() 方法，并且调用 start() 方法启动线程。
```java
class ThreadTask extends Thread {
	public void run() {
		System.out.println("看完二哥的 Java 进阶之路，上岸了!");
	}

	public static void main(String[] args) {
		ThreadTask task = new ThreadTask();
		task.start();
	}
}
```
 这种方法的缺点是，如果 ThreadTask 已经继承了另外一个类，就不能再继承 Thread 类了，因为 Java 不支持多重继承。
 第二种需要重写 Runnable 接口的 run() 方法，并将实现类的对象作为参数传递给 Thread 对象的构造方法，最后调用 start() 方法启动线程。
```java
class RunnableTask implements Runnable {
	public void run() {
		System.out.println("看完二哥的 Java 进阶之路，上岸了!");
	}

	public static void main(String[] args) {
		RunnableTask task = new RunnableTask();
		Thread thread = new Thread(task);
		thread.start();
	}
}
```
 这种方法的优点是可以避免 Java 的单继承限制，并且更符合面向对象的编程思想，因为 Runnable 接口将任务代码和线程控制的代码解耦了。
 第三种需要重写 Callable 接口的 call() 方法，然后创建 FutureTask 对象，参数为 Callable 实现类的对象；紧接着创建 Thread 对象，参数为 FutureTask 对象，最后调用 start() 方法启动线程。
```java
class CallableTask implements Callable<String> {
	public String call() {
		return "看完二哥的 Java 进阶之路，上岸了!";
	}

	public static void main(String[] args) throws ExecutionException, InterruptedException {
		CallableTask task = new CallableTask();
		FutureTask<String> futureTask = new FutureTask<>(task);
		Thread thread = new Thread(futureTask);
		thread.start();
		System.out.println(futureTask.get());
	}
}
```
 这种方法的优点是可以获取线程的执行结果。

 一个 8G 内存的系统最多能创建多少个线程?
 理论上大约 8000 个。
 创建线程的时候，至少需要分配一个虚拟机栈，在 64 位操作系统中，默认大小为 1M，因此一个线程大约需要 1M 的内存。
 但 JVM、操作系统本身的运行就要占一定的内存空间，所以实际上可以创建的线程数远比 8000 少。
 详细解释一下。
 可以通过 java -XX:+PrintFlagsFinal -version | grep ThreadStackSize 命令查看 JVM 栈的默认大小。

 其中 ThreadStackSize 的单位是 KB，也就是说默认的 JVM 栈大小是 1024 KB，也就是 1M。


#### 启动一个 Java 程序，你能说说里面有哪些线程吗？
 首先是 main 线程，这是程序执行的入口。
 然后是[[JVM 垃圾收集|垃圾回收]]线程，它是一个后台线程，负责回收不再使用的对象。
 还有编译器线程，比如 JIT，负责把一部分热点代码编译后放到 codeCache 中。

 可以通过下面的代码进行检测：
```java
class ThreadLister {
	public static void main(String[] args) {
		// 获取所有线程的堆栈跟踪
		Map<Thread, StackTraceElement[]> threads = Thread.getAllStackTraces();
		for (Thread thread : threads.keySet()) {
			System.out.println("Thread: " + thread.getName() + " (ID=" + thread.getId() + ")");
		}
	}
}
```
 结果如下所示：
```text
Thread: Monitor Ctrl-Break (ID=5)
Thread: Reference Handler (ID=2)
Thread: main (ID=1)
Thread: Signal Dispatcher (ID=4)
Thread: Finalizer (ID=3)
```
 简单解释下：

 Thread: main (ID=1) - 主线程，Java 程序启动时由 JVM 创建。
 Thread: Reference Handler (ID=2) - 这个线程是用来处理引用对象的，如软引用、弱引用和虚引用。负责清理被 JVM 回收的对象。
 Thread: Finalizer (ID=3) - 终结器线程，负责调用对象的 finalize 方法。对象在垃圾回收器标记为可回收之前，由该线程执行其 finalize 方法，用于执行特定的资源释放操作。
 Thread: Signal Dispatcher (ID=4) - 信号调度线程，处理来自操作系统的信号，将它们转发给 JVM 进行进一步处理，例如响应中断、停止等信号。
 Thread: Monitor Ctrl-Break (ID=5) - 监视器线程，通常由一些特定的 IDE 创建，用于在开发过程中监控和管理程序执行或者处理中断。







### 调用 start 方法时会执行 run 方法，那怎么不直接调用 run方法？
 调用 start() 会创建一个新的线程，并异步执行 run() 方法中的代码。
 直接调用 run() 方法只是一个普通的同步方法调用，所有代码都在当前线程中执行，不会创建新线程。没有新的线程创建，也就达不到多线程并发的目的。
 通过敲代码体验一下。
```java
class MyThread extends Thread {
	public void run() {
		System.out.println(Thread.currentThread().getName());
	}

	public static void main(String[] args) {
		MyThread t1 = new MyThread();
		t1.start(); // 正确的方式，创建一个新线程，并在新线程中执行 run()
		t1.run(); // 仅在主线程中执行 run()，没有创建新线程
	}
}
```
 来看输出结果：
```text
main
Thread-0
```
 也就是说，调用 start() 方法会通知 JVM，去调用底层的线程调度机制来启动新线程。

 调用 start() 后，线程进入就绪状态，等待操作系统调度；一旦调度执行，线程会执行其 run() 方法中的代码。







### 线程有哪些常用的调度方法？
 比如说 start 方法用于启动线程并让操作系统调度执行；sleep 方法用于让当前线程休眠一段时间；wait 方法会让当前线程等待，notify 会唤醒一个等待的线程。


#### 说说wait方法和notify方法？
 当线程 A 调用共享对象的 wait() 方法时，线程 A 会被阻塞挂起，直到：

 线程 B 调用了共享对象的 notify() 方法或者 notifyAll() 方法；
 其他线程调用线程 A 的 interrupt() 方法，导致线程 A 抛出 InterruptedException 异常。

 线程 A 调用共享对象的 wait(timeout) 方法后，没有在指定的 timeout 时间内被其它线程唤醒，那么这个方法会因为超时而返回。
 当线程 A 调用共享对象的 notify() 方法后，会唤醒一个在这个共享对象上调用 wait 系列方法被挂起的线程。
 共享对象上可能会有多个线程在等待，具体唤醒哪个线程是随机的。
 如果调用的是 notifyAll 方法，会唤醒所有在这个共享变量上调用 wait 系列方法而被挂起的线程。


#### 说说 sleep 方法？
 当线程 A 调用了 Thread 的 sleep 方法后，线程 A 会暂时让出指定时间的执行权。
 指定的睡眠时间到了后该方法会正常返回，接着参与 CPU 调度，获取到 CPU 资源后可以继续执行。


#### 说说yield方法？
 yield() 方法的目的是让当前线程让出 CPU 使用权，回到就绪状态。但是线程调度器可能会忽略。


#### 说说interrupt方法？
 interrupt() 方法用于通知线程停止，但不会直接终止线程，需要线程自行处理中断标志。
 常与 isInterrupted() 或 Thread.interrupted() 配合使用。
```java
Thread thread = new Thread(() -> {
	while (!Thread.currentThread().isInterrupted()) {
		System.out.println("Running");
	}
	System.out.println("Interrupted");
});
thread.start();
thread.interrupt(); // 中断线程
```


#### 说说 stop 方法？
 stop 方法用来强制停止线程，目前已经处于废弃状态，因为 stop 方法可能会在不一致的状态下释放锁，破坏对象的一致性。









### 线程有几种状态？
 6 种。
 new 代表线程被创建但未启动；runnable 代表线程处于就绪或正在运行状态，由操作系统调度；blocked 代表线程被阻塞，等待获取锁；waiting 代表线程等待其他线程的通知或中断；timed_waiting 代表线程会等待一段时间，超时后自动恢复；terminated 代表线程执行完毕，生命周期结束。

 也就是说，线程的生命周期可以分为五个主要阶段：新建、就绪、运行、阻塞和终止。线程在运行过程中会根据状态的变化在这些阶段之间切换。
```java
class ThreadStateExample {
	public static void main(String[] args) throws InterruptedException {
		Thread thread = new Thread(() -> {
			try {
				Thread.sleep(2000); // TIMED_WAITING
				synchronized (ThreadStateExample.class) {
					ThreadStateExample.class.wait(); // WAITING
				}
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			}
		});

		System.out.println("State after creation: " + thread.getState()); // NEW

		thread.start();
		System.out.println("State after start: " + thread.getState()); // RUNNABLE

		Thread.sleep(500);
		System.out.println("State while sleeping: " + thread.getState()); // TIMED_WAITING

		synchronized (ThreadStateExample.class) {
			ThreadStateExample.class.notify(); // 唤醒线程
		}

		thread.join();
		System.out.println("State after termination: " + thread.getState()); // TERMINATED
	}
}
```
 用一个表格来做个总结：

| 状态 | 说明 |
|------|------|
| NEW | 当线程被创建后，如通过 new Thread()，它处于新建状态。此时，线程已经被分配了必要的资源，但还没有开始执行。 |
| RUNNABLE | 当调用线程的 start() 方法后，线程进入可运行状态。在这个状态下，线程可能正在运行也可能正在等待获取 CPU 时间片，具体取决于线程调度器的调度策略。 |
| BLOCKED | 线程在试图获取一个锁以进入同步块/方法时，如果锁被其他线程持有，线程将进入阻塞状态，直到它获取到锁。 |
| WAITING | 线程进入等待状态是因为调用了如下方法之一：Object.wait() 或 LockSupport.park()。在等待状态下，线程需要其他线程显式地唤醒，否则不会自动执行。 |
| TIMED_WAITING | 当线程调用带有超时参数的方法时，如 Thread.sleep(long millis)、Object.wait(long timeout) 或 LockSupport.parkNanos()，它将进入超时等待状态。线程在指定的等待时间过后会自动返回可运行状态。 |
| TERMINATED | 当线程的 run() 方法执行完毕后，或者因为一个未捕获的异常终止了执行，线程进入终止状态。一旦线程终止，它的生命周期结束，不能再被重新启动。 |




#### 如何强制终止线程？
 第一步，调用线程的 interrupt() 方法，请求终止线程。
 第二步，在线程的 run() 方法中检查中断状态，如果线程被中断，就退出线程。
```java
class MyTask implements Runnable {
	@Override
	public void run() {
		while (!Thread.currentThread().isInterrupted()) {
			try {
				System.out.println("Running...");
				Thread.sleep(1000); // 模拟工作
			} catch (InterruptedException e) {
				// 捕获中断异常后，重置中断状态
				Thread.currentThread().interrupt();
				System.out.println("Thread interrupted, exiting...");
				break;
			}
		}
	}
}

public class Main {
	public static void main(String[] args) throws InterruptedException {
		Thread thread = new Thread(new MyTask());
		thread.start();
		Thread.sleep(3000); // 主线程等待3秒
		thread.interrupt(); // 请求终止线程
	}
}
```
 中断结果：








### 什么是线程上下文切换？

线程上下文切换是指 CPU 从一个线程切换到另一个线程执行时的过程。在切换过程中，CPU 需要保存当前线程的执行状态，并加载下一个线程的上下文。之所以要这样，是因为 CPU 在同一时刻只能执行一个线程，为了实现多线程并发执行，需要不断地在多个线程之间切换。

为了让用户感觉多个线程是在同时执行的，CPU 资源的分配采用了时间片轮转的方式，线程在时间片内占用 CPU 执行任务。当线程使用完时间片后，就会让出 CPU 让其他线程占用。

#### 线程切换的触发机制有哪些？

线程切换不是随机发生的，它有明确的触发条件，可以分为**被动切换（被操作系统强制打断）**和**主动切换（线程自己让出 CPU）**两大类：

**被动切换（抢占式）：**
- **时间片耗尽**：操作系统给每个线程分配一个时间片（通常几毫秒到几十毫秒），时钟中断一到，不管你代码跑到哪一行，直接打断换人。这是最常见的切换原因。
- **更高优先级线程就绪**：一个高优先级线程从阻塞状态被唤醒（比如 I/O 完成），操作系统会立刻抢占当前低优先级线程的 CPU。

**主动切换（协作式）：**
- **阻塞等待**：线程调用了阻塞操作（`sleep()`、`wait()`、阻塞 I/O、获取锁失败），自己主动放弃 CPU 进入等待队列。
- **主动让出**：线程调用 `Thread.yield()` 提示调度器"我可以让一让"，但调度器不一定采纳。
- **线程终止**：线程执行完毕或抛出未捕获异常，CPU 自然要分配给别人。

#### 完整的切换流程是怎样的？

可以用"换班交接"来理解——老员工下班前必须把工位状态拍照存档，新员工上班时按照自己上次的存档恢复工位：

1. **触发中断**：时钟中断到达或线程主动让出，CPU 从用户态陷入内核态。
2. **保存当前线程上下文**：操作系统把当前线程的寄存器状态（程序计数器 PC、栈指针 SP、通用寄存器等）保存到该线程的**内核栈**或**线程控制块（TCB）**中。这就是"拍照存档"。
3. **调度器选择下一个线程**：内核的调度算法（CFS、优先级队列等）从就绪队列中挑出下一个要运行的线程。
4. **恢复新线程上下文**：把新线程之前保存的寄存器状态从 TCB 中加载回 CPU 寄存器。如果新旧线程属于不同进程，还需要切换页表（虚拟地址空间），这会导致 TLB 缓存失效，代价更大。
5. **返回用户态**：CPU 跳转到新线程上次被打断的那条指令继续执行。

整个过程大约耗时几微秒到几十微秒。线程切换比进程切换快，因为同一进程内的线程共享地址空间，不需要切换页表和刷新 TLB。

#### 线程可以被多核调度吗？

多核处理器提供了并行执行多个线程的能力。每个核心可以独立执行一个或多个线程，操作系统的任务调度器会根据策略和算法，如优先级调度、轮转调度等，决定哪个线程何时在哪个核心上运行。







### 守护线程了解吗？
 了解，守护线程是一种特殊的线程，它的作用是为其他线程提供服务。
 Java 中的线程分为两类，一种是守护线程，另外一种是用户线程。
 JVM 启动时会调用 main 方法，main 方法所在的线程就是一个用户线程。在 JVM 内部，同时还启动了很多守护线程，比如垃圾回收线程。

#### 守护线程和用户线程有什么区别呢？
 区别之一是当最后一个非守护线程束时， JVM 会正常退出，不管当前是否存在守护线程，也就是说守护线程是否结束并不影响 JVM 退出。
 换而言之，只要有一个用户线程还没结束，正常情况下 JVM 就不会退出。



### 线程间有哪些通信方式？
 线程之间传递信息的方式有多种，比如说使用 volatile 和 synchronized 关键字共享对象、使用 wait() 和 notify() 方法实现生产者-消费者模式、使用 Exchanger 进行数据交换、使用 Condition 实现线程间的协调等。

#### 简单说说 volatile 和 synchronized 的使用方式？
 多个线程可以通过 volatile 和 synchronized 关键字访问和修改同一个对象，从而实现信息的传递。
 关键字 volatile 可以用来修饰成员变量，告知程序任何对该变量的访问均需要从共享内存中获取，并同步刷新回共享内存，保证所有线程对变量访问的可见性。
 关键字 synchronized 可以修饰方法，或者同步代码块，确保多个线程在同一个时刻只有一个线程在执行方法或代码块。
```java
class SharedObject {
	private String message;
	private boolean hasMessage = false;

	public synchronized void writeMessage(String message) {
		while (hasMessage) {
			try {
				wait();
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			}
		}
		this.message = message;
		hasMessage = true;
		notifyAll();
	}

	public synchronized String readMessage() {
		while (!hasMessage) {
			try {
				wait();
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			}
		}
		hasMessage = false;
		notifyAll();
		return message;
	}
}

public class Main {
	public static void main(String[] args) {
		SharedObject sharedObject = new SharedObject();

		Thread writer = new Thread(() -> {
			sharedObject.writeMessage("Hello from Writer!");
		});

		Thread reader = new Thread(() -> {
			String message = sharedObject.readMessage();
			System.out.println("Reader received: " + message);
		});

		writer.start();
		reader.start();
	}
}
```


#### wait() 和 notify() 方法的使用方式了解吗？
 一个线程调用共享对象的 wait() 方法时，它会进入该对象的等待池，释放已经持有的锁，进入等待状态。
 一个线程调用 notify() 方法时，它会唤醒在该对象等待池中等待的一个线程，使其进入锁池，等待获取锁。
```java
class MessageBox {
	private String message;
	private boolean empty = true;

	public synchronized void produce(String message) {
		while (!empty) {
			try {
				wait();
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			}
		}
		empty = false;
		this.message = message;
		notifyAll();
	}

	public synchronized String consume() {
		while (empty) {
			try {
				wait();
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			}
		}
		empty = true;
		notifyAll();
		return message;
	}
}

public class Main {
	public static void main(String[] args) {
		MessageBox box = new MessageBox();

		Thread producer = new Thread(() -> {
			box.produce("Message from producer");
		});

		Thread consumer = new Thread(() -> {
			String message = box.consume();
			System.out.println("Consumer received: " + message);
		});

		producer.start();
		consumer.start();
	}
}
```
 Condition 也提供了类似的方法， await() 负责阻塞、 signal() 和 signalAll() 负责通知。
 通常与锁 ReentrantLock 一起使用，为线程提供了一种等待某个条件成真的机制，并允许其他线程在该条件变化时通知等待线程。


#### Exchanger 的使用方式了解吗？
 Exchanger 是一个同步点，可以在两个线程之间交换数据。一个线程调用 exchange() 方法，将数据传递给另一个线程，同时接收另一个线程的数据。
```java
class Main {
	public static void main(String[] args) {
		Exchanger<String> exchanger = new Exchanger<>();

		Thread thread1 = new Thread(() -> {
			try {
				String message = "Message from thread1";
				String response = exchanger.exchange(message);
				System.out.println("Thread1 received: " + response);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			}
		});

		Thread thread2 = new Thread(() -> {
			try {
				String message = "Message from thread2";
				String response = exchanger.exchange(message);
				System.out.println("Thread2 received: " + response);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
			}
		});

		thread1.start();
		thread2.start();
	}
}
```


#### CompletableFuture 的使用方式了解吗？
 CompletableFuture 是 Java 8 引入的一个类，支持异步编程，允许线程在完成计算后将结果传递给其他线程。
```java
class Main {
	public static void main(String[] args) {
		CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
			// 模拟长时间计算
			return "Message from CompletableFuture";
		});

		future.thenAccept(message -> {
			System.out.println("Received: " + message);
		});
	}
}
```





## 线程通信与同步

### 请说说 sleep 和 wait 的区别？（补充）

 2024 年 03 月 21 日增补

 sleep 会让当前线程休眠，不需要获取对象锁，属于 Thread 类的方法；wait 会让获得对象锁的线程等待，要提前获得对象锁，属于 Object 类的方法。
 详细解释下。
 ①、所属类不同

 sleep() 方法专属于 Thread 类。
 wait() 方法专属于 Object 类。

 ②、锁行为不同
 如果一个线程在持有某个对象锁时调用了 sleep 方法，它在睡眠期间仍然会持有这个锁。
```java
class SleepDoesNotReleaseLock {

	private static final Object lock = new Object();

	public static void main(String[] args) throws InterruptedException {
		Thread sleepingThread = new Thread(() -> {
			synchronized (lock) {
				System.out.println("Thread 1 会继续持有锁，并且进入睡眠状态");
				try {
					Thread.sleep(5000);
				} catch (InterruptedException e) {
					e.printStackTrace();
				}
				System.out.println("Thread 1 醒来了，并且释放了锁");
			}
		});

		Thread waitingThread = new Thread(() -> {
			synchronized (lock) {
				System.out.println("Thread 2 进入同步代码块");
			}
		});

		sleepingThread.start();
		Thread.sleep(1000);
		waitingThread.start();
	}
}
```
 输出结果：
```text
Thread 1 会继续持有锁，并且进入睡眠状态
Thread 1 醒来了，并且释放了锁
Thread 2 进入同步代码块
```
 从输出中我们可以看到，waitingThread 必须等待 sleepingThread 完成睡眠后才能进入同步代码块。
 而当线程执行 wait 方法时，它会释放持有的对象锁，因此其他线程也有机会获取该对象的锁。
```java
class WaitReleasesLock {

	private static final Object lock = new Object();

	public static void main(String[] args) throws InterruptedException {
		Thread waitingThread = new Thread(() -> {
			synchronized (lock) {
				try {
					System.out.println("Thread 1 持有锁，准备等待 5 秒");
					lock.wait(5000);
					System.out.println("Thread 1 醒来了，并且退出同步代码块");
				} catch (InterruptedException e) {
					e.printStackTrace();
				}
			}
		});

		Thread notifyingThread = new Thread(() -> {
			synchronized (lock) {
				System.out.println("Thread 2 尝试唤醒等待中的线程");
				lock.notify();
				System.out.println("Thread 2 执行完了 notify");
			}
		});

		waitingThread.start();
		Thread.sleep(1000);
		notifyingThread.start();
	}
}
```
 输出结果：
```text
Thread 1 持有锁，准备等待 5 秒
Thread 2 尝试唤醒等待中的线程
Thread 2 执行完了 notify
Thread 1 醒来了，并且退出同步代码块
```
 这表明 waitingThread 在调用 wait 后确实释放了锁。
 ③、使用条件不同

 sleep() 方法可以在任何地方被调用。
 wait() 方法必须在同步代码块或同步方法中被调用，这是因为调用 wait() 方法的前提是当前线程必须持有对象的锁。否则会抛出 IllegalMonitorStateException 异常。


 ④、唤醒方式不同

 调用 sleep 方法后，线程会进入 TIMED_WAITING 状态，即在指定的时间内暂停执行。当指定的时间结束后，线程会自动恢复到 RUNNABLE 状态，等待 CPU 调度再次执行。
 调用 wait 方法后，线程会进入 WAITING 状态，直到有其他线程在同一对象上调用 notify 或 notifyAll 方法，线程才会从 WAITING 状态转变为 RUNNABLE 状态，准备再次获得 CPU 的执行权。

 我们来通过代码再感受一下 sleep() 和 wait() 在用法上的区别，先看 sleep() 的用法：
```java
class SleepExample {
	public static void main(String[] args) {
		Thread thread = new Thread(() -> {
			System.out.println("线程准备休眠 2 秒");
			try {
				Thread.sleep(2000); // 线程将睡眠2秒
			} catch (InterruptedException e) {
				e.printStackTrace();
			}
			System.out.println("线程醒来了");
		});

		thread.start();
	}
}
```
 再来看 wait() 的用法：
```java
class WaitExample {
	public static void main(String[] args) {
		final Object lock = new Object();

		Thread thread = new Thread(() -> {
			synchronized (lock) {
				try {
					System.out.println("线程准备等待 2 秒");
					lock.wait(2000); // 线程会等待2秒，或者直到其他线程调用 lock.notify()/notifyAll()
					System.out.println("线程结束等待");
				} catch (InterruptedException e) {
					e.printStackTrace();
				}
			}
		});

		thread.start();
	}
}
```





### 怎么保证线程安全？（补充）


 线程安全是指在并发环境下，多个线程访问共享资源时，程序能够正确地执行，而不会出现数据不一致的问题。
 为了保证线程安全，可以使用 synchronized 关键字 对方法加锁，对代码块加锁。线程在执行同步方法、同步代码块时，会获取类锁或者对象锁，其他线程就会阻塞并等待锁。
 如果需要更细粒度的锁，可以使用 ReentrantLock 并发重入锁 等。
 如果需要保证变量的内存可见性，可以使用 volatile 关键字 。
 对于简单的原子变量操作，还可以使用 Atomic 原子类 。
 对于线程独立的数据，可以使用 ThreadLocal 来为每个线程提供专属的变量副本。
 对于需要并发容器的地方，可以使用 Concurrent[[HashMap核心原理|HashMap]] 、 CopyOnWriteArrayList 等。

#### 有个int的变量为0，十个线程轮流对其进行++操作（循环10000次），结果大于10 万还是小于等于10万，为什么？
 在这个场景中，最终的结果会小于 100000，原因是多线程环境下，++ 操作并不是一个原子操作，而是分为读取、加 1、写回三个步骤。

 读取变量的值。
 将读取到的值加 1。
 将结果写回变量。

 这样的话，就会有多个线程读取到相同的值，然后对这个值进行加 1 操作，最终导致结果小于 100000。
 详细解释下。
 多个线程在并发执行 ++ 操作时，可能出现以下竞态条件：

 线程 1 读取变量值为 0。
 线程 2 也读取变量值为 0。
 线程 1 进行加法运算并将结果 1 写回变量。
 线程 2 进行加法运算并将结果 1 写回变量，覆盖了线程 1 的结果。

 可以通过 synchronized 关键字为 ++ 操作加锁。
```java
class Main {
	private static int count = 0;

	public static void main(String[] args) throws InterruptedException {
		Runnable task = () -> {
			for (int i = 0; i < 10000; i++) {
				synchronized (Main.class) {
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

		System.out.println("Final count: " + count);
	}
}
```
 或者使用 AtomicInteger 的 incrementAndGet() 方法来替代 ++ 操作，保证变量的原子性。
```java
class Main {
	private static AtomicInteger count = new AtomicInteger(0);

	public static void main(String[] args) throws InterruptedException {
		Runnable task = () -> {
			for (int i = 0; i < 10000; i++) {
				count.incrementAndGet();
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

		System.out.println("Final count: " + count.get());
	}
}
```


#### 场景:有一个 key 对应的 value 是一个json 结构，json 当中有好几个子任务，这些子任务如果对 key 进行修改的话，会不会存在线程安全的问题？
 会。
 在单节点环境中，可以使用 synchronized 关键字或 ReentrantLock 来保证对 key 的修改操作是原子的。
```java
class KeyManager {
	private final ReentrantLock lock = new ReentrantLock();

	private String key = "{ \" tasks \" : [ \" task1 \" , \" task2 \" ]}";

	public String readKey() {
		lock.lock();
		try {
			return key;
		} finally {
			lock.unlock();
		}
	}

	public void updateKey(String newKey) {
		lock.lock();
		try {
			this.key = newKey;
		} finally {
			lock.unlock();
		}
	}
}
```
 在多节点环境中，可以使用分布式锁 Redisson 来保证对 key 的修改操作是原子的。
```java
class DistributedKeyManager {
	private final RedissonClient redisson;

	public DistributedKeyManager() {
		Config config = new Config();
		config.useSingleServer().setAddress("redis://127.0.0.1:6379");
		this.redisson = Redisson.create(config);
	}

	public void updateKey(String key, String newValue) {
		RLock lock = redisson.getLock(key);
		lock.lock();
		try {
			// 模拟读取和更新操作
			String currentValue = readFromDatabase(key); // 假设读取 JSON 数据
			String updatedValue = modifyJson(currentValue, newValue); // 修改 JSON
			writeToDatabase(key, updatedValue); // 写回数据库
		} finally {
			lock.unlock();
		}
	}

	private String readFromDatabase(String key) {
		// 模拟从数据库读取
		return "{ \" tasks \" : [ \" task1 \" , \" task2 \" ]}";
	}

	private String modifyJson(String json, String newValue) {
		// 使用 JSON 库解析并修改
		return json.replace("task1", newValue);
	}

	private void writeToDatabase(String key, String value) {
		// 模拟写回数据库
	}
}
```


#### 说一个线程安全的使用场景？
 单例模式。在多线程环境下，如果多个线程同时尝试创建实例，单例类必须确保只创建一个实例，并提供一个全局访问点。
 饿汉式是一种比较直接的实现方式，它通过在类加载时就立即初始化单例对象来保证线程安全。
```java
class Singleton {
	private static final Singleton instance = new Singleton();

	private Singleton() {
	}

	public static Singleton getInstance() {
		return instance;
	}
}
```
 懒汉式单例则在第一次使用时初始化单例对象，这种方式需要使用双重检查锁定来确保线程安全，volatile 关键字用来保证可见性，syncronized 关键字用来保证同步。
```java
class LazySingleton {
	private static volatile LazySingleton instance;

	private LazySingleton() {
	}

	public static LazySingleton getInstance() {
		if (instance == null) { // 第一次检查
			synchronized (LazySingleton.class) {
				if (instance == null) { // 第二次检查
					instance = new LazySingleton();
				}
			}
		}
		return instance;
	}
}
```


#### 能说一下 Hashtable 的底层数据结构吗？
 与 HashMap 类似，Hashtable 的底层数据结构也是一个数组加上链表的方式，然后通过 synchronized 加锁来保证线程安全。






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
localVariable.set("沉默王二是沙雕");
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
 在 Web 应用中，可以使用 ThreadLocal 存储用户会话信息，这样每个线程在处理用户请求时都能方便地访问当前用户的会话信息。
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

 Entry 继承了 WeakReference，它限定了 key 是一个弱引用，弱引用的好处是当内存不足时，JVM 会回收 ThreadLocal 对象，并且将其对应的 Entry.value 设置为 null，这样可以在很大程度上避免内存泄漏。
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
 我先说一下强引用，比如 User user = new User("沉默王二") 中，user 就是一个强引用， new User("沉默王二") 就是强引用对象。
 当 user 被置为 null 时（ user = null ）， new User("沉默王二") 对象就会被垃圾回收；否则即便是内存空间不足，JVM 也不会回收 new User("沉默王二") 这个强引用对象，宁愿抛出 OutOfMemoryError。
 弱引用，比如说在使用 ThreadLocal 中，Entry 的 key 就是一个弱引用对象。
```java
ThreadLocal<User> userThreadLocal = new ThreadLocal<>();
userThreadLocal.set(new User("沉默王二"));
```
 userThreadLocal 是一个强引用， new ThreadLocal<>() 是一个强引用对象；
 new User("沉默王二") 是一个强引用对象。
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
 一句话总结：ThreadLocalMap 采用的是“先清理再扩容”的策略，扩容时，数组长度翻倍，并重新计算索引，如果发生哈希冲突，采用线性探测法来解决。



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

- [[Java 内存模型]] — 线程可见性问题的根源
- [[锁]] — synchronized/Lock 解决线程安全问题
- [[线程池]] — 线程的复用与管理
- [[JVM 内存管理]] — 虚拟机栈与线程一一对应
- [[Spring 基础与 IoC]] — 单例 Bean 在多线程下的安全隐患
