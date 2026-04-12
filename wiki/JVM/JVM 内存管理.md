### 🌟能说一下 JVM 的内存区域吗？
 按照 Java 虚拟机规范，JVM 的内存区域可以细分为 程序计数器 、 虚拟机栈 、 本地方法栈 、 堆 和 方法区 。 
 
 其中 方法区 和 堆 是线程共享的， 虚拟机栈 、 本地方法栈 和 程序计数器 是线程私有的。 ### 介绍一下程序计数器？
 程序计数器也被称为 PC 寄存器，是一块较小的内存空间。它可以看作是当前线程所执行的字节码行号指示器。 ### 介绍一下 Java 虚拟机栈？
 Java 虚拟机栈的生命周期与线程相同。 
 当线程执行一个方法时，会创建一个对应的 栈帧 ，用于存储局部变量表、操作数栈、动态链接、方法出口等信息，然后栈帧会被压入虚拟机栈中。当方法执行完毕后，栈帧会从虚拟机栈中移除。 ### 一个什么都没有的空方法，空的参数都没有，那局部变量表里有没有变量？
 对于 静态方法 ，由于不需要访问实例对象 this，因此在局部变量表中不会有任何变量。 
 对于非静态方法，即使是一个完全空的方法，局部变量表中也会有一个用于存储 this 引用的变量。this 引用指向当前实例对象，在方法调用时被隐式传入。 
 详细解释一下： 
 比如说有这样一段代码： 
 public class VarDemo1 { 
 public void emptyMethod () { 
 // 什么都没有 
 } 
 
 public static void staticEmptyMethod () { 
 // 什么都没有 
 } 
 } 
 用 javap -v VarDemo1 命令查看编译后的字节码，就可以在 emptyMethod 中看到这样的内容： 
 
 这里的 locals=1 表示局部变量表有一个变量，即 this，Slot 0 位置存储了 this 引用。 
 而在静态方法 staticEmptyMethod 中，你会看到这样的内容： 
 
 这里的 locals=0 表示局部变量表为空，因为静态方法属于类级别方法，不需要 this 引用，也就没有局部变量。 ### 介绍一下本地方法栈？
 本地方法栈与虚拟机栈相似，区别在于虚拟机栈是为 JVM 执行 Java 编写的方法服务的，而本地方法栈是为 Java 调用 本地 native 方法 服务的，通常由 C/C++ 编写。 
 在本地方法栈中，主要存放了 native 方法的局部变量、动态链接和方法出口等信息。当一个 Java 程序调用一个 native 方法时，JVM 会切换到本地方法栈来执行这个方法。 ### 介绍一下本地方法栈的运行场景？
 当 Java 应用需要与操作系统底层或硬件交互时，通常会用到本地方法栈。 
 比如调用操作系统的特定功能，如内存管理、文件操作、系统时间、系统调用等。 
 详细说明一下： 
 比如说获取系统时间的 System.currentTimeMillis() 方法就是调用本地方法，来获取操作系统当前时间的。 
 
 再比如 JVM 自身的一些底层功能也需要通过本地方法来实现。像 Object 类中的 hashCode() 方法、 clone() 方法等。 ### native 方法解释一下？
 native 方法是在 Java 中通过 native 关键字 声明的，用于调用非 Java 语言，如 C/C++ 编写的代码。Java 可以通过 JNI，也就是 Java Native Interface 与底层系统、硬件设备、或者本地库进行交互。 ### 介绍一下 Java 堆？
 堆是 JVM 中最大的一块内存区域，被所有线程共享，在 JVM 启动时创建，主要用来存储 new 出来的对象。 
 
 Java 中“几乎”所有的对象都会在堆中分配，堆也是 垃圾收集器 管理的目标区域。 
 从内存回收的角度来看，由于垃圾收集器大部分都是基于分代收集理论设计的，所以堆又被细分为 新生代 、 老年代 、 Eden空间 、 From Survivor空间 、 To Survivor空间 等。 
 
 随着 JIT 编译器 的发展和逃逸技术的逐渐成熟，“所有的对象都会分配到堆上”就不再那么绝对了。 
 从 JDK 7 开始，JVM 默认开启了逃逸分析，意味着如果某些方法中的对象引用没有被返回或者没有在方法体外使用，也就是未逃逸出去，那么对象可以直接在栈上分配内存。 ### 堆和栈的区别是什么？
 堆属于线程共享的内存区域，几乎所有 new 出来的对象都会堆上分配，生命周期不由单个方法调用所决定，可以在方法调用结束后继续存在，直到不再被任何变量引用，最后被垃圾收集器回收。 
 栈属于线程私有的内存区域，主要存储局部变量、方法参数、对象引用等，通常随着方法调用的结束而自动释放，不需要垃圾收集器处理。 ### 介绍一下方法区？
 方法区并不真实存在，属于 Java 虚拟机规范中的一个逻辑概念，用于存储已被 JVM 加载的类信息、常量、静态变量、即时编译器编译后的代码缓存等。 
 在 HotSpot 虚拟机中，方法区的实现称为永久代 PermGen，但在 Java 8 及之后的版本中，已经被元空间 Metaspace 所替代。 ### 变量存在堆栈的什么位置？
 对于局部变量，它存储在当前方法栈帧中的局部变量表中。当方法执行完毕，栈帧被回收，局部变量也会被释放。 
 public void method () { 
 int localVar = 100 ; // 局部变量，存储在栈帧中的局部变量表里 
 } 
 对于静态变量来说，它存储在 Java 虚拟机规范中的方法区中，在 Java 7 中是永久带，在 Java8 及以后 是元空间。 
 public class StaticVarDemo { 
 public static int staticVar = 100 ; // 静态变量，存储在方法区中 
 } ### 说一下 JDK 1.6、1.7、1.8 内存区域的变化？
 JDK 1.6 使用永久代来实现方法区： 
 
 JDK 1.7 时仍然是永久带，但发生了一些细微变化，比如将字符串常量池、静态变量存放到了堆上。 
 
 在 JDK 1.8 时，直接在内存中划出了一块区域，叫 元空间 ，来取代之前放在 JVM 内存中的永久代，并将运行时常量池、类常量池都移动到了元空间。 ### 为什么使用元空间替代永久代？
 客观上，永久代会导致 Java 应用程序更容易出现内存溢出的问题，因为它要受到 JVM 内存大小的限制。 
 HotSpot 虚拟机的永久代大小可以通过 -XX：MaxPermSize 参数来设置，32 位机器默认的大小为 64M，64 位的机器则为 85M。 
 而 J9 和 JRockit 虚拟机就不存在这种限制，只要没有触碰到进程可用的内存上限，例如 32 位系统中的 4GB 限制，就不会出问题。 
 主观上，当 Oracle 收购 BEA 获得了 JRockit 的所有权后，就准备把 JRockit 中的优秀功能移植到 HotSpot 中。 
 如 Java Mission Control 管理工具。 
 但因为两个虚拟机对方法区实现有差异，导致这项工作遇到了很多阻力。 
 考虑到 HotSpot 虚拟机未来的发展，JDK 6 的时候，开发团队就打算放弃永久代了。 
 JDK 7 的时候，前进了一小步，把原本放在永久代的字符串常量池、静态变量等移动到了堆中。 
 JDK 8 就终于完成了这项移出工作，这样的好处就是，元空间的大小不再受到 JVM 内存的限制，而是可以像 J9 和 JRockit 那样，只要系统内存足够，就可以一直用。 ### 🌟对象创建的过程了解吗？
 当我们使用 new 关键字创建一个对象时，JVM 首先会检查 new 指令的参数是否能在常量池中定位到类的符号引用，然后检查这个符号引用代表的类是否已被加载、解析和初始化。如果没有，就先执行类加载。 
 
 如果已经加载，JVM 会为对象分配内存完成初始化，比如数值类型的成员变量初始值是 0，布尔类型是 false，对象类型是 null。 
 接下来会设置对象头，里面包含了对象是哪个类的实例、对象的哈希码、对象的 GC 分代年龄等信息。 
 最后，JVM 会执行构造方法 <init> 完成赋值操作，将成员变量赋值为预期的值，比如 int age = 18 ，这样一个对象就创建完成了。 ### 对象的销毁过程了解吗？
 当对象不再被任何引用指向时，就会变成垃圾。垃圾收集器会通过可达性分析算法判断对象是否存活，如果对象不可达，就会被回收。 
 垃圾收集器通过标记清除、标记复制、标记整理等算法来回收内存，将对象占用的内存空间释放出来。 
 可以通过 java -XX:+PrintCommandLineFlags -version 和 java -XX:+PrintGCDetails -version 命令查看 JVM 的 GC 收集器。 
 
 可以看到，我本机安装的 JDK 8 默认使用的是 Parallel Scavenge + Parallel Old 。 
 不同参数代表对应的垃圾收集器表单： 
 
 
 
 新生代 
 老年代 
 JVM参数 
 
 
 
 
 Serial 
 Serial 
 -XX:+UseSerialGC 
 
 
 Parallel Scavenge 
 Serial 
 -XX:+UseParallelGC -XX:-UseParallelOldGC 
 
 
 Parallel Scavenge 
 Parallel Old 
 -XX:+UseParallelGC -XX:+UseParallelOldGC 
 
 
 Parallel New 
 CMS 
 -XX:+UseParNewGC -XX:+UseConcMarkSweepGC 
 
 
 G1 
 
 -XX:+UseG1GC ### 堆内存是如何分配的？
 在堆中为对象分配内存时，主要使用两种策略：指针碰撞和空闲列表。 
 
 指针碰撞适用于管理简单、碎片化较少的内存区域，如年轻代；而空闲列表适用于内存碎片化较严重或对象大小差异较大的场景如老年代。 ### 什么是指针碰撞？
 假设堆内存是一个连续的空间，分为两个部分，一部分是已经被使用的内存，另一部分是未被使用的内存。 
 在分配内存时，Java 虚拟机会维护一个指针，指向下一个可用的内存地址，每次分配内存时，只需要将指针向后移动一段距离，如果没有发生碰撞，就将这段内存分配给对象实例。 ### 什么是空闲列表？
 JVM 维护一个列表，记录堆中所有未占用的内存块，每个内存块都记录有大小和地址信息。 
 当有新的对象请求内存时，JVM 会遍历空闲列表，寻找足够大的空间来存放新对象。 
 分配后，如果选中的内存块未被完全利用，剩余的部分会作为一个新的内存块加入到空闲列表中。 ### new 对象时，堆会发生抢占吗？
 会。 
 
 new 对象时，指针会向右移动一个对象大小的距离，假如一个线程 A 正在给字符串对象 s 分配内存，另外一个线程 B 同时为 ArrayList 对象 l 分配内存，两个线程就发生了抢占。 ### JVM 怎么解决堆内存分配的竞争问题？
 为了解决堆内存分配的竞争问题，JVM 为每个线程保留了一小块内存空间，被称为 TLAB，也就是线程本地分配缓冲区，用于存放该线程分配的对象。 
 
 当线程需要分配对象时，直接从 TLAB 中分配。只有当 TLAB 用尽或对象太大需要直接在堆中分配时，才会使用全局分配指针。 
 这里简单测试一下 TLAB。 
 可以通过 java -XX:+PrintFlagsFinal -version | grep TLAB 命令查看当前 JVM 是否开启了 TLAB。 
 
 如果开启了 TLAB，会看到类似以下的输出，其中 bool UseTLAB 的值为 true。 
 我们编写一个简单的测试类，创建大量对象并强制触发[[JVM 垃圾收集|垃圾回收]]，查看 TLAB 的使用情况。 
 class TLABDemo { 
 public static void main ( String [] args ) { 
 for ( int i = 0 ; i < 10_000_000 ; i ++) { 
 allocate (); // 创建大量对象 
 } 
 System . gc (); // 强制触发垃圾回收 
 } 
 
 private static void allocate () { 
 // 小对象分配，通常会使用 TLAB 
 byte [] bytes = new byte [ 64 ]; 
 } 
 } 
 在 VM 参数中添加 -XX:+UseTLAB -XX:+PrintTLAB -XX:+PrintGCDetails -XX:+PrintGCDateStamps ，运行后可以看到这样的内容： 
 
 
 waste：未使用的 TLAB 空间。 
 alloc：分配到 TLAB 的空间。 
 refills：TLAB 被重新填充的次数。 
 
 可以看到，当前线程的 TLAB 目标大小为 10,496 KB（ desired_size: 10496KB ）；未发生慢分配（ slow allocs: 0 ）；分配效率直接拉满（ alloc: 1.00000 52494KB ）。 
 当使用 -XX:-UseTLAB -XX:+PrintGCDetails 关闭 TLAB 时，会看到类似以下的输出： 
 
 直接出现了两次 GC，因为没有 TLAB，Eden 区更快被填满，导致年轻代 GC。年轻代 GC 频繁触发，一部分长生命周期对象被晋升到老年代，间接导致老年代 GC 触发。 ### 能说一下对象的内存布局吗？
 好的。 
 对象的内存布局是由 Java 虚拟机规范定义的，但具体的实现细节各有不同，如 HotSpot 和 OpenJ9 就不一样。 
 就拿我们常用的 HotSpot 来说吧。 
 对象在内存中包括三部分：对象头、实例数据和对齐填充。 ### 说说对象头的作用？
 对象头是对象存储在内存中的元信息，包含了Mark Word、类型指针等信息。 
 Mark Word 存储了对象的运行时状态信息，包括锁、哈希值、GC 标记等。在 64 位操作系统下占 8 个字节，32 位操作系统下占 4 个字节。 
 类型指针指向对象所属类的元数据，也就是 Class 对象，用来支持多态、方法调用等功能。 
 除此之外，如果对象是数组类型，还会有一个额外的数组长度字段。占 4 个字节。 ### 类型指针会被压缩吗？
 类型指针可能会被压缩，以节省内存空间。比如说在开启压缩指针的情况下占 4 个字节，否则占 8 个字节。在 JDK 8 中，压缩指针默认是开启的。 
 可以通过 java -XX:+PrintFlagsFinal -version | grep UseCompressedOops 命令来查看 JVM 是否开启了压缩指针。 
 
 如果压缩指针开启，输出结果中的 bool UseCompressedOops 值为 true。 ### 实例数据了解吗？
 了解一些。 
 实例数据是对象实际的字段值，也就是成员变量的值，按照字段在类中声明的顺序存储。 
 class ObjectDemo { 
 int age ; 
 String name ; 
 } 
 JVM 会对这些数据进行对齐/重排，以提高内存访问速度。 ### 对齐填充了解吗？
 由于 JVM 的内存模型要求对象的起始地址是 8 字节对齐（64 位 JVM 中），因此对象的总大小必须是 8 字节的倍数。 
 如果对象头和实例数据的总长度不是 8 的倍数，JVM 会通过填充额外的字节来对齐。 
 比如说，如果对象头 + 实例数据 = 14 字节，则需要填充 2 个字节，使总长度变为 16 字节。 ### 为什么非要进行 8 字节对齐呢？
 因为 CPU 进行内存访问时，一次寻址的指针大小是 8 字节，正好是 L1 缓存行的大小。如果不进行内存对齐，则可能出现跨缓存行访问，导致额外的缓存行加载，CPU 的访问效率就会降低。 
 
 比如说上图中 obj1 占 6 个字节，由于没有对齐，导致这一行缓存中多了 2 个字节 obj2 的数据，当 CPU 访问 obj2 的时候，就会导致缓存行刷新。 
 也就说，8 字节对齐，是为了效率的提高，以空间换时间的一种方案。 ### new Object() 对象的内存大小是多少？
 一般来说，目前的操作系统都是 64 位的，并且 JDK 8 中的压缩指针是默认开启的，因此在 64 位的 JVM 上， new Object() 的大小是 16 字节（12 字节的对象头 + 4 字节的对齐填充）。 
 
 对象头的大小是固定的，在 32 位 JVM 上是 8 字节，在 64 位 JVM 上是 16 字节；如果开启了压缩指针，就是 12 字节。 
 实例数据的大小取决于对象的成员变量和它们的类型。对于 new Object() 来说，由于默认没有成员变量，因此我们可以认为此时的实例数据大小是 0。 
 假如 MyObject 对象有三个成员变量，分别是 int、long 和 byte 类型，那么它们占用的内存大小分别是 4 字节、8 字节和 1 字节。 
 class MyObject { 
 int a ; // 4 字节 
 long b ; // 8 字节 
 byte c ; // 1 字节 
 } 
 考虑到对齐填充，MyObject 对象的总大小为 12（对象头） + 4（a） + 8（b） + 1（c） + 7（填充） = 32 字节。 ### 用过 JOL 查看对象的内存布局吗？
 用过。 
 JOL 是一款分析 JVM 对象布局的工具。 
 第一步，在 pom.xml 中引入 JOL 依赖： 
 < dependency > 
 < groupId >org.openjdk.jol</ groupId > 
 < artifactId >jol-core</ artifactId > 
 < version >0.9</ version > 
 </ dependency > 
 第二步，使用 JOL 编写代码示例： 
 public class JOLSample { 
 public static void main ( String [] args ) { 
 // 打印JVM详细信息（可选） 
 System . out . println ( VM . current (). details ()); 
 
 // 创建Object实例 
 Object obj = new Object (); 
 
 // 打印Object实例的内存布局 
 String layout = ClassLayout . parseInstance ( obj ). toPrintable (); 
 System . out . println ( layout ); 
 } 
 } 
 第三步，运行代码，查看输出结果： 
 
 可以看到有 OFFSET、SIZE、TYPE DESCRIPTION、VALUE 这几个信息。 
 
 OFFSET：偏移地址，单位字节； 
 SIZE：占用的内存大小，单位字节； 
 TYPE DESCRIPTION：类型描述，其中 object header 为对象头； 
 VALUE：对应内存中当前存储的值，二进制 32 位； 
 
 从上面的结果能看到，对象头是 12 个字节，还有 4 个字节的 padding， new Object() 一共 16 个字节。 ### 对象的引用大小了解吗？
 在 64 位 JVM 上，未开启压缩指针时，对象引用占用 8 字节；开启压缩指针时，对象引用会被压缩到 4 字节。HotSpot 虚拟机默认是开启压缩指针的。 
 
 我们来验证一下： 
 class ReferenceSizeExample { 
 private static class ReferenceHolder { 
 Object reference ; 
 } 
 
 public static void main ( String [] args ) { 
 System . out . println ( VM . current (). details ()); 
 System . out . println ( ClassLayout . parseClass ( ReferenceHolder . class ). toPrintable ()); 
 } 
 } 
 运行代码，查看输出结果： 
 
 ReferenceHolder.reference 的大小为 4 字节。 ### JVM 怎么访问对象的？
 主流的方式有两种：句柄和直接指针。 
 两种方式的区别在于，句柄是通过一个中间的句柄表来定位对象的，而直接指针则是通过引用直接指向对象的内存地址。 
 优点是，对象被移动时只需要修改句柄表中的指针，而不需要修改对象引用本身。 
 
 在直接指针访问中，引用直接存储对象的内存地址；对象的实例数据和类型信息都存储在堆中固定的内存区域。 
 优点是访问速度更快，因为少了一次句柄的寻址操作。缺点是如果对象在内存中移动，引用需要更新为新的地址。 
 
 HotSpot 虚拟机主要使用直接指针来进行对象访问。 ### 说一下对象有哪几种引用？
 四种，分别是强引用、软引用、弱引用和虚引用。 
 
 强引用是 Java 中最常见的引用类型。使用 new 关键字赋值的引用就是强引用，只要强引用关联着对象，垃圾收集器就不会回收这部分对象，即使内存不足。 
 // str 就是一个强引用 
 String str = new String ( "沉默王二" ); 
 软引用于描述一些非必须对象，通过 SoftReference 类实现。软引用的对象在内存不足时会被回收。 
 // softRef 就是一个软引用 
 SoftReference < String > softRef = new SoftReference <>( new String ( "沉默王二" )); 
 弱引用用于描述一些短生命周期的非必须对象，如 [[线程基础与ThreadLocal|ThreadLocal]] 中的 Entry，就是通过 WeakReference 类实现的。弱引用的对象会在下一次垃圾回收时会被回收，不论内存是否充足。 
 static class Entry extends WeakReference < ThreadLocal <?>> { 
 /** The value associated with this ThreadLocal . */ 
 Object value ; 
 
 //节点类 
 Entry ( ThreadLocal <?> k , Object v ) { 
 //key赋值 
 super ( k ); 
 //value赋值 
 value = v ; 
 } 
 } 
 虚引用主要用来跟踪对象被垃圾回收的过程，通过 PhantomReference 类实现。虚引用的对象在任何时候都可能被回收。 
 // phantomRef 就是一个虚引用 
 PhantomReference < String > phantomRef = new PhantomReference <>( new String ( "沉默王二" ), new ReferenceQueue <>()); ### Java 堆的内存分区了解吗？
 了解。Java 堆被划分为 新生代 和 老年代 两个区域。 
 
 新生代又被划分为 Eden 空间和两个 Survivor 空间（From 和 To）。 
 新创建的对象会被分配到 Eden 空间。当 Eden 区填满时，会触发一次 Minor GC，清除不再使用的对象。存活下来的对象会从 Eden 区移动到 Survivor 区。 
 对象在新生代中经历多次 GC 后，如果仍然存活，会被移动到老年代。当老年代内存不足时，会触发 Major GC，对整个堆进行垃圾回收。 ### 说一下新生代的区域划分？
 新生代的垃圾收集主要采用标记-复制算法，因为新生代的存活对象比较少，每次复制少量的存活对象效率比较高。 
 基于这种算法，虚拟机将内存分为一块较大的 Eden 空间和两块较小的 Survivor 空间，每次分配内存只使用 Eden 和其中一块 Survivor。发生垃圾收集时，将 Eden 和 Survivor 中仍然存活的对象一次性复制到另外一块 Survivor 空间上，然后直接清理掉 Eden 和已用过的那块 Survivor 空间。默认 Eden 和 Survivor 的大小比例是 8∶1。 ### 🌟对象什么时候会进入老年代？
 对象通常会在年轻代中分配，随着时间的推移和垃圾收集的进程，某些满足条件的对象会进入到老年代中，如长期存活的对象。 ### 长期存活的对象如何判断？
 JVM 会为对象维护一个“年龄”计数器，记录对象在新生代中经历 Minor GC 的次数。每次 GC 未被回收的对象，其年龄会加 1。 
 当超过一个特定阈值，默认值是 15，就会被认为老对象了，需要重点关照。这个年龄阈值可以通过 JVM 参数 -XX:MaxTenuringThreshold 来设置。 
 可以通过 jinfo -flag MaxTenuringThreshold $(jps | grep -i nacos | awk '{print $1}') 来查看当前 JVM 的年龄阈值。 
 
 
 如果应用中的对象存活时间较短，可以适当调大这个值，让对象在新生代多待一会儿 
 如果对象存活时间较长，可以适当调小这个值，让对象更快进入老年代，减少在新生代的复制次数 ### 大对象如何判断？
 大对象是指占用内存较大的对象，如大数组、长字符串等。 
 int [] array = new int [ 1000000 ]; 
 String str = new String ( new char [ 1000000 ]); 
 其大小由 JVM 参数 -XX:PretenureSizeThreshold 控制，但在 JDK 8 中，默认值为 0，也就是说默认情况下，对象仅根据 GC 存活的次数来判断是否进入老年代。 
 
 G1 垃圾收集器中，大对象会直接分配到 HUMONGOUS 区域。当对象大小超过一个 Region 容量的 50% 时，会被认为是大对象。 
 
 Region 的大小可以通过 JVM 参数 -XX:G1HeapRegionSize 来设置，默认情况下从 1MB 到 32MB 不等，会根据堆内存大小动态调整。 
 可以通过 java -XX:+UseG1GC -XX:+PrintGCDetails -version 查看 G1 垃圾收集器的相关信息。 
 
 从结果上来看，我本机上 G1 的堆大小为 2GB，Region 的大小为 4MB。 ### 动态年龄判定了解吗？
 如果 Survivor 区中所有对象的总大小超过了一定比例，通常是 Survivor 区的一半，那么年龄较小的对象也可能会被提前晋升到老年代。 
 这是因为如果年龄较小的对象在 Survivor 区中占用了较大的空间，会导致 Survivor 区中的对象复制次数增多，影响垃圾回收的效率。 ### STW 了解吗？
 了解。 
 JVM 进行垃圾回收的过程中，会涉及到对象的移动，为了保证对象引用在移动过程中不被修改，必须暂停所有的用户线程，像这样的停顿，我们称之为 Stop The World 。简称 STW。 ### 如何暂停线程呢？
 JVM 会使用一个名为安全点（Safe Point）的机制来确保线程能够被安全地暂停，其过程包括四个步骤： 
 
 JVM 发出暂停信号； 
 线程执行到安全点后，挂起自身并等待垃圾收集完成； 
 垃圾回收器完成 GC 操作； ### 线程恢复执行。 
 
 
 
 什么是安全点？
 安全点是 JVM 的一种机制，常用于垃圾回收的 STW 操作，用于让线程在执行到某些特定位置时，可以被安全地暂停。 
 通常位于方法调用、循环跳转、异常处理等位置，以保证线程暂停时数据的一致性。 
 用个通俗的比喻，老王去拉车，车上的东西很重，老王累的汗流浃背，但是老王不能在上坡或者下坡时休息，只能在平地上停下来擦擦汗，喝口水。 
 
 推荐大家看看这个 HotSpot JVM Deep Dive - Safepoint ，对 safe point 有一个比较深入地解释。 ### 对象一定分配在堆中吗？
 不一定。 
 默认情况下，Java 对象是在堆中分配的，但 JVM 会进行逃逸分析，来判断对象的生命周期是否只在方法内部，如果是的话，这个对象可以在栈上分配。 
 举例来说，下面的代码中，对象 new Person() 的生命周期只在 testStackAllocation 方法内部，因此 JVM 会将这个对象分配在栈上。 
 public void testStackAllocation () { 
 Person p = new Person (); // 对象可能分配在栈上 
 p . name = "沉默王二是只狗" ; 
 p . age = 18 ; 
 System . out . println ( p . name ); ### } 
 
 什么是逃逸分析？
 逃逸分析是一种 JVM 优化技术，用来分析对象的作用域和生命周期，判断对象是否逃逸出方法或线程。 
 可以通过分析对象的引用流向，判断对象是否被方法返回、赋值到全局变量、传递到其他线程等，来确定对象是否逃逸。 
 如果对象没有逃逸，就可以进行栈上分配、同步消除、标量替换等优化，以提高程序的性能。 
 可以通过 java -XX:+PrintFlagsFinal -version | grep DoEscapeAnalysis 来确认 JVM 是否开启了逃逸分析。 ### 逃逸具体是指什么？
 根据对象逃逸的范围，可以分为方法逃逸和线程逃逸。 
 当对象被方法外部的代码引用，生命周期超出了方法的范围，那么对象就必须分配在堆中，由垃圾收集器管理。 
 public Person createPerson () { 
 return new Person (); // 对象逃逸出方法 
 } 
 比如说 new Person() 创建的对象被返回，那么这个对象就逃逸出当前方法了。 
 
 再比如说，对象被另外一个线程引用，生命周期超出了当前线程，那么对象就必须分配在堆中，并且线程之间需要同步。 
 public void threadEscapeExample () { 
 Person p = new Person (); // 对象逃逸到另一个线程 
 new Thread (() -> { 
 System . out . println ( p ); 
 }). start (); 
 } 
 对象 new Person() 被另外一个线程引用了，发生了线程逃逸。 ### 逃逸分析会带来什么好处？
 主要有三个。 
 第一，如果确定一个对象不会逃逸，那么就可以考虑栈上分配，对象占用的内存随着栈帧出栈后销毁，这样一来，垃圾收集的压力就降低很多。 
 第二，线程同步需要加锁，加锁就要占用系统资源，如果逃逸分析能够确定一个对象不会逃逸出线程，那么这个对象就不用加锁，从而减少线程同步的开销。 
 第三，如果对象的字段在方法中独立使用，JVM 可以将对象分解为标量变量，避免对象分配。 
 public void scalarReplacementExample () { 
 Point p = new Point ( 1 , 2 ); 
 System . out . println ( p . getX () + p . getY ()); 
 } 
 如果 Point 对象未逃逸，JVM 可以优化为： 
 int x = 1 ; 
 int y = 2 ; 
 System . out . println ( x + y ); ### 内存溢出和内存泄漏了解吗？
 内存溢出，俗称 OOM，是指当程序请求分配内存时，由于没有足够的内存空间，从而抛出 OutOfMemoryError。 
 List < String > list = new ArrayList <>(); 
 while ( true ) { 
 list . add ( "OutOfMemory" . repeat ( 1000 )); // 无限增加内存 
 } 
 可能是因为堆、元空间、栈或直接内存不足导致的。可以通过优化内存配置、减少对象分配来解决。 
 内存泄漏是指程序在使用完内存后，未能及时释放，导致占用的内存无法再被使用。随着时间的推移，内存泄漏会导致可用内存逐渐减少，最终导致内存溢出。 
 内存泄漏通常是因为长期存活的对象持有短期存活对象的引用，又没有及时释放，从而导致短期存活对象无法被回收而导致的。 
 class MemoryLeakExample { 
 private static List < Object > staticList = new ArrayList <>(); 
 public void addObject () { 
 staticList . add ( new Object ()); // 对象不会被回收 
 } 
 } 
 用一个比较有味道的比喻来形容就是，内存溢出是排队去蹲坑，发现没坑了；内存泄漏，就是有人占着茅坑不拉屎，导致坑位不够用。 ### 能手写内存溢出的例子吗？
 可以。 
 我就拿最常见的堆内存溢出来完成吧，堆内存溢出通常是因为创建了大量的对象，且长时间无法被垃圾收集器回收，导致的。 
 class HeapSpaceErrorGenerator { 
 public static void main ( String [] args ) { 
 // 第一步，创建一个大的容器 
 List < byte []> bigObjects = new ArrayList <>(); 
 try { 
 // 第二步，循环写入数据 
 while ( true ) { 
 // 第三步，创建一个大对象，一个大约 10M 的数组 
 byte [] bigObject = new byte [ 10 * 1024 * 1024 ]; 
 // 第四步，将大对象添加到容器中 
 bigObjects . add ( bigObject ); 
 } 
 } catch ( OutOfMemoryError e ) { 
 System . out . println ( "OutOfMemoryError 发生在 " + bigObjects . size () + " 对象后" ); 
 throw e ; 
 } 
 } 
 } 
 很快就会发生内存溢出。 
 这就相当于一个房子里，不断堆积不能被回收的杂物，那么房子很快就会被堆满了。 
 也可以通过 VM 参数设置堆内存大小为 -Xmx128M ，然后运行程序，出现的内存溢出的时间会更快。 
 
 可以看到，堆内存溢出发生在 11 个对象后。 ### 内存泄漏可能由哪些原因导致呢？
 比如说： 
 ①、静态的集合中添加的对象越来越多，但却没有及时清理；静态变量的生命周期与应用程序相同，如果静态变量持有对象的引用，这些对象将无法被 GC 回收。 
 class OOM { 
 static List list = new ArrayList (); 
 
 public void oomTests (){ 
 Object obj = new Object (); 
 
 list . add ( obj ); 
 } 
 } 
 ②、单例模式下对象持有的外部引用无法及时释放；单例对象在整个应用程序的生命周期中存活，如果单例对象持有其他对象的引用，这些对象将无法被回收。 
 class Singleton { 
 private static final Singleton INSTANCE = new Singleton (); 
 private List < Object > objects = new ArrayList <>(); 
 
 public static Singleton getInstance () { 
 return INSTANCE ; 
 } 
 } 
 ③、数据库、IO、Socket 等连接资源没有及时关闭； 
 try { 
 Connection conn = null ; 
 Class . forName ( "com.mysql.jdbc.Driver" ); 
 conn = DriverManager . getConnection ( "url" , "" , "" ); 
 Statement stmt = conn . createStatement (); 
 ResultSet rs = stmt . executeQuery ( "...." ); 
 } catch ( Exception e ) { 
 
 } finally { 
 //不关闭连接 
 } 
 ④、 ThreadLocal 的引用未被清理，线程退出后仍然持有对象引用；在线程执行完后，要调用 ThreadLocal 的 remove 方法进行清理。 
 ThreadLocal < Object > threadLocal = new ThreadLocal <>(); 
 threadLocal . set ( new Object ()); // 未清理 ### 有没有处理过内存泄漏问题？
 一次内存溢出的排查优化实战 
 JVM 性能监控工具之命令行篇 
 JVM 性能监控工具之可视化篇 
 
 有。 
 当时在做 技术派 项目的时候，由于 ThreadLocal 没有及时清理导致出现了内存泄漏问题。 
 我用可视化的监控工具 VisualVM，配合 JDK 自带的 jstack 等命令行工具进行了排查。 
 大致的过程我回想了一下，主要有 7 个步骤： 
 第一步，使用 jps -l 查看运行的 Java 进程 ID。 
 
 第二步，使用 top -p [pid] 查看进程使用 CPU 和内存占用情况。 
 
 第三步，使用 top -Hp [pid] 查看进程下的所有线程占用 CPU 和内存情况。 
 
 第四步，抓取线程栈： jstack -F 29452 > 29452.txt ，可以多抓几次做个对比。 
 
 29452 为 pid，顺带作为文件名。 
 
 
 看看有没有线程[[锁|死锁]]、死循环或长时间等待这些问题。 
 
 第五步，可以使用 jstat -gcutil [pid] 5000 10 每隔 5 秒输出 GC 信息，输出 10 次，查看 YGC 和 Full GC 次数。 
 
 通常会出现 YGC 不增加或增加缓慢，而 Full GC 增加很快。 
 或使用 jstat -gccause [pid] 5000 输出 GC 摘要信息。 
 
 或使用 jmap -heap [pid] 查看堆的摘要信息，关注老年代内存使用是否达到阀值，若达到阀值就会执行 Full GC。 
 
 如果发现 Full GC 次数太多，就很大概率存在内存泄漏了。 
 第六步，生成 dump 文件，然后借助可视化工具分析哪个对象非常多，基本就能定位到问题根源了。 
 执行命令 jmap -dump:format=b,file=heap.hprof 10025 会输出进程 10025 的堆快照信息，保存到文件 heap.hprof 中。 
 
 第七步，使用图形化工具分析，如 JDK 自带的 VisualVM ，从菜单 > 文件 > 装入 dump 文件。 
 
 然后在结果观察内存占用最多的对象，找到内存泄漏的源头。 ### 有没有处理过内存溢出问题？
 有。 
 当时在做 技术派 的时候，由于上传的文件过大，没有正确处理，导致一下子撑爆了内存，程序直接崩溃了。 
 我记得是通过导出堆转储文件进行分析发现的。 
 第一步，使用 jmap 命令手动生成 Heap Dump 文件： 
 jmap -dump:format = b,file=heap.hprof < pid > 
 然后使用 MAT、JProfiler 等工具进行分析，查看内存中的对象占用情况。 
 一般来说： 
 如果生产环境的内存还有很多空余，可以适当增大堆内存大小来解决，例如 -Xmx4g 参数。 
 或者检查代码中是否存在内存泄漏，如未关闭的资源、长生命周期的对象等。 
 之后，在本地进行压力测试，模拟高负载情况下的内存表现，确保修改有效，且没有引入新的问题。 
 
 
 
 
 
 
 22.什么情况下会发生栈溢出？（补充） 
 
 2024 年 10 月 16 日增补 
 
 栈溢出发生在程序调用栈的深度超过 JVM 允许的最大深度时。 
 栈溢出的本质是因为线程的栈空间不足，导致无法再为新的栈帧分配内存。 
 
 当一个方法被调用时，JVM 会在栈中分配一个栈帧，用于存储该方法的执行信息。如果方法调用嵌套太深，栈帧不断压入栈中，最终会导致栈空间耗尽，抛出 StackOverflowError。 
 最常见的栈溢出场景就是递归调用，尤其是没有正确的终止条件下，会导致递归无限进行。 
 class StackOverflowExample { 
 public static void recursiveMethod () { 
 // 没有终止条件的递归调用 
 recursiveMethod (); 
 } 
 
 public static void main ( String [] args ) { 
 recursiveMethod (); // 导致栈溢出 
 } 
 } 
 另外，如果方法中定义了特别大的局部变量，栈帧会变得很大，导致栈空间更容易耗尽。 
 public class LargeLocalVariables { 
 public static void method () { 
 int [] largeArray = new int [ 1000000 ]; // 大量局部变量 
 method (); // 递归调用 
 } 
 
 public static void main ( String [] args ) { 
 method (); // 导致栈溢出 
 } 
 }
