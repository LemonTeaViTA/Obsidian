---
module: Redis
tags: [Redis, 事务, Pipeline, Lua, 分布式锁]
difficulty: medium
last_reviewed: 2026-04-20
---

# Redis 进阶功能

## 阻塞与性能

### Redis 发生阻塞了怎么解决？

Redis 发生阻塞时，先通过 monitor 命令查看当前正在执行的命令，或者使用 slowlog 命令查看慢查询日志。

```bash
redis-cli MONITOR
redis-cli SLOWLOG GET 10
redis-cli CLIENT LIST
```

大 Key 是导致 Redis 阻塞的主要原因之一。直接 DEL 一个包含几百万个元素的 Set，会导致 Redis 阻塞几秒钟甚至更久。可以用 UNLINK 命令替代 DEL 来异步删除：

```bash
redis-cli UNLINK big_key
```

对于非常大的集合，使用 SCAN 命令分批删除：

```java
public void safeBatchProcess(String key) {
    ScanOptions options = ScanOptions.scanOptions().count(1000).build();
    Cursor<String> cursor = redisTemplate.opsForSet().scan(key, options);
    while (cursor.hasNext()) {
        String member = cursor.next();
        processElement(member);
    }
}
```

当 Redis 使用的内存超过物理内存时，操作系统会将部分内存交换到磁盘，��致响应变慢。处理方式：用 `free -h` 检查内存使用情况，确认 Redis 的 maxmemory 设置是否合理，如果发生了内存交换，立即调整 maxmemory 并清理不重要的数据。

大量客户端连接也可能导致阻塞，需要检查连接池配置：

```java
@Bean
public JedisConnectionFactory jedisConnectionFactory() {
    JedisPoolConfig poolConfig = new JedisPoolConfig();
    poolConfig.setMaxTotal(200);
    poolConfig.setMaxIdle(50);
    poolConfig.setMinIdle(10);
    poolConfig.setMaxWaitMillis(3000);
    poolConfig.setTestOnBorrow(true);
    return new JedisConnectionFactory(poolConfig);
}
```

## 消息队列

### Redis 如何实现异步消息队列？

最简单的方式是使用 List 配合 LPUSH 和 RPOP 命令：

```java
@Service
public class SimpleRedisQueue {

    // 生产者：向队列发送消息
    public void sendMessage(String queueName, Object message) {
        redisTemplate.opsForList().leftPush(queueName, message);
    }

    // 消费者：从队列获取消息
    public Object receiveMessage(String queueName) {
        return redisTemplate.opsForList().rightPop(queueName);
    }

    // 阻塞式消费，避免轮询
    public Object blockingReceive(String queueName, int timeoutSeconds) {
        List<Object> result = redisTemplate.opsForList()
            .rightPop(queueName, timeoutSeconds, TimeUnit.SECONDS);
        return result != null && !result.isEmpty() ? result.get(0) : null;
    }
}
```

另外可以用 Redis 的 Pub/Sub 来实现简单的消息广播和订阅：

```java
// 发布消息到指定频道
public void publish(String channel, Object message) {
    redisTemplate.convertAndSend(channel, message);
}
```

但这两种方式都是不可靠的，因为没有 ACK 机制，不能保证订阅者一定能收到消息，也不支持消息持久化。

### Redis 如何实现延时消息队列？

核心思路是利用 ZSet 的有序特性，将消息作为 member，把消息的执行时间作为 score。消息会按照执行时间自动排序，定期扫描当前时间之前的消息进行处理：

```java
@Service
public class DelayedMessageQueue {

    // 发送延时消息
    public void sendDelayedMessage(String queueName, Object message, long delaySeconds) {
        long executeTime = System.currentTimeMillis() + (delaySeconds * 1000);
        redisTemplate.opsForZSet().add(queueName, message, executeTime);
    }

    // 消费延时消息
    @Scheduled(fixedDelay = 1000)
    public void consumeDelayedMessages() {
        String queueName = "delayed:queue";
        long currentTime = System.currentTimeMillis();
        Set<Object> messages = redisTemplate.opsForZSet()
            .rangeByScore(queueName, 0, currentTime);
        for (Object message : messages) {
            try {
                processMessage(message);
                redisTemplate.opsForZSet().remove(queueName, message);
            } catch (Exception e) {
                handleFailedMessage(queueName, message);
            }
        }
    }
}
```

对应的 Redis 命令：

```bash
ZADD delay_queue 1617024000 task1       # 添加延时消息
ZRANGEBYSCORE delay_queue -inf 1617024000  # 获取到期消息
ZREM delay_queue task1                  # 删除已处理消息
```

## 事务

### 🌟Redis 支持事务吗？

是的，Redis 支持简单的事务，可以将 MULTI、EXEC、DISCARD 和 WATCH 命令打包，然后一次性按顺序执行。

基本流程：用 MULTI 开启事务，执行一系列命令，最后用 EXEC 提交。这些命令会被放入队列，在 EXEC 时批量执行。

- `DISCARD`：取消事务，清空事务队列并退出事务状态。
- `WATCH`：监视一个或多个 key，如果这个 key 在事务执行之前被其他命令改动，事务将会被打断。

但 Redis 的事务与 MySQL 的有很大不同，它不支持回滚，也不支持隔离级别。

#### 说一下 Redis 事务的原理？

核心是"先排队，后执行"的机制。

执行 MULTI 命令时，Redis 给客户端打一个事务标记，后续命令不会被立即执行，而是放到队列里排队。收到 EXEC 命令时，Redis 把队列里的命令一个个拿出来执行。因为 Redis 是单线程的，这个过程不会被其他命令打断，保证了事务的原子性。

WATCH 命令会将 key 添加到全局监视字典中，只要这些 key 在 EXEC 前被其他客户端修改，Redis 就会给相关客户端打上脏标记，EXEC 时发现事务已被干扰就会直接取消整个事务。

#### Redis 事务有哪些注意点？

最重要的一点是，Redis 事务不支持回滚，一旦 EXEC 命令被调用，所有命令都会被执行，即使有些命令可能执行失败。

#### Redis 事务为什么不支持回滚？

Redis 的核心设计理念是简单、高效，而不是完整的 ACID 特性。实现回滚需要在执行过程中保存大量的状态信息，并在发生错误时逆向执行命令以恢复原始状态，这会增加 Redis 的复杂性和性能开销。

#### Redis 事务满足原子性吗？要怎么改进？

Redis 的事务不能满足标准的原子性，因为它不支持事务回滚。某个命令执行失败，整个事务并不会自动回滚到初始状态：

```java
redisTemplate.multi();
redisTemplate.opsForValue().decrement("user:1:balance", 100); // 成功
redisTemplate.opsForList().leftPush("user:1:balance", "log"); // 类型错误，失败
redisTemplate.opsForValue().increment("user:2:balance", 100); // 还是会执行
List<Object> results = redisTemplate.exec();
// 结果：用户1被扣了钱，用户2也收到了钱，但中间的日志操作失败了
```

可以使用 Lua 脚本来替代事务，脚本运行期间 Redis 不会处理其他命令，可以在脚本中处理整个业务逻辑，包括条件检查和错误处理：

```java
public boolean atomicTransfer(String fromUser, String toUser, int amount) {
    String luaScript =
        "local from_balance = redis.call('GET', KEYS[1]) " +
        "if not from_balance then return -1 end " +
        "from_balance = tonumber(from_balance) " +
        "if from_balance < tonumber(ARGV[1]) then return -2 end " +
        "if redis.call('EXISTS', KEYS[2]) == 0 then return -3 end " +
        "redis.call('DECRBY', KEYS[1], ARGV[1]) " +
        "redis.call('INCRBY', KEYS[2], ARGV[1]) " +
        "return 1";

    DefaultRedisScript<Long> script = new DefaultRedisScript<>();
    script.setScriptText(luaScript);
    script.setResultType(Long.class);

    Long result = redisTemplate.execute(script,
        Arrays.asList("user:" + fromUser + ":balance", "user:" + toUser + ":balance"),
        amount);
    return result != null && result == 1;
}
```

## Lua 脚本

### 有 Lua 脚本操作 Redis 的经验吗？

Lua 脚本是处理 Redis 复杂操作的首选方案，比如原子扣减库存、分布式锁、限流等业务场景。

秒杀场景下，用 Lua 脚本把所有检查逻辑写在一起，先看库存够不够，再看用户有没有买过，所有条件都满足才扣减库存：

```java
String luaScript =
    "local stock = redis.call('GET', KEYS[1]) " +
    "if not stock or tonumber(stock) < tonumber(ARGV[2]) then " +
    "  return -1 " +
    "end " +
    "if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then " +
    "  return -2 " +
    "end " +
    "redis.call('DECRBY', KEYS[1], ARGV[2]) " +
    "redis.call('SADD', KEYS[2], ARGV[1]) " +
    "return 1";
```

分布式锁解锁时，必须验证是自己的锁才能删：

```java
private final String UNLOCK_SCRIPT =
    "if redis.call('GET', KEYS[1]) == ARGV[1] then " +
    "  return redis.call('DEL', KEYS[1]) " +
    "else " +
    "  return 0 " +
    "end";
```

滑动窗口限流器，一次性完成过期数据清理、计数检查、新记录添加三个操作：

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

## Pipeline

### Redis 的管道 Pipeline 了解吗？

Pipeline 允许客户端一次性向 Redis 服务器发送多个命令，而不必等待一个命令响应后才能发送下一个。Redis 服务器会按照命令的顺序依次执行，并将所有结果打包返回给客户端。

正常情况下，每执行一个 Redis 命令都需要一次网络往返。如果一次 RTT 是 1 毫秒，3 个命令就是 3 毫秒。有了 Pipeline 后，可以一次性发送 3 个命令，总时间只需要 1 毫秒。

```java
// 使用 Pipeline 批量插入
redisTemplate.executePipelined(new RedisCallback<Object>() {
    @Override
    public Object doInRedis(RedisConnection connection) throws DataAccessException {
        for (User user : users) {
            connection.set(("user:" + user.getId()).getBytes(), serialize(user));
        }
        return null;
    }
});
```

Pipeline 不是越大越好，太大会占用过多内存，通常建议每个 Pipeline 包含 1000 到 5000 个命令。

#### 什么场景下适合使用 Pipeline？

需要批量插入、更新或删除数据，或者需要执行大量相似的命令时。比如：系统启动时的缓存预热、统计数据的批量更新、大批量数据的导入导出、批量删除过期缓存。

#### 有了解过 Pipeline 的底层原理吗？

其实就是缓冲的思想。客户端将命令缓存起来，批量发送给 Redis 服务端。Redis 服务端从输入缓冲区读到命令后，按照 RESP 协议进行命令拆解，再依次执行这些命令。执行结果写入输出缓冲区，最后将所有结果一次性返回给客户端。

## 分布式锁

### 🌟Redis 能实现分布式锁吗？

可以使用 Redis 的 SETNX 命令实现简单的分布式锁：

```bash
SET key value NX PX 3000
```

NX 保证只有在 key 不存在时才能创建成功，PX 设置过期时间用以防止死锁。

#### Redis 如何保证 SETNX 不会发生冲突？

当使用 `SET key value NX EX 30` 进行加锁时，Redis 会把整个操作当作一个原子指令来执行。因为 Redis 的命令处理是单线程的，同一时刻只能有一个命令在执行。

两个客户端 A 和 B 同时请求同一个锁，Redis 会严格按照到达的先后顺序处理。假设 A 的请求先到，lock_key 被设置为 uuid_a。当处理 B 的请求时，因为 lock_key 已经存在，NX 条件不满足，B 的 SET 命令会失败，返回 NULL。

#### SETNX 有什么问题，如何解决？

使用 SETNX 创建分布式锁时，如果线程 A 获取锁后业务执行时间比较长，锁过期了，线程 B 获取到锁，但线程 A 执行完业务逻辑后会尝试删除锁，这时候删掉的其实是线程 B 的锁。

可以通过锁的自动续期机制来解决，比如 Redisson 的看门狗机制，在后台启动一个定时任务，每隔一段时间就检查锁是否还被当前线程持有，如果是就自动延长过期时间。

### Redisson 了解多少？

Redisson 是一个基于 Redis 的 Java 客户端，提供了很多分布式的数据结构和服务，比如最常用的分布式锁：

```java
RLock lock = redisson.getLock("lock");
lock.lock();
try {
    // do something
} finally {
    lock.unlock();
}
```

Redisson 的分布式锁比 SETNX 完善得多，它的看门狗机制可以在获取锁时省去手动设置过期时间的步骤，内部封装了一个定时任务，每隔 10 秒检查一次，如果当前线程还持有锁就自动续期 30 秒。

另外，Redisson 还提供了分布式限流器 RRateLimiter，基于令牌桶算法实现：

```java
RRateLimiter limiter = redissonClient.getRateLimiter("api.data");
limiter.trySetRate(RateType.OVERALL, 100, 1, RateIntervalUnit.MINUTES);
if (limiter.tryAcquire()) {
    return ResponseEntity.ok(processData());
} else {
    return ResponseEntity.status(429).body("Rate limit exceeded");
}
```

#### 详细说说 Redisson 的看门狗机制？

当调用 `lock()` 方法加锁时，如果没有显式设置过期时间，Redisson 会默认给锁加一个 30 秒的过期时间，同时启用一个名为"看门狗"的定时任务，每隔 10 秒（默认是过期时间的 1/3）去检查一次锁是否还被当前线程持有，如果是就自动续期到 30 秒。

续期的 Lua 脚本会检查锁的 value 是否匹配当前线程，如果匹配就延长过期时间，保证只有锁的真��持有者才能续期。

当调用 `unlock()` 方法时，看门狗任务会被取消。

#### 看门狗机制中的检查锁过程是原子操作吗？

是的，Redisson 使用了 Lua 脚本来保证锁检查的原子性。Redis 在执行 Lua 脚本时，会把整个脚本当作一个命令来处理，期间不会执行其他命令，所以 hexists 检查和 expire 续期是原子执行的。

### Redlock 你了解多少？

Redlock 是 Redis 作者 antirez 提出的一种分布式锁算法，用于解决单个 Redis 实例作为分布式锁时存在的单点故障问题。

核心思想是通过在多个完全独立的 Redis 实例上同时获取锁来实现容错。要求成功获取锁的实例数量超过一半（少数服从多数原则），才认为获取锁成功，否则释放已获取的锁并返回失败。

虽然 Redlock 存在一些争议，比如时钟漂移问题、网络分区导致的脑裂问题，但它仍然是一个相对成熟的分布式锁解决方案。

#### 红锁能不能保证百分百上锁？

不能。当有网络分区时，客户端可能无法与足够数量的 Redis 实例通信。比如在 5 个 Redis 实例的部署中，如果网络分区导致客户端只能访问到 2 个实例，那么无论如何都无法满足少数服从多数原则，获取锁必然失败。

时钟漂移也会影响成功率。如果各个 Redis 实例之间存在明显的时钟漂移，或者客户端在获取锁的过程中耗时过长（网络延迟、GC 停顿等），都可能导致锁在获取完成前就过期。

在实际应用中，可以通过重试机制来提高锁的成功率：

```java
for (int i = 0; i < maxRetries; i++) {
    if (redLock.tryLock(waitTime, leaseTime, TimeUnit.MILLISECONDS)) {
        return true;
    }
    Thread.sleep(retryDelay);
}
return false;
```

## 相关链接

- [[Redis 基础]] — Redis 整体概述
- [[底层数据结构与实战]] — 进阶功能依赖底层结构
- [[缓存经典问题]] — 进阶功能解决缓存难题
- [[高可用与集群]] — 集群环境下进阶功能的限制
- [[Spring Boot 与微服务]] — Spring 集成 Redis 的实践
