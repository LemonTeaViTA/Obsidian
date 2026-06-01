---
module: Redis
tags: [Redis, 秒杀, 限流, SCAN, keepalive]
difficulty: medium
last_reviewed: 2026-06-01
---

# Redis 实战场景

> [!info] 本文导读
> 本文聚焦 Redis 在工程中的典型 How-to，是这些实战题的唯一出处（SSoT）：
> - 海量 key 按前缀查找：用 SCAN 而非 KEYS
> - 秒杀场景中 Redis 的五种角色
> - 三种限流算法（计数器 / 滑动窗口 / 令牌桶）及 Lua 实现
> - 客户端断连检测（TCP keepalive 与 timeout）
>
> 底层结构原理见 [[底层数据结构与实战]]；分布式锁、事务、Lua 脚本语法见 [[Redis 进阶功能]]；缓存三高与一致性见 [[缓存经典问题]]。

## 海量 key 按前缀查找

### 假如 Redis 里面有 1 亿个 key，其中有 10w 个 key 是以某个固定的已知的前缀开头的，如何将它们全部找出来？

使用 SCAN 命令配合 MATCH 参数来解决：

```bash
SCAN 0 MATCH user:* COUNT 1000
```

SCAN 的优势在于它是基于游标的增量迭代，每次只返回一小批结果，不会阻塞服务器。从游标 0 开始，每次处理返回的 key 列表，然后用返回的下一个游标继续扫描，直到游标回到 0 表示扫描完成。

```java
public List<String> scanKeysByPrefix(String prefix, int batchSize) {
    List<String> keys = new ArrayList<>();
    ScanOptions options = ScanOptions.scanOptions()
        .match(prefix + "*")
        .count(batchSize)
        .build();
    try (Cursor<String> cursor = redisTemplate.scan(options)) {
        while (cursor.hasNext()) {
            keys.add(cursor.next());
        }
    }
    return keys;
}
```

千万不要用 KEYS 命令，因为 KEYS 会阻塞 Redis 服务器直到遍历完所有 key，在生产环境中对 1 亿个 key 执行 KEYS 是非常危险的。

> [!tip] SCAN 还能用来安全删除大集合
> 删除超大集合时同样不能直接 `DEL`，可用 SCAN 分批迭代后逐步处理。大 Key 阻塞与 `UNLINK` 异步删除见 [[Redis 进阶功能#阻塞与性能]]。

## 秒杀场景设计

### Redis 在秒杀场景下可以扮演什么角色？

第一，缓存预热。在秒杀开始前，将商品信息、库存数据等预先加载到 Redis 中，大量的用户读请求直接从 Redis 中获取响应，大大减轻数据库的访问压力。

第二，库存控制。Redis 提供的原子操作如 DECR、DECRBY 等命令，可以确保在高并发环境下库存计数的准确性。更复杂的"扣库存 + 去重"逻辑应通过 Lua 脚本实现，保证原子性——完整脚本见 [[Redis 进阶功能#Lua 脚本]]。

第三，分布式锁。确保多个用户同时抢购同一件商品时的操作是互斥的，保证数据一致性，同时可以用来防止用户重复下单。分布式锁的实现见 [[Redis 进阶功能#分布式锁]]。

第四，限流削峰。Redis 可以实现多种限流算法，控制单位时间内系统能够处理的请求数量，超出部分排队或直接拒绝（见下文「限流方案」）。

第五，答题削峰。可以在秒杀活动中加入答题环节，只有答对题目的用户才能参与秒杀活动，这样可以最大程度减少无效请求。

## 限流方案

### Redis 如何做限流呢？

常见有三种算法，复杂度递增、限流效果递优。

**第一种，固定窗口计数器**。用 INCR 命令给每个用户设个计数器，每次请求就加 1，同时设置过期时间。如果计数超过限制就拒绝请求。这种方法简单，但有临界时间突刺问题（窗口边界两侧短时间内可能放过 2 倍流量）。

```bash
INCR rate:user:1001
EXPIRE rate:user:1001 1   # 1 秒窗口
```

**第二种，滑动窗口**，通过 Redis 的 ZSet 来实现：把每次请求的时间戳作为 score 存进去，用 ZREMRANGEBYSCORE 删除窗口外的旧数据，再用 ZCARD 统计当前窗口内的请求数，限流比较均匀。用 Lua 脚本把"清理过期 + 计数 + 写入"三步合成一个原子操作：

```java
String luaScript =
    "local key = KEYS[1] " +
    "local now = tonumber(ARGV[1]) " +
    "local window = tonumber(ARGV[2]) " +
    "local limit = tonumber(ARGV[3]) " +
    "redis.call('ZREMRANGEBYSCORE', key, 0, now - window) " +
    "local current = redis.call('ZCARD', key) " +
    "if current < limit then " +
    "  redis.call('ZADD', key, now, now) " +
    "  return 1 " +
    "else " +
    "  return 0 " +
    "end";
```

**第三种，令牌桶**。在 Redis 里存两个值，一个是令牌数量，一个是上次更新时间。每次请求时用 Lua 脚本计算应该补充多少令牌，然后判断是否有足够的令牌：

```lua
local key = KEYS[1]
local max_permits = tonumber(ARGV[1])
local permits_per_second = tonumber(ARGV[2])
local required_permits = tonumber(ARGV[3])

local time = redis.call('time')
local now_micros = tonumber(time[1]) * 1000000 + tonumber(time[2])

local last_micros = tonumber(redis.call('hget', key, 'last_micros') or 0)
local stored_permits = tonumber(redis.call('hget', key, 'stored_permits') or 0)

local interval_micros = now_micros - last_micros
local new_permits = interval_micros * permits_per_second / 1000000
stored_permits = math.min(max_permits, stored_permits + new_permits)

local result = 0
if stored_permits >= required_permits then
    stored_permits = stored_permits - required_permits
    result = 1
end

redis.call('hset', key, 'last_micros', now_micros)
redis.call('hset', key, 'stored_permits', stored_permits)
redis.call('expire', key, 10)

return result
```

> [!tip] 不想自己写 Lua 怎么办
> Redisson 提供了开箱即用的分布式限流器 `RRateLimiter`，底层同样基于令牌桶。用法见 [[Redis 进阶功能#Redisson 了解多少？]]。

## 客户端断连检测

### 客户端宕机后 Redis 服务端如何感知到？

TCP 的 keepalive 是 Redis 用来检测客户端连接状态的主要机制，默认值为 300 秒：

```bash
config set tcp-keepalive 60  # 每60秒发送一次keepalive探测
```

当客户端与服务器在指定时间内没有任何数据交互时，Redis 服务器会发送 TCP ACK 探测包，如果连续多次没有收到响应，TCP 协议栈会通知 Redis 服务端连接已断开，之后 Redis 服务端会清理相关的连接资源。

另外还有一个 timeout 参数，用来控制客户端连接的空闲超时时间：

```bash
config set timeout 600  # 600秒内没有任何命令则断开连接
```

默认值为 0，表示永不断开连接；当设置为非零值时，如果客户端在指定时间内没有发送任何命令，服务端会主动断开连接。

不同的连接池也会有自己的连接检测机制，比如 Jedis 连接池可以通过设置 `testOnBorrow` 和 `testWhileIdle` 来启用连接检测：

```properties
spring.redis.jedis.pool.enabled=true
spring.redis.jedis.pool.max-active=200
spring.redis.jedis.pool.max-idle=200
spring.redis.jedis.pool.min-idle=50
spring.redis.jedis.pool.max-wait=3000
spring.redis.jedis.pool.time-between-eviction-runs=60000
```

## 相关链接

- [[Redis 进阶功能]] — 分布式锁、Lua 脚本、事务、阻塞与性能
- [[底层数据结构与实战]] — 实战场景背后的底层结构原理
- [[缓存经典问题]] — 缓存三高、热 Key 与大 Key
- [[Redis 基础]] — Redis 整体概述与数据类型
