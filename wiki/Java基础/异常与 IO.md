---
module: Java基础
tags: [Java, 异常, IO, NIO]
difficulty: medium
last_reviewed: 2026-05-08
---

# 异常与 I/O
## 异常处理

### Java 中异常处理体系？

**答案：**

```
Throwable
├── Error（JVM 级错误，程序无法恢复）
│   ├── OutOfMemoryError（堆内存不足）
│   ├── StackOverflowError（栈溢出，通常是无限递归）
│   └── VirtualMachineError
└── Exception（程序可处理）
    ├── Checked Exception（编译时异常，必须处理）
    │   ├── IOException
    │   ├── SQLException
    │   └── ClassNotFoundException
    └── RuntimeException（运行时异常，可不处理）
        ├── NullPointerException（空指针）
        ├── ClassCastException（类型转换失败）
        ├── ArrayIndexOutOfBoundsException（数组越界）
        ├── NumberFormatException（数字格式错误）
        └── IllegalArgumentException（非法参数）
```

**Checked vs Unchecked 的选择：**
- **Checked**：调用方必须处理，适合"可预期且可恢复"的场景（如文件不存在、网络超时）
- **Unchecked（RuntimeException）**：适合"编程错误"（如空指针、越界），强制处理反而增加噪音

> [!tip] 现代框架的趋势
> Spring、Hibernate 等框架大量使用 RuntimeException（如 `DataAccessException`），避免强制调用方处理无法恢复的异常。

---

### 异常的处理方式？

**答案：**

两种主流方式：

1. `throw/throws` 向上抛出，由上层处理。
2. `try-catch-finally` 本地捕获处理。

补充：当 `catch` 和 `finally` 都抛异常时，最终通常以 `finally` 抛出的异常为准。

---

### 三道经典异常处理代码题

**答案：**

```java
// 题 1：finally 一定在 return 前执行
public int test1() {
    try {
        return 1;
    } finally {
        System.out.println("finally");  // 先打印，再返回 1
    }
}

// 题 2：finally 里有 return，覆盖 try 的返回值
public int test2() {
    try {
        return 1;
    } finally {
        return 2;  // 最终返回 2，try 的 return 1 被丢弃
    }
}

// 题 3：try 返回基本类型，finally 修改变量不影响返回值
public int test3() {
    int x = 1;
    try {
        return x;   // 此时已把 x=1 的值快照保存
    } finally {
        x = 100;    // 修改 x，但不影响已保存的快照
    }
    // 返回 1，不是 100
}
```

> [!warning] finally 不执行的唯一情况
> `System.exit()` 被调用时，JVM 直接退出，finally 不会执行。

---

### try-with-resources 是什么？为什么推荐用？

**答案：**

Java 7 引入，用于自动关闭实现了 `AutoCloseable` 接口的资源，替代繁琐的 `finally` 手动关闭。

```java
// 旧写法：finally 手动关闭，容易忘记或出错
InputStream in = null;
try {
    in = new FileInputStream("file.txt");
    // 读取操作
} catch (IOException e) {
    e.printStackTrace();
} finally {
    if (in != null) {
        try { in.close(); } catch (IOException e) { }  // 关闭本身也可能抛异常
    }
}

// try-with-resources：自动关闭，代码简洁
try (InputStream in = new FileInputStream("file.txt")) {
    // 读取操作
} catch (IOException e) {
    e.printStackTrace();
}
// 无论是否异常，in.close() 都会被自动调用

// 多个资源：按声明的逆序关闭
try (Connection conn = getConnection();
     PreparedStatement ps = conn.prepareStatement(sql)) {
    // 操作
}
```

> [!tip] 异常抑制（Suppressed Exception）
> 如果 try 块和 close() 都抛出异常，close() 的异常会被"抑制"（suppressed），不会覆盖 try 块的异常。可以通过 `e.getSuppressed()` 获取被抑制的异常。

---

## IO 流

### Java 中 IO 流分为几种？

**答案：**

可按多个维度划分：

- 方向：输入流/输出流。
- 单位：字节流/字符流。
- 功能：节点流/处理流/管道流。

常见增强点是缓冲处理，底层思想可类比装饰器模式。

---

### 既然有字节流，为什么还要字符流？

**答案：**

字符流面向文本处理更直接，能减少手工编码转换带来的复杂性与乱码风险。

本质上文件底层仍是字节；字符流是“按字符语义”在读写字节。

---

### BIO、NIO、AIO 的区别？

**答案：**

| 模型 | 全称 | 线程模型 | 适用场景 |
|------|------|---------|---------|
| BIO | Blocking IO | 一连接一线程 | 连接数少、并发低 |
| NIO | Non-blocking IO | 一线程处理多连接（多路复用） | 高并发、短连接（如 HTTP） |
| AIO | Asynchronous IO | 异步回调，无需等待 | 高并发、长连接、大文件 |

**NIO 的三大核心组件：**

```java
// 1. Channel（通道）：双向数据传输，替代 Stream
FileChannel channel = FileChannel.open(Paths.get("file.txt"), StandardOpenOption.READ);

// 2. Buffer（缓冲区）：数据的容器，读写都通过 Buffer
ByteBuffer buffer = ByteBuffer.allocate(1024);
channel.read(buffer);   // 从 Channel 读数据到 Buffer
buffer.flip();          // 切换为读模式（position=0, limit=之前写入的位置）
while (buffer.hasRemaining()) {
    System.out.print((char) buffer.get());
}

// 3. Selector（选择器）：单线程监控多个 Channel 的事件
Selector selector = Selector.open();
channel.register(selector, SelectionKey.OP_READ);  // 注册感兴趣的事件

while (true) {
    selector.select();  // 阻塞，直到有 Channel 就绪
    Set<SelectionKey> keys = selector.selectedKeys();
    for (SelectionKey key : keys) {
        if (key.isReadable()) {
            // 处理可读事件
        }
    }
}
```

**NIO 的工作原理：**
```
多个 Channel ──注册──→ Selector ──轮询就绪──→ 单线程处理
```

> [!tip] Netty 就是基于 NIO 的
> Netty 封装了 NIO 的复杂性，提供了更易用的 API。实际项目中很少直接用 Java NIO，而是用 Netty。

---

### 什么是序列化和反序列化？

**答案：**

- 序列化：对象 -> 字节流（便于存储与传输）。
- 反序列化：字节流 -> 对象。

补充要点：

- `Serializable` 用于声明可序列化。
- `serialVersionUID` 用于版本兼容控制。
- `transient` 字段不会被序列化。

---

## 序列化

### 常见序列化方式有哪些？

**答案：**

1. Java 原生序列化（`ObjectOutputStream/ObjectInputStream`）。
2. JSON 序列化（如 Jackson）。
3. Protobuf 序列化（更紧凑、性能更好）。

---

### 了解 Socket 网络套接字吗？

**答案：**

`Socket`（套接字）是 Java 用来**收发网络数据的编程接口**——可以理解为"电话听筒"，程序拿到它就能和另一台机器通信。它底层基于传输层的 **TCP / UDP** 协议（[[计算机网络#三、传输层核心对决：TCP 与 UDP|TCP 与 UDP 的区别见计算机网络]]）。

- 客户端常用 `Socket`：主动发起连接。
- 服务端常用 `ServerSocket`：监听端口、接受连接。

> [!tip] 它在技术栈里的位置
> 从底到高三层：**TCP/UDP**（传输协议）→ **Socket**（Java 操作网络的接口）→ **RPC 框架**（在 Socket 之上封装协议、序列化、服务治理，让远程调用像本地方法一样简单）。RPC 的详细说明见 [[计算机网络#六、RPC：远程过程调用]]。

---

## 泛型

### Java 泛型了解吗？类型擦除有什么影响？

**答案：**

泛型核心价值：**类型安全 + 减少强制类型转换**，编译期检查类型错误。

**类型擦除：** Java 泛型只在编译期生效，运行时类型参数信息被擦除，替换为原始类型（通常是 `Object` 或上界）。

```java
// 编译后，List<String> 和 List<Integer> 都变成 List（原始类型）
List<String> strList = new ArrayList<>();
List<Integer> intList = new ArrayList<>();
strList.getClass() == intList.getClass();  // true！运行时都是 ArrayList

// 类型擦除导致的限制：
// 1. 不能 new T()
public <T> T create() {
    return new T();  // 编译错误！运行时不知道 T 是什么
    // 解决：传入 Class<T>，用反射 clazz.newInstance()
}

// 2. 不能 instanceof T
if (obj instanceof T) { }  // 编译错误！

// 3. 不能创建泛型数组
T[] arr = new T[10];  // 编译错误！

// 4. 静态成员不能用类型参数
class Box<T> {
    static T value;  // 编译错误！静态成员属于类，不属于某个泛型实例
}
```

**通配符：**
```java
// ? extends T：上界通配符，只读（生产者）
List<? extends Number> nums = new ArrayList<Integer>();
Number n = nums.get(0);  // OK
// nums.add(1);          // 编译错误！不知道具体类型

// ? super T：下界通配符，只写（消费者）
List<? super Integer> list = new ArrayList<Number>();
list.add(1);             // OK
// Integer i = list.get(0);  // 编译错误！只能用 Object 接收
```

> [!tip] PECS 原则
> Producer Extends, Consumer Super：生产数据用 `? extends`，消费数据用 `? super`。`Collections.copy(dest, src)` 就是典型应用。

---

## 相关链接

- [[面向对象核心]] — 异常体系基于继承
- [[Spring 事务]] — 事务回滚与异常类型的关系
- [[JVM 内存管理]] — NIO 涉及直接内存与零拷贝
- [[线程基础与ThreadLocal]] — BIO/NIO/AIO 与线程模型
