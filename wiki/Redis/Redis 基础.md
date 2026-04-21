---
module: Redis
tags: [Redis, 数据类型]
difficulty: easy
last_reviewed: 2026-04-20
---

# Redis 基础

## Redis 概述

### 🌟说说什么是 Redis?

Redis 是一种基于键值对的 NoSQL 数据库。它主要的特点是把数据放在内存当中，相比直接访问磁盘的关系型数据库，读写速度会快很多，基本上能达到微秒级的响应。所以在一些对性能要求很高的场景，比如缓存热点数据、防止接口爆刷，都会用到 Redis。不仅如此，Redis 还支持持久化，可以将内存中的数据异步落盘，以便服务宕机重启后能恢复数据。

#### Redis 和 MySQL 的区别？

Redis 属于非关系型数据库，数据是通过键值对的形式放在内存当中的；MySQL 属于关系型数据库，数据以行和列的形式存储在磁盘当中。

实际开发中，会将 MySQL 作为主存储，Redis 作为缓存，通过先查 Redis，未命中再查 MySQL 并写回 Redis 的方式来提高系统的整体性能。

#### 项目里哪里用到了 Redis？

在技术派实战项目当中，有很多地方都用到了 Redis，比如说用户活跃排行榜用到了 zset，作者白名单用到了 set。还有用户登录后的 Session、站点地图 SiteMap，分别用到了 Redis 的字符串和哈希表两种数据类型。

其中比较有挑战性的一个应用是，通过 Lua 脚本封装 Redis 的 setnx 命令来实现分布式锁，以保证在高并发场景下，热点文章在短时间内的高频访问不会击穿 MySQL。

#### 部署过 Redis 吗？

单机版部署：从官网下载源码包解压后执行 `make && make install` 编译安装，然后编辑 redis.conf 文件：

```ini
bind 0.0.0.0          # 允许远程访问
requirepass your_password
maxmemory 4gb
maxmemory-policy allkeys-lru
appendonly yes
```

Docker 部署：

```bash
docker run -d --name redis -p 6379:6379 redis:7.0-alpine
```

#### Redis 的高可用方案有部署过吗？

有部署过哨兵机制，生产环境部署的是一主两从的 Redis 实例，再加上三个 Sentinel 节点监控它们。

```ini
# 主节点配置
port 6379
appendonly yes

# 从节点配置
replicaof 192.168.1.10 6379

# 哨兵节点配置
sentinel monitor mymaster 192.168.1.10 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1
```

当主节点发生故障时，Sentinel 能够自动检测并协商选出新的主节点，这个过程大概需要 10-15 秒。

另一个大型项目中，使用了 Redis Cluster 集群方案，部署了 6 个节点（3主3从）：

```bash
redis-server redis-7000.conf
redis-server redis-7001.conf
# ...

redis-cli --cluster create \
  127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
  127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \
  --cluster-replicas 1
```

### Redis 可以用来干什么？

Redis 可以用来做缓存，把高频访问的文章详情、商品信息、用户信息放入 Redis 当中，并通过设置过期时间来保证数据一致性，减轻数据库的访问压力。

Redis 的 Zset 还可以用来实现积分榜、热搜榜，通过 score 字段进行排序，然后取前 N 个元素，就能实现 TOPN 的榜单功能。

利用 Redis 的 SETNX 命令或者 Redisson 还可以实现分布式锁，确保同一时间只有一个节���可以持有锁；为了防止出现死锁，可以给锁设置一个超时时间，到期后自动释放；并且最好开启一个监听线程，当任务尚未完成时给锁自动续期。

如果是秒杀接口，还可以使用 Lua 脚本来实现令牌桶算法，限制每秒只能处理 N 个请求：

```lua
-- KEYS[1]: 令牌桶的key
-- ARGV[1]: 桶容量  ARGV[2]: 令牌生成速率（每秒）  ARGV[3]: 当前时间戳（秒）
local bucket = redis.call('HMGET', KEYS[1], 'tokens', 'timestamp')
local tokens = tonumber(bucket[1]) or ARGV[1]
local last_time = tonumber(bucket[2]) or ARGV[3]
local rate = tonumber(ARGV[2])
local capacity = tonumber(ARGV[1])
local now = tonumber(ARGV[3])

local delta = math.max(0, now - last_time)
tokens = math.min(capacity, tokens + delta * rate)
last_time = now

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HMSET', KEYS[1], 'tokens', tokens, 'timestamp', last_time)
redis.call('EXPIRE', KEYS[1], 3600)
return allowed
```

## 数据类型

### 🌟Redis 有哪些数据类型？

Redis 支持五种基本数据类型，分别是字符串、列表、哈希、集合和有序集合。还有三种扩展数据类型，分别是用于位级操作的 Bitmap、用于基数估算的 HyperLogLog、支持存储和查询地理坐标的 GEO。

#### 详细介绍下字符串？

字符串是最基本的数据类型，可以存储文本、数字或者二进制数据，最大容量 512 MB。适合缓存单个对象，比如验证码、token、计数器等。

#### 详细介绍下列表？

列表是一个有序的元素集合，支持从头部或尾部插入/删除元素，常用于消息队列或任务列表。

#### 详细介绍下哈希？

哈希是一个键值对集合，适合存储对象，如商品信息、用户信息等。比如说 `value = {name: '沉默王二', age: 18}`。

#### 详细介绍下集合？

集合是无序且不重复的，支持交集、并集操作，查询效率能达到 O(1) 级别，主要用于去重、标签、共同好友等场景。

#### 详细介绍下有序集合？

有序集合的元素按分数进行排序，支持范围查询，适用于排行榜或优先级队列。

#### 详细介绍下 Bitmap？

Bitmap 可以把一组二进制位紧凑地存储在一块连续内存中，每一位代表一个对象的状态，比如是否签到、是否活跃等。1 亿用户签到仅需 100,000,000 / 8 / 1024 ≈ 12MB 的空间。

#### Bitmap 在 Redis 底层是用什么实现的？

Bitmap 本质上不是一个独立的数据类型，而是基于 String 类型（SDS，Simple Dynamic String）实现的。Redis 的 String 类型底层是一个字节数组，Bitmap 就是对这个字节数组进行位级别的操作。

当执行 `SETBIT key offset 1` 时，Redis 会：
1. 找到 offset 对应的字节位置：`byte_index = offset / 8`
2. 找到字节内的位位置：`bit_index = offset % 8`
3. 对该字节的对应位进行置位操作

由于底层是 String，所以 Bitmap 的最大长度是 512MB，即 2^32 位（约 42 亿个位）。

#### 详细介绍下 HyperLogLog？

HyperLogLog 是一种用于基数统计的概率性数据结构，可以在仅有 12KB 的内存空间下，统计海量数据集中不重复元素的个数，误差率仅 0.81%。底层基于 LogLog 算法改进，先把每个元素哈希成一个二进制串，然后取前 14 位进行分组，放到 16384 个桶中，记录每组最大的前导零数量，最后用一个近似公式推算出总体的基数。

大型网站 UV 统计示例：

```java
public void recordVisit(String date, String userId) {
    jedis.pfadd("uv:" + date, userId);
}

public long getUV(String date) {
    return jedis.pfcount("uv:" + date);
}
```

#### 详细介绍下 GEO？

GEO 用于存储和查询地理位置信息，可以用来计算两点之间的距离，查找某位置半径内的其他元素。底层基于 ZSet 实现，通过 Geohash 算法把经纬度编码成 score。常见应用场景包括：附近的人或者商家、计算外卖员和商家的距离等。

#### 为什么使用 hash 类型而不使用 string 类型序列化存储？

Hash 可以只读取或者修改某一个字段，而 String 需要一次性把整个对象取出来：

```java
// Hash：直接修改 age 字段
redis.hset("user:1", "age", 19);

// String：需要先取出整个对象，修改后再存回去
String userJson = redis.get("user:1");
User user = JSON.parseObject(userJson, User.class);
user.setAge(19);
redis.set("user:1", JSON.toJSONString(user));
```

## 性能原理

### 🌟Redis 为什么快呢？

第一，Redis 的所有数据都放在内存中，而内存的读写速度本身就比磁盘快几个数量级。

第二，Redis 采用了基于 IO 多路复用技术的事件驱动模型来处理客户端请求和执行 Redis 命令。IO 多路复用技术可以在只有一个线程的情况下，同时监听成千上万个客户端连接。Redis 会根据操作系统选择最优的 IO 多路复用技术，比如 Linux 下使用 epoll，macOS 下使用 kqueue 等。

第三，Redis 对底层数据结构做了极致的优化，比如说 String 的底层数据结构动态字符串支持动态扩容、预分配冗余空间，能够减少内存碎片和内存分配的开销。

### 能详细说一下 IO 多路复用吗？

IO 多路复用是一种允许单个进程同时监视多个文件描述符的技术，使得程序能够高效处理多个并发连接而无需创建大量线程。主要的实现机制包括 select、poll、epoll、kqueue 和 IOCP 等。

#### 请说说 select、poll、epoll 的区别？

- **select**：单个进程能监视的文件描述符数量有限（一般为 1024 个），每次调用都需要将文件描述符集合从用户态复制到内核态，然后遍历找出就绪的描述符，性能较差。
- **poll**：没有最大文件描述符数量的限制，但每次调用仍然需要将文件描述符集合从用户态复制到内核态，依然需要遍历，性能仍然较差。
- **epoll**：Linux 特有的 IO 多路复用机制，将监听的 FD 注册进内核的红黑树，由内核在事件触发时将就绪的 FD 放入 ready list。应用程序通过 `epoll_wait` 获取就绪的 FD，从而避免遍历所有连接的开销。支持事件驱动 + 边缘触发，在高并发场景下性能远高于 select 和 poll。
- **kqueue**：BSD/macOS 系统下的 IO 多路复用机制，类似于 epoll。
- **IOCP**：Windows 系统下的 IO 多路复用机制，使用完成端口模型。

### Redis 为什么早期选择单线程？

第一，单线程模型不需要考虑复杂的锁机制，不存在多线程环境下的死锁、竞态条件等问题，开发起来更快，也更容易维护。

第二，Redis 是 IO 密集型而非 CPU 密集型，主要受内存和网络 IO 限制，而非 CPU 的计算能力，单线程可以避免线程上下文切换的开销。

第三，单线程可以保证命令执行的原子性，无需额外的同步机制。

Redis 虽然最初采用了单线程设计，但后续的版本中也在特定方面引入了多线程，比如说 Redis 4.0 就引入异步多线程，用于清理脏数据、释放无用连接、删除大 Key 等。

### Redis 6.0 使用多线程是怎么回事?

Redis 6.0 的多线程仅用于处理网络 IO，包括网络数据的读取、写入，以及请求解析。而命令的执行依然是单线程，这种设计被称为"IO 线程化"，能够在高负载的情况下，最大限度地提升 Redis 的响应速度。

```ini
# 启用多线程模式
io-threads 4
io-threads-do-reads yes
```

建议将 IO 线程数设置为 CPU 核心数的一半，一般不建议超过 8 个。

## 常用命令

### 说说 Redis 的常用命令

Redis 支持多种数据结构，常用的命令有：操作字符串可以用 `SET/GET/INCR`，操作哈希可以用 `HSET/HGET/HGETALL`，操作列表可以用 `LPUSH/LPOP/LRANGE`，操作集合可以用 `SADD/SISMEMBER`，操作有序集合可以用 `ZADD/ZRANGE/ZINCRBY`，通用命令有 `EXPIRE/DEL/KEYS` 等。

| 命令 | 作用 | 示例 |
|------|------|------|
| SET key value | 设置字符串键值 | SET name jack |
| GET key | 获取字符串值 | GET name |
| INCR key | 数值自增 1 | INCR count |
| DECR key | 数值自减 1 | DECR stock |
| INCRBY key N | 增加 N | INCRBY views 10 |
| MSET k1 v1 k2 v2 | 批量设置多个键值 | MSET a 1 b 2 |

#### 详细说说 set 命令？

SET 命令用于设置字符串的 key，支持过期时间和条件写入，常用于设置缓存、实现分布式锁、延长 Session 等场景：

```bash
SET user:profile:{userid} {JSON数据} EX 3600  # 缓存用户资料，1小时过期
SET lock:resource_name {random_value} EX 10 NX  # 获取分布式锁，10秒后自动释放
SET session:{sessionid} {session_data} EX 1800  # 存储用户会话，30分钟过期
```

- `EX`：设置秒级过期时间；`PX`：设置毫秒过期时间
- `NX`：仅在键不存在时设置值；`XX`：仅在键存在时设置值

#### incr 命令了解吗？

INCR 是一个原子命令，可以将指定键的值加 1，如果 key 不存在，会先将其设置为 0，再执行加 1 操作。常用于网站访问量、文章点赞数等计数器的实现；结合过期时间实现限流器；生成分布式唯一 ID；库存扣减等。

### 单线程的 Redis QPS 能到多少？

根据官方的基准测试，一个普通服务器的 Redis 实例通常可以达到每秒十万左右的 QPS。

```bash
redis-benchmark -h 127.0.0.1 -p 6379 -c 50 -n 10000
```

## 相关链接

- [[底层数据结构与实战]] — Redis 数据类型的底层实现
- [[Redis 持久化]] — RDB 与 AOF 持久化机制
- [[Redis 进阶功能]] — 事务、Pipeline、Lua 脚本等
- [[缓存经典问题]] — 缓存穿透/击穿/雪崩
- [[高可用与集群]] — 主从、哨兵、Cluster 集群
- [[MySQL 基础与架构]] — Redis 常用作 MySQL 的缓存层
