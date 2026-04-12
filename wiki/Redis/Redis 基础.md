> 来源文件：raw/files/面渣逆袭Redis篇V2.0.epub
> 正文位置：EPUB/text/ch001.xhtml
> 导航位置：EPUB/nav.xhtml
> 导入方式：自动抽取（待你后续精修）### 🌟说说什么是 Redis? 
 Redis 是一种基于键值对的 NoSQL 数据库。 
 
 它主要的特点是把数据放在内存当中，相比直接访问磁盘的关系型数据库，读写速度会快很多，基本上能达到微秒级的响应。 
 所以在一些对性能要求很高的场景，比如缓存热点数据、防止接口爆刷，都会用到 Redis。 
 不仅如此，Redis 还支持持久化，可以将内存中的数据异步落盘，以便服务宕机重启后能恢复数据。 
 
 Redis 和 MySQL 的区别？ 
 Redis 属于非关系型数据库，数据是通过键值对的形式放在内存当中的；MySQL 属于关系型数据库，数据以行和列的形式存储在磁盘当中。 
 
 实际开发中，会将 MySQL 作为主存储，Redis 作为缓存，通过先查 Redis，未命中再查 MySQL 并写回Redis 的方式来提高系统的整体性能。 
 
 
 项目里哪里用到了 Redis？ 
 在 技术派实战项目 当中，有很多地方都用到了 Redis，比如说用户活跃排行榜用到了 zset，作者白名单用到了 set。 
 
 还有用户登录后的 Session、站点地图 SiteMap，分别用到了 Redis 的字符串和哈希表两种数据类型。 
 
 其中比较有挑战性的一个应用是，通过 Lua 脚本封装 Redis 的 setnex 命令来实现分布式锁，以保证在高并发场景下，热点文章在短时间内的高频访问不会击穿 MySQL。 
 
 
 
 部署过 Redis 吗？ 
 第一种回答版本： 
 我只在本地部署过单机版，下载 Redis 的安装包，解压后运行 redis-server 命令即可。 
 第二种回答版本： 
 我有在生产环境中部署单机版 Redis，从官网下载源码包解压后执行 make && make install 编译安装。然后编辑 redis.conf 文件，开启远程访问、设置密码、限制内存、设置内存过期淘汰策略、开启 AOF 持久化等： 
 bind 0.0.0.0 # 允许远程访问
requirepass your_password # 设置密码
maxmemory 4gb # 限制内存，避免 OOM
maxmemory-policy allkeys-lru # 内存淘汰策略
appendonly yes # 开启 AOF 持久化 
 第三种回答版本： 
 我有使用 Docker 拉取 Redis 镜像后进行容器化部署。 
 docker run -d --name redis -p 6379:6379 redis:7.0-alpine 
 
 
 Redis 的高可用方案有部署过吗？ 
 有部署过哨兵机制，这是一个相对成熟的高可用解决方案，我们生产环境部署的是一主两从的 Redis 实例，再加上三个 Sentinel 节点监控它们。Sentinel 的配置相对简单，主要设置了故障转移的判定条件和超时阈值。 
 主节点配置： 
 port 6379 
 appendonly yes 
 从节点配置： 
 replicaof 192.168.1.10 6379 
 哨兵节点配置： 
 sentinel monitor mymaster 192.168.1.10 6379 2 
 sentinel down-after-milliseconds mymaster 5000 
 sentinel failover-timeout mymaster 60000 
 sentinel parallel-syncs mymaster 1 
 当主节点发生故障时，Sentinel 能够自动检测并协商选出新的主节点，这个过程大概需要 10-15 秒。 
 另一个大型项目中，我们使用了 Redis Cluster 集群方案。该项目数据量大且增长快，需要水平扩展能力。我们部署了 6 个主节点，每个主节点配备一个从节点，形成了一个 3主3从 的初始集群。Redis Cluster 的设置比 Sentinel 复杂一些，需要正确配置集群节点间通信、分片映射等。 
 redis-server redis-7000.conf 
 redis-server redis-7001.conf 
 ... 
 
 # 使用 redis-cli 创建集群 
 # Redis 会自动将 key 哈希到 16384 个槽位 
 # 主节点均分槽位，从节点自动跟随 
 redis-cli --cluster create \ ### 0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \ ### 0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \ 
 --cluster-replicas 1 
 Redis Cluster 最大的优势是数据自动分片，我们可以通过简单地增加节点来扩展集群容量。此外，它的故障转移也很快，通常在几秒内就能完成。 
 对于一些轻量级应用，我也使用过主从复制加手动故障转移的方案。主节点负责读写操作，从节点负责读操作。手动故障转移时，我们会先将从节点提升为主节点，然后重新配置其他从节点。 
 # 1. 取消从节点身份 
 redis-cli -h < slave-ip > slaveof no one 
 
 # 2. 将其他从节点指向新的主节点 
 redis-cli -h < other-slave-ip > slaveof < new-master-ip > < port > ### Redis 可以用来干什么？ 
 Redis 可以用来做缓存，比如说把高频访问的文章详情、商品信息、用户信息放入 Redis 当中，并通过设置过期时间来保证数据一致性，这样就可以减轻数据库的访问压力。 
 
 Redis 的 Zset 还可以用来实现积分榜、热搜榜，通过 score 字段进行排序，然后取前 N 个元素，就能实现 TOPN 的榜单功能。 
 
 利用 Redis 的 SETNX 命令或者 Redisson 还可以实现分布式锁，确保同一时间只有一个节点可以持有锁；为了防止出现死锁，可以给锁设置一个超时时间，到期后自动释放；并且最好开启一个监听线程，当任务尚未完成时给锁自动续期。 
 
 如果是秒杀接口，还可以使用 Lua 脚本来实现令牌桶算法，限制每秒只能处理 N 个请求。 
 -- KEYS[1]: 令牌桶的key 
 -- ARGV[1]: 桶容量 
 -- ARGV[2]: 令牌生成速率（每秒） 
 -- ARGV[3]: 当前时间戳（秒） 
 
 local bucket = redis . call ( 'HMGET' , KEYS [ 1 ], 'tokens' , 'timestamp' ) 
 local tokens = tonumber ( bucket [ 1 ]) or ARGV [ 1 ] 
 local last_time = tonumber ( bucket [ 2 ]) or ARGV [ 3 ] 
 
 local rate = tonumber ( ARGV [ 2 ]) 
 local capacity = tonumber ( ARGV [ 1 ]) 
 local now = tonumber ( ARGV [ 3 ]) 
 
 -- 计算新令牌数 
 local delta = math.max ( 0 , now - last_time ) 
 local add_tokens = delta * rate 
 tokens = math.min ( capacity , tokens + add_tokens ) 
 last_time = now 
 
 local allowed = 0 
 if tokens >= 1 then 
 tokens = tokens - 1 
 allowed = 1 
 end 
 
 redis . call ( 'HMSET' , KEYS [ 1 ], 'tokens' , tokens , 'timestamp' , last_time ) 
 redis . call ( 'EXPIRE' , KEYS [ 1 ], 3600 ) -- 过期时间可自定义 
 
 return allowed 
 在 Java 中调用 Lua 脚本： 
 // 令牌桶参数 
 int capacity = 10 ; // 桶容量 
 int rate = 2 ; // 每秒2个令牌 
 long now = System . currentTimeMillis () / 1000 ; 
 String key = "token_bucket:user:123" ; 
 
 // 调用 Lua 脚本，返回 1 表示通过，0 表示被限流 
 Long allowed = ( Long ) redis . eval ( luaScript , 1 , key , String . valueOf ( capacity ), String . valueOf ( rate ), String . valueOf ( now )); ### 🌟Redis有哪些数据类型？ 
 Redis 支持五种基本数据类型，分别是字符串、列表、哈希、集合和有序集合。 
 
 还有三种扩展数据类型，分别是用于位级操作的 Bitmap、用于基数估算的 HyperLogLog、支持存储和查询地理坐标的 GEO。 
 
 详细介绍下字符串？ 
 字符串是最基本的数据类型，可以存储文本、数字或者二进制数据，最大容量是 512 MB。 
 
 适合缓存单个对象，比如验证码、token、计数器等。 
 
 
 详细介绍下列表？ 
 列表是一个有序的元素集合，支持从头部或尾部插入/删除元素，常用于消息队列或任务列表。 
 
 
 
 详细介绍下哈希？ 
 哈希是一个键值对集合，适合存储对象，如商品信息、用户信息等。比如说 value = {name: '沉默王二', age: 18} 。 
 
 
 
 详细介绍下集合？ 
 集合是无序且不重复的，支持交集、并集操作，查询效率能达到 O(1) 级别，主要用于去重、标签、共同好友等场景。 
 
 
 
 详细介绍下有序集合？ 
 有序集合的元素按分数进行排序，支持范围查询，适用于排行榜或优先级队列。 
 
 
 
 详细介绍下Bitmap？ 
 Bitmap 可以把一组二进制位紧凑地存储在一块连续内存中，每一位代表一个对象的状态，比如是否签到、是否活跃等。 
 
 比如用户 0 的已签到 1、用户 1 未签到 0、用户 2 已签到，Redis 就会把这些状态放进一个连续的二进制串 101 ，1 亿用户签到仅需 100,000,000 / 8 / 1024 ≈ 12MB 的空间，真的省到离谱。 
 
 
 详细介绍下HyperLogLog？ 
 HyperLogLog 是一种用于基数统计的概率性数据结构，可以在仅有 12KB 的内存空间下，统计海量数据集中不重复元素的个数，误差率仅 0.81%。 
 
 底层基于 LogLog 算法改进，先把每个元素哈希成一个二进制串，然后取前 14 位进行分组，放到 16384 个桶中，记录每组最大的前导零数量，最后用一个近似公式推算出总体的基数。 
 
 
 $2^{14}$个桶，每个桶 6 Bit，刚好 16384 * 6 /8 / 1024 K = 12KB ，8 bit = 1 byte。 
 
 举个超简单的例子，假设有一个神奇的哈希函数，可以把元素散列成一个二进制数，比如： 
 
 
 
 元素 
 哈希值 
 前导零个数 
 
 
 
 
 userA 
 000100101… 
 3 
 
 
 userB 
 001010011… 
 2 
 
 
 userC 
 000000101… 
 6 
 
 
 
 可以发现，哈希值越长前导零越多，也就说明集合里的元素越多。 
 大型网站 UV 统计系统示例： 
 public class UVCounter { 
 private Jedis jedis ; 
 
 public void recordVisit ( String date , String userId ) { 
 String key = "uv:" + date ; 
 jedis . pfadd ( key , userId ); 
 } 
 
 public long getUV ( String date ) { 
 return jedis . pfcount ( "uv:" + date ); 
 } 
 
 public long getUVBetween ( String startDate , String endDate ) { 
 List < String > keys = getDateKeys ( startDate , endDate ); 
 return jedis . pfcount ( keys . toArray ( new String [ 0 ])); 
 } 
 } 
 
 
 详细介绍下GEO？ 
 GEO 用于存储和查询地理位置信息，可以用来计算两点之间的距离，查找某位置半径内的其他元素。 
 常见的应用场景包括：附近的人或者商家、计算外卖员和商家的距离、判断用户是否进入某个区域等。 
 底层基于 ZSet 实现，通过 Geohash 算法把经纬度编码成 score。 
 
 比如说查询附近的商家时，Redis 会根据中心点经纬度反推可能的 Geohash 范围， 
在 ZSet 上做范围查询，拿到候选点后，用 Haversine 公式精确计算球面距离，筛选出最终符合要求的位置。 
 public class NearbyShopService { 
 private Jedis jedis ; 
 private static final String SHOP_KEY = "shops:geo" ; 
 
 // 添加商铺 
 public void addShop ( String shopId , double longitude , double latitude ) { 
 jedis . geoadd ( SHOP_KEY , longitude , latitude , shopId ); 
 } 
 
 // 查询附近的商铺 
 public List < GeoRadiusResponse > getNearbyShops ( 
 double longitude , 
 double latitude , 
 double radiusKm ) { 
 return jedis . georadius ( SHOP_KEY , 
 longitude , 
 latitude , 
 radiusKm , 
 GeoUnit . KM , 
 GeoRadiusParam . geoRadiusParam () 
 . withCoord () 
 . withDist () 
 . sortAscending () 
 . count ( 20 )); 
 } 
 
 // 计算两个商铺之间的距离 
 public double getShopDistance ( String shop1Id , String shop2Id ) { 
 return jedis . geodist ( SHOP_KEY , 
 shop1Id , 
 shop2Id , 
 GeoUnit . KILOMETERS ); 
 } 
 } 
 
 
 为什么使用 hash 类型而不使用 string 类型序列化存储？ 
 Hash 可以只读取或者修改某一个字段，而 String 需要一次性把整个对象取出来。 
 
 比如说有一个用户对象 user = {name: '沉默王二', age: 18} ，如果使用 Hash 存储，可以直接修改 age 字段： 
 redis . hset ( "user:1" , "age" , 19 ); 
 如果使用 String 存储，需要先取出整个对象，修改后再存回去： 
 String userJson = redis . get ( "user:1" ); 
 User user = JSON . parseObject ( userJson , User . class ); 
 user . setAge ( 19 ); 
 redis . set ( "user:1" , JSON . toJSONString ( user )); ### 🌟Redis 为什么快呢？ 
 第一，Redis 的所有数据都放在内存中，而内存的读写速度本身就比磁盘快几个数量级。 
 
 第二，Redis 采用了基于 IO 多路复用技术的事件驱动模型来处理客户端请求和执行 Redis 命令。 
 
 其中的 IO 多路复用技术可以在只有一个线程的情况下，同时监听成千上万个客户端连接，解决传统 IO 模型中每个连接都需要一个独立线程带来的性能开销。 
 
 IO 多路复用会持续监听请求，然后把准备好的请求压入到一个队列当中，并将其有序地传递给文件事件分派器，最后由事件处理器来执行对应的 accept、read 和 write 请求。 
 
 Redis 会根据操作系统选择最优的 IO 多路复用技术，比如 Linux 下使用 epoll，macOS 下使用 kqueue 等。 
 // epoll 的创建和使用 
 int epfd = epoll_create ( 1024 ); // 创建 epoll 实例 
 struct epoll_event ev , events [ MAX_EVENTS ]; 
 
 // 添加监听事件 
 ev . events = EPOLLIN ; 
 ev . data . fd = listen_sock ; 
 epoll_ctl ( epfd , EPOLL_CTL_ADD , listen_sock , & ev ); 
 
 // 等待事件发生 
 while ( 1 ) { 
 int nfds = epoll_wait ( epfd , events , MAX_EVENTS , - 1 ); 
 for ( int i = 0 ; i < nfds ; i ++) { 
 // 处理就绪的文件描述符 
 } 
 } 
 在 Redis 6.0 之前，包括连接建立、请求读取、响应发送，以及命令执行都是在主线程中顺序执行的，这样可以避免多线程环境下的锁竞争和上下文切换，因为 Redis 的绝大部分操作都是在内存中进行的，性能瓶颈主要是内存操作和网络通信，而不是 CPU。 
 
 为了进一步解决网络 IO 的性能瓶颈，Redis 6.0 引入了多线程机制，把网络 IO 和命令执行分开，网络 IO 交给线程池来处理，而命令执行仍然在主线程中进行，这样就可以充分利用多核 CPU 的性能。 
 
 主线程专注于命令执行，网络IO 由其他线程分担，在多核 CPU 环境下，Redis 的性能可以得到显著提升。 
 
 第三，Redis 对底层数据结构做了极致的优化，比如说 String 的底层数据结构动态字符串支持动态扩容、预分配冗余空间，能够减少内存碎片和内存分配的开销。 
 
 总结： ### 能详细说一下IO多路复用吗？ 
 IO 多路复用是一种允许单个进程同时监视多个文件描述符的技术，使得程序能够高效处理多个并发连接而无需创建大量线程。 
 
 IO 多路复用的核心思想是：让单个线程可以等待多个文件描述符就绪，然后对就绪的描述符进行操作。这样可以在不使用多线程或多进程的情况下处理并发连接。 
 
 主要的实现机制包括 select、poll、epoll、kqueue 和 IOCP 等。 
 
 请说说 select、poll、epoll、kqueue 和 IOCP 的区别？ 
 select 的缺点是单个进程能监视的文件描述符数量有限，一般为 1024 个，且每次调用都需要将文件描述符集合从用户态复制到内核态，然后遍历找出就绪的描述符，性能较差。 
 // select 的基本使用 
 int select ( int nfds , fd_set * readfds , fd_set * writefds , 
 fd_set * exceptfds , struct timeval * timeout ); 
 
 // 示例代码 
 fd_set readfds ; 
 FD_ZERO (& readfds ); // 清空集合 
 FD_SET ( sockfd , & readfds ); // 添加监听套接字 
 select ( sockfd + 1 , & readfds , NULL , NULL , NULL ); 
 if ( FD_ISSET ( sockfd , & readfds )) { // 检查是否就绪 
 // 处理读事件 
 } 
 poll 的优点是没有最大文件描述符数量的限制，但是每次调用仍然需要将文件描述符集合从用户态复制到内核态，依然需要遍历，性能仍然较差。 
 // poll 的基本使用 
 int poll ( struct pollfd * fds , nfds_t nfds , int timeout ); 
 
 // 示例代码 
 struct pollfd fds [ MAX_EVENTS ]; 
 fds [ 0 ]. fd = sockfd ; 
 fds [ 0 ]. events = POLLIN ; // 监听读事件 
 poll ( fds , 1 , - 1 ); 
 if ( fds [ 0 ]. revents & POLLIN ) { 
 // 处理读事件 
 } 
 epoll 是 Linux 特有的 IO 多路复用机制，支持大规模并发连接，使用事件驱动模型，性能更高。其工作原理是将文件描述符注册到内核中，然后通过事件通知机制来处理就绪的文件描述符，不需要轮询，也不需要数据拷贝，更没有数量限制，所以性能非常高。 
 // epoll 的基本使用 
 int epoll_create ( int size ); 
 int epoll_ctl ( int epfd , int op , int fd , struct epoll_event * event ); 
 int epoll_wait ( int epfd , struct epoll_event * events , int maxevents , int timeout ); 
 
 // 示例代码 
 int epfd = epoll_create ( 1 ); 
 struct epoll_event ev , events [ MAX_EVENTS ]; 
 ev . events = EPOLLIN ; 
 ev . data . fd = sockfd ; 
 epoll_ctl ( epfd , EPOLL_CTL_ADD , sockfd , & ev ); 
 
 while ( 1 ) { 
 int nfds = epoll_wait ( epfd , events , MAX_EVENTS , - 1 ); 
 for ( int i = 0 ; i < nfds ; i ++) { 
 if ( events [ i ]. data . fd == sockfd ) { 
 // 处理读事件 
 } 
 } 
 } 
 kqueue 是 BSD/macOS 系统下的 IO 多路复用机制，类似于 epoll，支持大规模并发连接，使用事件驱动模型。 
 int kqueue ( void ); 
 int kevent ( int kq , const struct kevent * changelist , int nchanges , struct kevent * eventlist , int nevents , const struct timespec * timeout ); 
 IOCP 是 Windows 系统下的 IO 多路复用机制，使用使用完成端口模型而非事件通知。 
 HANDLE CreateIoCompletionPort ( HANDLE FileHandle , HANDLE ExistingCompletionPort , ULONG_PTR CompletionKey , DWORD NumberOfConcurrentThreads ); 
 
 
 举个例子说一下 IO 多路复用？ 
 比如说我是一名数学老师，上课时提出了一个问题：“今天谁来证明一下勾股定律？” 
 同学小王举手，我就让小王回答；小李举手，我就让小李回答；小张举手，我就让小张回答。 
 这种模式就是 IO 多路复用，我只需要在讲台上等，谁举手谁回答，不需要一个一个去问。 
 
 Redis 就是使用 epoll 这样的 IO 多路复用机制，在单线程模型下实现高效的网络 IO，从而支持高并发的请求处理。 
 
 
 举例子说一下阻塞 IO和 IO 多路复用的差别？ 
 假设我是一名老师，让学生解答一道题目。 
 我的第一种选择：按顺序逐个检查，先检查 A同学，然后是 B，之后是 C、D。。。这中间如果有一个学生卡住，全班都会被耽误。 
 这种就是阻塞 IO，不具有并发能力。 
 
 我的第二种选择，我站在讲台上等，谁举手我去检查谁。C、D 举手，我去检查 C、D 的答案，然后继续回到讲台上等。此时 E、A 又举手，然后去处理 E 和 A。 
 
 
 select、poll 和 epoll 的实现原理？ 
 select 和 poll 都是通过把所有文件描述符传递给内核，由内核遍历判断哪些就绪。 
 select 将文件描述符 FD 通过 BitsMap 传入内核，轮询所有的 FD，通过调用 file->poll 函数查询是否有对应事件，没有就将 task 加入 FD 对应 file 的待唤醒队列，等待事件来临被唤醒。 
 
 poll 改进了连接数上限问题，不再用 BitsMap 来传入 FD，取而代之的是动态数组 pollfd，但本质上仍是线性遍历，性能没有提升太多。 
 
 select和poll的模式都是，一次将参数拷贝到内核空间，等有结果了再一次拷贝出去。 
 epoll 将监听的 FD 注册进内核的红黑树，由内核在事件触发时将就绪的 FD 放入 ready list。应用程序通过 epoll_wait 获取就绪的 FD，从而避免遍历所有连接的开销。 
 
 epoll 最大的优点是：支持事件驱动 + 边缘触发，ADD 时拷贝一次，epoll_wait 时利用 MMAP 和用户共享空间，直接拷贝数据到用户空间，因此在高并发场景下性能远高于 select 和 poll。 ### Redis为什么早期选择单线程？ 
 第一，单线程模型不需要考虑复杂的锁机制，不存在多线程环境下的死锁、竞态条件等问题，开发起来更快，也更容易维护。 
 
 第二，Redis 是IO 密集型而非 CPU 密集型，主要受内存和网络 IO 限制，而非 CPU 的计算能力，单线程可以避免线程上下文切换的开销。 
 哪怕我们在一个普通的 Linux 服务器上启动 Redis 服务，它也能在 1s 内处理 1000000 个用户请求。 
 第三，单线程可以保证命令执行的原子性，无需额外的同步机制。 
 
 Redis 虽然最初采用了单线程设计，但后续的版本中也在特定方面引入了多线程，比如说 Redis 4.0 就引异步多线程，用于清理脏数据、释放无用连接、删除大 Key 等。 
 
 /* 从数据库中删除一个键、值以及相关的过期条目（如果有的话）。 
 * 如果释放值对象需要大量的内存分配操作，该对象可能会被放入 
 * 延迟释放列表中，而不是同步释放。延迟释放列表将在 
 * bio.c 的另一个线程中进行回收。 */ 
 #define LAZYFREE_THRESHOLD 64 
 int dbAsyncDelete ( redisDb * db , robj * key ) { 
 /* 从过期字典中删除条目不会释放键的 sds， 
 * 因为它与主字典共享。 */ 
 if ( dictSize ( db -> expires ) > 0 ) dictDelete ( db -> expires , key -> ptr ); 
 
 /* 如果值对象只包含少量的内存分配，使用延迟释放方式 
 * 实际上会更慢... 所以在一定阈值以下，我们就直接 
 * 同步释放对象。 */ 
 dictEntry * de = dictUnlink ( db -> dict , key -> ptr ); 
 if ( de ) { 
 robj * val = dictGetVal ( de ); 
 // 计算value的回收收益 
 size_t free_effort = lazyfreeGetFreeEffort ( val ); 
 
 /* 如果释放对象的工作量太大，就通过将对象添加到延迟释放列表 
 * 在后台进行处理。 
 * 注意，如果对象是共享的，现在就回收它是不可能的。这种情况 
 * 很少发生，但是有时 Redis 核心的某些实现部分可能会调用 
 * incrRefCount() 来保护对象，然后调用 dbDelete()。在这种 
 * 情况下，我们会继续执行并到达 dictFreeUnlinkedEntry() 
 * 调用，这相当于仅仅调用 decrRefCount()。 */ 
 // 只有回收收益超过一定值，才会执行异步删除，否则还是会退化到同步删除 
 if ( free_effort > LAZYFREE_THRESHOLD && val -> refcount == 1 ) { 
 atomicIncr ( lazyfree_objects , 1 ); 
 bioCreateBackgroundJob ( BIO_LAZY_FREE , val , NULL , NULL ); 
 dictSetVal ( db -> dict , de , NULL ); 
 } 
 } 
 
 /* 释放键值对，如果我们将 val 字段设置为 NULL 以便稍后 
 * 延迟释放，那么就只释放键。 */ 
 if ( de ) { 
 dictFreeUnlinkedEntry ( db -> dict , de ); 
 if ( server . cluster_enabled ) slotToKeyDel ( key -> ptr ); 
 return 1 ; 
 } else { 
 return 0 ; 
 } 
 } 
 官方解释： https://redis.io/topics/faq ### Redis 6.0 使用多线程是怎么回事? 
 Redis 6.0 的多线程仅用于处理网络 IO，包括网络数据的读取、写入，以及请求解析。 
 │ 单线程执行命令 │
 │ ↑ ↓ │
┌─────────┐ ┌─┴────────────┴──┐
│ I/O线程1 │ ←→ │ │
├─────────┤ │ │
│ I/O线程2 │ ←→ │ 主线程 │
├─────────┤ │ │
│ I/O线程3 │ ←→ │ │
└─────────┘ └─────────────────┘ 
 而命令的执行依然是单线程，这种设计被称为“IO 线程化”，能够在高负载的情况下，最大限度地提升 Redis 的响应速度。 
 
 ---- 这部分面试中可以不背，方便大家理解 start ---- 
 这一变化主要是因为随着网络带宽和服务器性能的提升，Redis 的瓶颈从 CPU 逐渐转移到了网络 IO： 
 
 带宽从 10Gbps 提升到 100Gbps，甚至更高。 
 请求的并发数从几千到几万，甚至几十万。 
 
 单线程在高负载场景下处理网络 IO 出现了明显的性能瓶颈，Redis 的开发团队通过研究发现，在处理大数据包时，单线程 Redis 有超过 80% 的 CPU 时间花在网络 IO 上，而实际命令执行仅占 20% 左右。 
 
 Redis 6.0 的多线程 IO 模型主要包含三个核心步骤： 
 
 仍然由主线程负责接收客户端的连接请求。 
 主线程将连接请求分发给多个 IO 线程进行处理，主线程负责解析和执行命令。 
 命令执行完毕后，由多个 IO 线程将结果返回给客户端。 
 
 // Redis 主事件循环（简化版） 
 void beforeSleep ( struct aeEventLoop * eventLoop ) { 
 // 1. 主线程分派读任务给 I/O 线程 
 handleClientsWithPendingReadsUsingThreads (); 
 
 // 2. 等待 I/O 线程完成读取 
 waitForIOThreads (); 
 
 // 3. 主线程处理命令 
 processInputBuffer (); 
 
 // 4. 主线程分派写任务给 I/O 线程 
 handleClientsWithPendingWritesUsingThreads (); 
 } 
 Redis 6.0 默认仍然使用单线程模式，但可以通过配置文件或命令行参数启用多线程模式。 
 # 启用多线程模式 
 io-threads 4 
 
 # 启用多线程写入（Redis 6.0 默认只开启多线程读取） 
 io-threads-do-reads yes 
 建议将 IO 线程数设置为 CPU 核心数的一半，一般不建议超过 8 个。 
 经过多次测试，Redis 6.0 在处理 1-200 字节的小数据包时，性能提升 1.5-2 倍；在处理 1KB 以上的大数据包时提升约 3-5 倍。 
 ----这部分面试中可以不背，方便大家理解 end ---- ### 说说 Redis 的常用命令（补充） 
 
 2024 年 04 月 11 日增补 
 
 一句话回答（也不用全部都背，挑三个就行）： 
 Redis 支持多种数据结构，常用的命令也比较多，比如说操作字符串可以用 SET/GET/INCR ，操作哈希可以用 HSET/HGET/HGETALL ，操作列表可以用 LPUSH/LPOP/LRANGE ，操作集合可以用 SADD/SISMEMBER ，操作有序集合可以用 ZADD/ZRANGE/ZINCRBY 等，通用命令有 EXPIRE/DEL/KEYS 等。 
 ----这部分面试中可以不背，方便大家理解 start---- 
 ①、操作字符串的命令有： 
 
 
 
 命令 
 作用 
 示例 
 
 
 
 
 SET key value 
 设置字符串键值 
 SET name jack 
 
 
 GET key 
 获取字符串值 
 GET name 
 
 
 INCR key 
 数值自增 1 
 INCR count 
 
 
 DECR key 
 数值自减 1 
 DECR stock 
 
 
 INCRBY key N 
 增加 N 
 INCRBY views 10 
 
 
 APPEND key value 
 追加字符串 
 APPEND log "done" 
 
 
 GETRANGE key start end 
 获取子串 
 GETRANGE name 0 3 
 
 
 MSET k1 v1 k2 v2 
 批量设置多个键值 
 MSET a 1 b 2 
 
 
 
 ②、操作列表的命令有： 
 
 LPUSH key value ：将一个值插入到列表 key 的头部。 
 RPUSH key value ：将一个值插入到列表 key 的尾部。 
 LPOP key ：移除并返回列表 key 的头元素。 
 RPOP key ：移除并返回列表 key 的尾元素。 
 LRANGE key start stop ：获取列表 key 中指定范围内的元素。 
 
 ③、操作集合的命令有： 
 
 SADD key member ：向集合 key 添加一个元素。 
 SREM key member ：从集合 key 中移除一个元素。 
 SMEMBERS key ：返回集合 key 中的所有元素。 
 
 ④、操作有序集合的命令有： 
 
 ZADD key score member ：向有序集合 key 添加一个成员，或更新其分数。 
 ZRANGE key start stop [WITHSCORES] ：按照索引区间返回有序集合 key 中的成员，可选 WITHSCORES 参数返回分数。 
 ZREVRANGE key start stop [WITHSCORES] ：返回有序集合 key 中，指定区间内的成员，按分数递减。 
 ZREM key member ：移除有序集合 key 中的一个或多个成员。 
 
 ⑤、操作哈希的命令有： 
 
 HSET key field value ：向键为 key 的哈希表中设置字段 field 的值为 value。 
 HGET key field ：获取键为 key 的哈希表中字段 field 的值。 
 HGETALL key ：获取键为 key 的哈希表中所有的字段和值。 
 HDEL key field ：删除键为 key 的哈希表中的一个或多个字段。 
 
 
 详细说说 set 命令？ 
 SET 命令用于设置字符串的 key，支持过期时间和条件写入，常用于设置缓存、实现分布式锁、延长 Session 等场景。 
 SET key value [EX seconds | PX milliseconds | EXAT timestamp | PXAT timestamp-milliseconds | KEEPTTL] [NX | XX] [ GET ] 
 默认情况下，SET 会覆盖键已有的值。 
 支持多种设置过期时间的方式，比如说 EX 设置秒级过期时间，PX 设置毫秒过期时间。 
 支持条件写入，使其可以实现原子性操作，比如说 NX 仅在键不存在时设置值，XX 仅在键存在时设置值。 
 
 缓存实现： 
 SET user:profile:{userid} {JSON数据} EX 3600 # 存储用户资料，并设置1小时过期 
 实现分布式锁： 
 SET lock:resource_name {random_value} EX 10 NX # 获取锁，10秒后自动释放 
 存储 Session： 
 SET session:{sessionid} {session_data} EX 1800 # 存储用户会话，30分钟过期 
 
 
 sadd 命令的时间复杂度是多少？ 
 SADD 支持一次添加多个元素，返回值为实际添加成功的元素数量，时间复杂度为 O(N)。 
 redis-cli SADD myset "apple" "banana" "orange" 
 
 
 incr命令了解吗？ 
 INCR 是一个原子命令，可以将指定键的值加 1，如果 key 不存在，会先将其设置为 0，再执行加 1 操作。 
 
 常用于网站访问量、文章点赞数等计数器的实现；结合过期时间实现限流器；生成分布式唯一 ID；库存扣减等。 
 # 限制用户每分钟最多访问10次 
 FUNCTION limit_api_call ( user_id ) 
 current = INCR ( "rate:" +user_id ) 
 IF current == 1 THEN 
 EXPIRE ( "rate:" +user_id, 60 ) 
 END 
 IF current > 10 THEN 
 RETURN false # 超出限制 
 ELSE 
 RETURN true # 允许访问 
 END 
 END ### 单线程的Redis QPS 能到多少？(补充) 
 
 2024 年 4 月 14 日增补 
 
 根据 官方的基准测试 ，一个普通服务器的 Redis 实例通常可以达到每秒十万左右的 QPS。 
 
 ----这部分面试中可以不背，方便大家理解 start ---- 
 Redis 的 QPS（每秒请求数）性能取决于多种因素，包括硬件配置、网络延迟、数据结构、命令类型等。 
 可以通过 redis-benchmark 命令进行基准测试： 
 redis-benchmark -h 127.0.0.1 -p 6379 -c 50 -n 10000 
 
 -h ：指定 Redis 服务器的地址，默认是 127.0.0.1。 
 -p ：指定 Redis 服务器的端口，默认是 6379。 
 -c ：并发连接数，即同时有多少个客户端在进行测试。 
 -n ：请求总数，即测试过程中总共要执行多少个请求。 
 
 2023 年前，我用的是一台 macOS，4 GHz 四核 Intel Core i7，32 GB 1867 MHz DDR3，测试结果如下： 
 
 可以看得出，每秒能处理超过 10 万次请求。 
 QPS = 总请求数 / 总耗时 = 10000 / 0.09 ≈ 111111 QPS 
 延迟也非常低，99% 的请求都在 0.3ms 以内完成了。 
 ----这部分面试中可以不背，方便大家理解 end ---- 
 
 
 
 
 
 
 
 
 持久化
