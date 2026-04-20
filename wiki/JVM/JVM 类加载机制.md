---
module: JVM
tags: [JVM, 类加载, 双亲委派]
difficulty: medium
last_reviewed: 2026-04-20
---

# JVM 类加载机制

## 类加载基础

### 🌟了解类的加载机制吗？

了解。JVM 的操作对象是 Class 文件，JVM 把 Class 文件中描述类的数据结构加载到内存中，并对数据进行校验、解析和初始化，最终转化成可以被 JVM 直接使用的类型，这个过程被称为类加载机制。

其中最重要的三个概念就是：类加载器、类加载过程和双亲委派模型。

- 类加载器：负责加载类文件，将类文件加载到内存中，生成 Class 对象。
- 类加载过程：包括加载、验证、准备、解析和初始化等步骤。
- 双亲委派模型：当一个类加载器接收到类加载请求时，它会把请求委派给父类加载器去完成，依次递归，直到最顶层的类加载器，如果父类加载器无法完成加载请求，子类加载器才会尝试自己去加载。

#### 类加载器有哪些？

主要有四种：

①、启动类加载器，负责加载 JVM 的核心类库，如 rt.jar 和其他核心库位于 `JAVA_HOME/jre/lib` 目录下的类。

②、扩展类加载器，负责加载 `JAVA_HOME/jre/lib/ext` 目录下，或者由系统属性 `java.ext.dirs` 指定位置的类库，由 `sun.misc.Launcher$ExtClassLoader` 实现。

③、应用程序类加载器，负责加载 classpath 的类库，由 `sun.misc.Launcher$AppClassLoader` 实现。我们编写的任何类都是由应用程序类加载器加载的，除非显式使用自定义类加载器。

④、用户自定义类加载器，通常用于加载网络上的类、执行热部署（动态加载和替换应用程序的组件），或者为了安全考虑，从不同的源加载类。通过继承 `java.lang.ClassLoader` 类来实现。

#### 能说一下类的生命周期吗？

一个类从被加载到虚拟机内存中开始，到从内存中卸载，整个生命周期需要经过七个阶段：加载、验证、准备、解析、初始化、使用和卸载。

### 🌟类装载的过程知道吗？

知道。类装载过程包括三个阶段：载入、链接和初始化。

①、载入：将类的二进制字节码加载到内存中。

②、链接可以细分为三个小的阶段：

- 验证：检查类文件格式是��符合 JVM 规范
- 准备：为类的静态变量分配内存并设置默认值。
- 解析：将符号引用替换为直接引用。

③、初始化：执行静态代码块和静态变量初始化。

在准备阶段，静态变量已经被赋过默认初始值了，在初始化阶段，静态变量将被赋值为代码期望赋的值。比如说 `static int a = 1;`，在准备阶段，`a` 的值为 0，在初始化阶段，`a` 的值为 1。

换句话说，初始化阶段是在执行类的构造方法，也就是 javap 中看到的 `<clinit>()`。

#### 载入过程 JVM 会做什么？

1. 通过一个类的全限定名来获取定义此类的二进制字节流。
2. 将这个字节流所代表的静态存储结构转化为方法区的运行时数据结构。
3. 在内存中生成一个代表这个类的 `java.lang.Class` 对象，作为这个类的访问入口。

## 双亲委派模型

### 🌟什么是双亲委派模型？

双亲委派模型要求类加载器在加载类时，先委托父加载器尝试加载，只有父加载器无法加载时，子加载器才会加载。

这个过程会一直向上递归，也就是说，从子加载器到父加载器，再到更上层的加载器，一直到最顶层的启动类加载器。启动类加载器会尝试加载这个类。如果它能够加载这个类，就直接返回；如果它不能加载这个类，就会将加载任务返回给委托它的子加载器。

子加载器尝试加载这个类。如果子加载器也无法加载这个类，它就会继续向下传递这个加载任务，依此类推。直到某个加载器能够加载这个类，或者所有加载器都无法加载这个类，最终抛出 `ClassNotFoundException`。

#### 为什么要用双亲委派模型？

①、避免类的重复加载：父加载器加载的类，子加载器无需重复加载。

②、保证核心类库的安全性：如 `java.lang.*` 只能由 Bootstrap ClassLoader 加载，防止被篡改。

#### 如何破坏双亲委派机制？

重写 ClassLoader 的 `loadClass()` 方法。

如果不想打破双亲委派模型，就重写 ClassLoader 类中的 `findClass()` 方法，那些无法被父类加载器加载的类最终会通过这个方法被加载。

#### 有哪些破坏双亲委派模型的典型例子？

第一种：SPI 机制加载 JDBC 驱动。

第二种：热部署框架。

#### 说说 SPI 机制？

SPI 是 Java 的一种扩展机制，用于加载和注册第三方类库，常见于 JDBC、JNDI 等框架。

双亲委派模型会优先让父类加载器加载类，而 SPI 需要动态加载子类加载器中的实现。根据双亲委派模型，`java.sql.Driver` 类应该由父加载器加载，但父类加载器无法加载由子类加载器定义的驱动类，如 MySQL 的 `com.mysql.cj.jdbc.Driver`。

那么只能使用 SPI 机制通过 `META-INF/services` 文件指定服务提供者的实现类。

```java
ClassLoader cl = Thread.currentThread().getContextClassLoader();
Enumeration<Driver> drivers = ServiceLoader.load(Driver.class, cl).iterator();
```

DriverManager 使用了线程上下文类加载器来加载 SPI 的实现类，从而允许子类加载器加载具体的 JDBC 驱动。

#### 说说热部署？

热部署是指在不重启服务器的情况下更新应用程序代码，需要替换旧版本的类，但旧版本的类可能由父加载器加载。如 Spring Boot 的 DevTools 通常会自定义类加载器，优先加载新的类版本。

#### Tomcat 的类加载机制了解吗？

了解。Tomcat 基于双亲委派模型进行了一些扩展，主要的类加载器有：

- Bootstrap ClassLoader：加载 Java 的核心类库；
- Catalina ClassLoader：加载 Tomcat 的核心类库；
- Shared ClassLoader：加载共享类库，允许多个 Web 应用共享某些类库；
- WebApp ClassLoader：加载 Web 应用程序的类库，支持多应用隔离和优先加载应用自定义的类库（破坏了双亲委派模型）。

#### 你觉得应该怎么实现一个热部署功能？

热部署是指在不重启服务器的情况下，动态加载、更新或卸载应用程序的组件，比如类、配置文件等。需要在类加载器的基础上，实现类的重新加载。

第一步，使用文件监控机制，如 Java NIO 的 WatchService 来监控类文件或配置文件的变化。当监控到文件变更时，触发热部署流程。

```java
class FileWatcher {
    public static void watchDirectoryPath(Path path) {
        if (!Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS)) {
            System.err.println("Provided path is not a directory: " + path);
            return;
        }
        try (WatchService watchService = path.getFileSystem().newWatchService()) {
            path.register(watchService, ENTRY_CREATE, ENTRY_MODIFY, ENTRY_DELETE);
            while (true) {
                WatchKey key;
                try {
                    key = watchService.take();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
                for (WatchEvent<?> event : key.pollEvents()) {
                    System.out.println("Event: " + event.kind().name() + ", File: " + event.context());
                }
                if (!key.reset()) break;
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

第二步，创建一个自定义类加载器，继承 `java.lang.ClassLoader`，并重写 `findClass()` 方法，用来加载新的类文件。

```java
class HotSwapClassLoader extends ClassLoader {
    public HotSwapClassLoader() {
        super(ClassLoader.getSystemClassLoader());
    }

    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        byte[] classBytes = loadClassData(name);
        if (classBytes == null) {
            throw new ClassNotFoundException(name);
        }
        return defineClass(name, classBytes, 0, classBytes.length);
    }

    private byte[] loadClassData(String name) {
        // 从文件系统或其他来源加载类文件的字节码
        return null;
    }
}
```

## 解释执行与编译执行

### 说说解释执行和编译执行的区别

先说解释和编译的区别：

- 解释：将源代码逐行转换为机器码。
- 编译：将源代码一次性转换为机器码。

再来说说解释执行和编译执行的区别：

- 解释执行：程序运行时，将源代码逐行转换为机器码，然后执行。
- 编译执行：程序运行前，将源代码一次性转换为机器码，然后执行。

Java 一般被称为"解释型语言"，因为 Java 代码在执行前，需要先将源代码编译成字节码，然后在运行时，再由 JVM 的解释器"逐行"将字节码转换为机器码，然后执行。这也是 Java 被诟病"慢"的主要原因。

但 JIT 的出现打破了这种刻板印象，JVM 会将热点代码（即运行频率高的代码）编译后放入 CodeCache，当下次执行再遇到这段代码时，会从 CodeCache 中直接读取机器码，然后执行。因此，Java 的执行效率得到了大幅提升。

## 相关链接

- [[JVM 概述]] — JVM 整体架构
- [[JVM 内存管理]] — 方法区存储类的元数据
- [[AOP 与动态代理]] — CGLIB 在运行时动态生成类，涉及类加载
- [[Spring 基础与 IoC]] — Spring 扫描 Bean 依赖类加载机制
