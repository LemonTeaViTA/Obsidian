### Redis发生阻塞了怎么解决？ 
 Redis 发生阻塞在生产环境中是比较严重的问题，当发现 Redis 变慢时，我会先通过 monitor 命令查看当前正在执行的命令，或者使用 slowlog 命令查看慢查询日志。 
 # 查看当前正在执行的命令 
 redis-cli MONITOR 
 
 # 查看慢查询日志 
 redis-cli SLOWLOG GET 10 
 
 # 检查客户端连接状况 
 redis-cli CLIENT LIST 
 通常情况下，大Key 是导致 Redis 阻塞的主要原因之一。比如说直接 DEL 一个包含几百万个元素的 Set，就会导致 Redis 阻塞几秒钟甚至更久。 
 这时候可以用 UNLINK 命令替代 DEL 来异步删除，避免阻塞主线程。 
 # 使用 UNLINK 异步删除大 Key 
 redis-cli UNLINK big_key 
 对于非常大的集合，可以使用 SCAN 命令分批删除。 
 public void safeBatchProcess ( String key ) { 
 ScanOptions options = ScanOptions . scanOptions (). count ( 1000 ). build (); 
 Cursor < String > cursor = redisTemplate . opsForSet (). scan ( key , options ); 
 
 while ( cursor . hasNext ()) { 
 String member = cursor . next (); 
 // 分批处理，避免阻塞 
 processElement ( member ); 
 } 
 } 
 另外，当 Redis 使用的内存超过物理内存时，操作系统会将部分内存交换到磁盘，这时候会导致 Redis 响应变慢。我的处理方式是： 
 使用 free -h 检查内存的使用情况 ；确认 Redis 的 maxmemory 设置是否合理；如果发生了内存交换，立即调整 maxmemory 并清理一些不重要的数据。 
 大量的客户端连接也可能会导致阻塞，这时候最好检查一下连接池的配置。 
 @Configuration 
 public class RedisConnectionConfig { 
 
 @Bean 
 public JedisConnectionFactory jedisConnectionFactory () { 
 JedisPoolConfig poolConfig = new JedisPoolConfig (); 
 poolConfig . setMaxTotal ( 200 ); // 最大连接数 
 poolConfig . setMaxIdle ( 50 ); // 最大空闲连接 
 poolConfig . setMinIdle ( 10 ); // 最小空闲连接 
 poolConfig . setMaxWaitMillis ( 3000 ); // 获取连接最大等待时间 
 poolConfig . setTestOnBorrow ( true ); // 获取连接时检测有效性 
 
 return new JedisConnectionFactory ( poolConfig ); 
 } 
 } 
 
 
 
 
 Redis 应用 ### Redis如何实现异步消息队列？ 
 Redis 实现异步消息队列是一个很实用的技术方案，最简单的方式是使用 List 配合 LPUSH 和 RPOP 命令。 
 
 @Service 
 public class SimpleRedisQueue { 
 
 private final RedisTemplate < String , Object > redisTemplate ; 
 
 // 生产者：向队列发送消息 
 public void sendMessage ( String queueName , Object message ) { 
 redisTemplate . opsForList (). leftPush ( queueName , message ); 
 } 
 
 // 消费者：从队列获取消息 
 public Object receiveMessage ( String queueName ) { 
 return redisTemplate . opsForList (). rightPop ( queueName ); 
 } 
 
 // 阻塞式消费，避免轮询 
 public Object blockingReceive ( String queueName , int timeoutSeconds ) { 
 List < Object > result = redisTemplate . opsForList () 
 . rightPop ( queueName , timeoutSeconds , TimeUnit . SECONDS ); 
 return result != null && ! result . isEmpty () ? result . get ( 0 ) : null ; 
 } 
 } 
 另外就是用 Redis 的 Pub/Sub 来实现简单的消息广播和订阅。 
 @Service 
 public class RedisPubSubService { 
 
 private final RedisTemplate < String , Object > redisTemplate ; 
 
 // 发布消息到指定频道 
 public void publish ( String channel , Object message ) { 
 redisTemplate . convertAndSend ( channel , message ); 
 } 
 
 // 订阅频道 
 @PostConstruct 
 public void subscribe () { 
 redisTemplate . setMessageListener (( message , pattern ) -> { 
 System . out . println ( "Received message: " + message ); 
 }); 
 redisTemplate . getConnectionFactory (). getConnection (). subscribe ( 
 new ChannelTopic ( "myChannel" ). getTopic (). getBytes () 
 ); 
 } 
 } 
 发布者将消息发布到指定的频道，订阅该频道的客户端就能收到消息。 
 
 但是这两种方式都是不可靠的，因为没有 ACK 机制所以不能保证订阅者一定能收到消息，也不支持消息持久化。 ### Redis如何实现延时消息队列? 
 延时消息队列在实际业务中很常见，比如订单超时取消、定时提醒等场景。Redis 虽然不是专业的消息队列，但可以很好地实现延时队列功能。 
 核心思路是利用 ZSet 的有序特性，将消息作为 member，把消息的执行时间作为 score。这样消息就会按照执行时间自动排序，我们只需要定期扫描当前时间之前的消息进行处理就可以了。 
 
 @Service 
 public class DelayedMessageQueue { 
 
 private final RedisTemplate < String , Object > redisTemplate ; 
 
 // 发送延时消息 
 public void sendDelayedMessage ( String queueName , Object message , long delaySeconds ) { 
 // 计算消息的执行时间 
 long executeTime = System . currentTimeMillis () + ( delaySeconds * 1000 ); 
 
 // 将消息加入ZSet，以执行时间作为score 
 redisTemplate . opsForZSet (). add ( queueName , message , executeTime ); 
 
 log . info ( "发送延时消息: {}, 延时: {}秒" , message , delaySeconds ); 
 } 
 
 // 消费延时消息 
 @Scheduled ( fixedDelay = 1000 ) // 每秒扫描一次 
 public void consumeDelayedMessages () { 
 String queueName = "delayed:queue" ; 
 long currentTime = System . currentTimeMillis (); 
 
 // 获取已到期的消息（score <= 当前时间） 
 Set < Object > messages = redisTemplate . opsForZSet () 
 . rangeByScore ( queueName , 0 , currentTime ); 
 
 for ( Object message : messages ) { 
 try { 
 // 处理消息 
 processMessage ( message ); 
 
 // 处理成功后从队列中移除 
 redisTemplate . opsForZSet (). remove ( queueName , message ); 
 
 log . info ( "处理延时消息成功: {}" , message ); 
 } catch ( Exception e ) { 
 log . error ( "处理延时消息失败: {}" , message , e ); 
 // 可以实现重试机制 
 handleFailedMessage ( queueName , message ); 
 } 
 } 
 } 
 } 
 具体实现上，我会在生产者发送延时消息时，计算消息应该执行的时间戳，然后用 ZADD 命令将消息添加到 ZSet 中。 
 ZADD delay_queue 1617024000 task1 
 消费者通过定时任务，使用 ZRANGEBYSCORE 命令获取当前时间之前的所有消息。 
 ZREMRANGEBYSCORE delay_queue -inf 1617024000 
 处理完成后再用 ZREM 删除消息。 
 ZREM delay_queue task1 
 在 技术派实战项目 中，我就用这种方式实现了文章定时发布的功能。作者在发布文章时，可以选择一个未来的时间节点，比如说 30 分钟后，系统就会向延时队列发送一条延时消息，然后定时任务就会在 30 分钟后将这条消息从延时队列中取出并发布文章。 ### 🌟Redis支持事务吗？ 
 是的，Redis 支持简单的事务，可以将 multi、exec、discard 和 watch 命令打包，然后一次性的按顺序执行。 
 
 基本流程是用 multi 开启事务，然后执行一系列命令，最后用 exec 提交。这些命令会被放入队列，在 exec 时批量执行。 
 
 当客户端处于非事务状态时，所有发送给 Redis 服务的命令都会立即执行；但当客户端进入事务状态之后，这些命令会被放入一个事务队列中，然后立即返回 QUEUED，表示命令已入队。 
 
 当 exec 命令执行时，Redis 会将事务队列中的所有命令按先进先出的顺序执行。当事务队列里的命令全部执行完毕后，Redis 会返回一个数组，包含每个命令的执行结果。 
 discard 命令用于取消一个事务，它会清空事务队列并退出事务状态。 
 
 watch 命令用于监视一个或者多个 key，如果这个 key 在事务执行之前 被其他命令改动，那么事务将会被打断。 
 
 但 Redis 的事务与 MySQL 的有很大不同，它并不支持回滚，也不支持隔离级别。 
 
 说一下 Redis 事务的原理？ 
 Redis 事务的原理并不复杂，核心就是一个"先排队，后执行"的机制。 
 
 当执行 MULTI 命令时，Redis 会给这个客户端打一个事务的标记，表示这个客户端后面发送的命令不会被立即执行，而是被放到一个队列里排队等着。 
 
 当 Redis 收到 EXEC 命令时，它会把队列里的命令一个个拿出来执行。因为 Redis 是单线程的，所以这个过程不会被其他命令打断，这就保证了Redis 事务的原子性。 
 
 当执行 WATCH 命令时，Redis 会将 key 添加到全局监视字典中；只要这些 key 在 EXEC 前被其他客户端修改，Redis 就会给相关客户端打上脏标记，EXEC 时发现事务已被干扰就会直接取消整个事务。 
 // 全局监视字典 
 dict * watched_keys ; 
 
 typedef struct watchedKey { 
 robj * key ; 
 redisDb * db ; 
 } watchedKey ; 
 DISCARD 做的事情很简单直接，首先检查客户端是否真的在事务状态，如果不在就报错；如果在事务状态，就清空事务队列并退出事务状态。 
 void discardCommand ( client * c ) { 
 if (!( c -> flags & CLIENT_MULTI )) { 
 addReplyError ( c , "DISCARD without MULTI" ); 
 return ; 
 } 
 discardTransaction ( c ); 
 addReply ( c , shared . ok ); 
 } 
 
 
 Redis 事务有哪些注意点？ 
 最重要的的一点是，Redis 事务不支持回滚，一旦 EXEC 命令被调用，所有命令都会被执行，即使有些命令可能执行失败。 
 
 
 Redis事务为什么不支持回滚？ 
 Redis 的核心设计理念是简单、高效，而不是完整的 ACID 特性。而实现回滚需要在执行过程中保存大量的状态信息，并在发生错误时逆向执行命令以恢复原始状态。这会增加 Redis 的复杂性和性能开销。 
 
 
 
 Redis事务满足原子性吗？要怎么改进？ 
 Redis 的事务不能满足标准的原子性，因为它不支持事务回滚，也就是说，假如某个命令执行失败，整个事务并不会自动回滚到初始状态。 
 // 一个转账事务 
 redisTemplate . multi (); 
 redisTemplate . opsForValue (). decrement ( "user:1:balance" , 100 ); // 成功 
 redisTemplate . opsForList (). leftPush ( "user:1:balance" , "log" ); // 类型错误，失败 
 redisTemplate . opsForValue (). increment ( "user:2:balance" , 100 ); // 还是会执行 
 List < Object > results = redisTemplate . exec (); 
 
 // 结果：用户1被扣了钱，用户2也收到了钱，但中间的日志操作失败了 
 // 这符合Redis的原子性定义，但不符合业务期望 
 可以使用 Lua 脚本来替代事务，脚本运行期间，Redis 不会处理其他命令，并且我们可以在脚本中处理整个业务逻辑，包括条件检查和错误处理，保证要么执行成功，要么保持最初的状态，不会出现一个命令执行失败、其他命令执行成功的情况。 
 @Service 
 public class ImprovedTransactionService { 
 
 public boolean atomicTransfer ( String fromUser , String toUser , int amount ) { 
 String luaScript = 
 "local from_key = KEYS[1] " + 
 "local to_key = KEYS[2] " + 
 "local amount = tonumber(ARGV[1]) " + 
 
 // 检查转出账户余额 
 "local from_balance = redis.call('GET', from_key) " + 
 "if not from_balance then return -1 end " + 
 
 "from_balance = tonumber(from_balance) " + 
 "if from_balance < amount then return -2 end " + 
 
 // 检查转入账户是否存在 
 "if redis.call('EXISTS', to_key) == 0 then return -3 end " + 
 
 // 所有检查通过，执行转账 
 "redis.call('DECRBY', from_key, amount) " + 
 "redis.call('INCRBY', to_key, amount) " + 
 
 // 记录转账日志 
 "local log = from_key .. ':' .. to_key .. ':' .. amount " + 
 "redis.call('LPUSH', 'transfer:log', log) " + 
 
 "return 1" ; 
 
 DefaultRedisScript < Long > script = new DefaultRedisScript <>(); 
 script . setScriptText ( luaScript ); 
 script . setResultType ( Long . class ); 
 
 Long result = redisTemplate . execute ( script , 
 Arrays . asList ( "user:" + fromUser + ":balance" , "user:" + toUser + ":balance" ), 
 amount ); 
 
 return result != null && result == 1 ; 
 } 
 } 
 
 
 Redis 事务的 ACID 特性如何体现？ 
 单个 Redis 命令的执行是原子性的，但 Redis 没有在事务上增加任何维持原子性的机制，所以 Redis 事务在执行过程中如果某个命令失败了，其他命令还是会继续执行，不会回滚。 
 
 一致性指的是，如果数据在执行事务之前是一致的，那么在事务执行之后，无论事务是否执行成功，数据也应该是一致的。但 Redis 事务并不保证一致性，因为如果事务中的某个命令失败了，其他命令仍然会执行，就会出现数据不一致的情况。 
 Redis 是单线程执行事务的，并且不会中断，直到执行完所有事务队列中的命令为止。因此，我认为 Redis 的事务具有隔离性的特征。 
 
 Redis 事务的持久性完全依赖于 Redis 本身的持久化机制，如果开启了 AOF，那么事务中的命令会作为一个整体记录到 AOF 文件中，当然也要看 AOF 的 fsync 策略。 
 如果只开启了 RDB，事务中的命令可能会在下次快照前丢失。如果两个都没有开启，肯定是不满足持久性的。 ### 有Lua脚本操作Redis的经验吗？ 
 Lua 脚本是处理 Redis 复杂操作的首选方案，比如说原子扣减库存、分布式锁、限流等业务场景，都可以通过 Lua 脚本来实现。 
 
 在秒杀场景下，可以用 Lua 脚本把所有检查逻辑都写在一起：先看库存够不够，再看用户有没有买过，所有条件都满足才扣减库存。因为整个脚本是原子执行的，Redis 在执行期间不会处理其他命令，所以可以彻底解决超卖问题。 
 // 这个秒杀脚本救了我的命 
 String luaScript = 
 "local stock = redis.call('GET', KEYS[1]) " + 
 "if not stock or tonumber(stock) < tonumber(ARGV[2]) then " + 
 " return -1 " + // 库存不足 
 "end " + 
 "if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then " + 
 " return -2 " + // 重复购买 
 "end " + 
 "redis.call('DECRBY', KEYS[1], ARGV[2]) " + 
 "redis.call('SADD', KEYS[2], ARGV[1]) " + 
 "return 1" ; 
 在分布式锁场景下，我一开始用的 SETNX 命令来实现，结果发现如果程序异常退出，锁就死掉了。后来加了过期时间，但又发现可能误删其他线程的锁。最后还是用 Lua 脚本彻底解决了这个问题，确保只有锁的持有者才能释放锁。 
 // 解锁脚本特别重要，必须验证是自己的锁才能删 
 private final String UNLOCK_SCRIPT = 
 "if redis.call('GET', KEYS[1]) == ARGV[1] then " + 
 " return redis.call('DEL', KEYS[1]) " + 
 "else " + 
 " return 0 " + 
 "end" ; 
 甚至还可以用 Lua脚本实现滑动窗口限流器，一次性完成过期数据清理、计数检查、新记录添加三个操作，而且完全原子化。 
 // 滑动窗口限流，逻辑清晰，性能还好 
 String luaScript = 
 "local key = KEYS[1] " + 
 "local now = tonumber(ARGV[1]) " + 
 "local window = tonumber(ARGV[2]) " + 
 "local limit = tonumber(ARGV[3]) " + 
 
 // 先清理过期记录 
 "redis.call('ZREMRANGEBYSCORE', key, 0, now - window) " + 
 
 // 检查当前请求数 
 "local current = redis.call('ZCARD', key) " + 
 "if current < limit then " + 
 " redis.call('ZADD', key, now, now) " + 
 " return 1 " + 
 "else " + 
 " return 0 " + 
 "end" ; ### Redis的管道Pipeline了解吗？ 
 了解，Pipeline 允许客户端一次性向 Redis 服务器发送多个命令，而不必等待一个命令响应后才能发送下一个。Redis 服务器会按照命令的顺序依次执行，并将所有结果打包返回给客户端。 
 
 正常情况下，每执行一个 Redis 命令都需要一次网络往返：发送命令 -> 等待响应 -> 发送下一个命令。 
 客户端 Redis服务器
 | |
 |------- SET key1 val1 ---->|
 |<------ OK ---------------|
 |------- SET key2 val2 ---->|
 |<------ OK ---------------|
 |------- GET key1 -------->|
 |<------ val1 -------------| 
 如果大量请求依次发送，网络延迟会显著增加请求的总执行时间，假如一次 RTT 的时间是 1 毫秒，3 个就是 3 毫秒。有了 Pipeline 后，可以一次性发送 3 个命令，总时间就只需要 1 毫秒。 
 @Service 
 public class RedisBatchService { 
 
 public void batchInsertUsers ( List < User > users ) { 
 // 不用Pipeline的错误做法 - 很慢 
 // for (User user : users) { 
 // redisTemplate.opsForValue().set("user:" + user.getId(), user); 
 // } 
 
 // 使用Pipeline的正确做法 
 redisTemplate . executePipelined ( new RedisCallback < Object >() { 
 @Override 
 public Object doInRedis ( RedisConnection connection ) throws DataAccessException { 
 for ( User user : users ) { 
 String key = "user:" + user . getId (); 
 byte [] keyBytes = key . getBytes (); 
 byte [] valueBytes = serialize ( user ); 
 
 connection . set ( keyBytes , valueBytes ); 
 } 
 return null ; // Pipeline不需要返回值 
 } 
 }); 
 } 
 } 
 当然了，Pipeline 不是越大越好，太大会占用过多内存，通常建议每个 Pipeline 包含 1000 到 5000 个命令。可以根据实际情况调整。 
 public void smartBatchInsert ( List < String > data ) { 
 int batchSize = 1000 ; // 经验值，根据数据大小调整 
 
 for ( int i = 0 ; i < data . size (); i += batchSize ) { 
 List < String > batch = data . subList ( i , Math . min ( i + batchSize , data . size ())); 
 
 redisTemplate . executePipelined ( new RedisCallback < Object >() { 
 @Override 
 public Object doInRedis ( RedisConnection connection ) throws DataAccessException { 
 for ( String item : batch ) { 
 connection . set ( item . getBytes (), item . getBytes ()); 
 } 
 return null ; 
 } 
 }); 
 } 
 } 
 
 什么场景下适合使用 Pipeline呢？ 
 需要批量插入、更新或删除数据，或者需要执行大量相似的命令时。比如：系统启动时的缓存预热 -> 批量加载热点数据；比如统计数据的批量更新；比如大批量数据的导入导出；比如批量删除过期或无效的缓存。 
 
 
 有了解过 Pipeline 的底层原理吗？ 
 有，其实就是缓冲的思想。在 技术派实战项目 中，我就在 RedisClient 类中封装了一个 PipelineAction 内部类，用来缓存命令。 
 
 add 方法将命令包装成 Runnable 对象，放入 List 中。当执行 execute 方法时，再调用 RedisTemplate 的 executePipelined 方法开启管道模式将多个命令发送到 Redis 服务端。 
 
 Redis 服务端从输入缓冲区读到命令后，会按照 RESP 协议进行命令拆解，再依次执行这些命令。执行结果会写入到输出缓冲区，最后再将所有结果一次性返回给客户端。 
 typedef struct client { 
 sds querybuf ; // 输入缓冲区 
 list * reply ; // 输出缓冲区链表 
 unsigned long reply_bytes ; // 输出缓冲区大小 
 } client ; ### 🌟Redis能实现分布式锁吗？ 
 分布式锁是一种用于控制多个不同进程在分布式系统中访问共享资源的锁机制。它能确保在同一时刻，只有一个节点可以对资源进行访问，从而避免分布式场景下的并发问题。 
 可以使用 Redis 的 SETNX 命令实现简单的分布式锁。比如 SET key value NX PX 3000 就创建了一个锁名为 key 的分布式锁，锁的持有者为 value 。NX 保证只有在 key 不存在时才能创建成功，EX 设置过期时间用以防止[[锁|死锁]]。 
 
 
 Redis如何保证 SETNX 不会发生冲突？ 
 当我们使用 SET key value NX EX 30 这个命令进行加锁时，Redis 会把整个操作当作一个原子指令来执行。因为 Redis 的命令处理是单线程的，所以在同一时刻只能有一个命令在执行。 
 比如说两个客户端 A 和 B 同时请求同一个锁： 
 客户端A: SET lock_key uuid_a NX EX 30
客户端B: SET lock_key uuid_b NX EX 30 
 虽然这两个请求可能几乎同时到达 Redis 服务器，但 Redis 会严格按照到达的先后顺序来处理。假设 A 的请求先到，Redis 会先执行 A 的 SET 命令，这时 lock_key 被设置为 uuid_a。 
 当处理 B 的请求时，因为 lock_key 已经存在了，NX 条件不满足，所以 B 的 SET 命令会失败，返回 NULL。这样就保证了只有 A 能获取到锁。 
 关键点在于 NX 的语义： NOT EXISTS ，只有在 key 不存在的时候才会设置成功。Redis 在执行这个命令时，会先检查 key 是否存在，如果不存在才会设置值，这整个过程是原子的，不会被其他命令打断。 
 
 
 SETNX有什么问题，如何解决？ 
 使用 SETNX 创建分布式锁时，虽然可以通过设置过期时间来避免死锁，但会误删锁。比如线程 A 获取锁后，业务执行时间比较长，锁过期了。这时线程 B 获取到锁，但线程 A 执行完业务逻辑后，会尝试删除锁，这时候删掉的其实是线程 B 的锁。 
 
 可以通过锁的自动续期机制来解决锁过期的问题，比如 Redisson 的看门狗机制，在后台启动一个定时任务，每隔一段时间就检查锁是否还被当前线程持有，如果是就自动延长过期时间。这样既避免了死锁，又防止了锁被提前释放。 
 
 
 
 
 Redisson了解多少？ 
 Redisson 是一个基于 Redis 的 Java 客户端，它不只是对 Redis 的操作进行简单地封装，还提供了很多分布式的数据结构和服务，比如最常用的分布式锁。 
 RLock lock = redisson . getLock ( "lock" ); 
 lock . lock (); 
 try { 
 // do something 
 } finally { 
 lock . unlock (); 
 } 
 Redisson 的分布式锁比 SETNX 完善的得多，它的看门狗机制可以让我们在获取锁的时候省去手动设置过期时间的步骤，它在内部封装了一个定时任务，每隔 10 秒会检查一次，如果当前线程还持有锁就自动续期 30 秒。 
 private Long tryAcquire ( long waitTime , long leaseTime , TimeUnit unit , long threadId ) { 
 return get ( tryAcquireAsync ( waitTime , leaseTime , unit , threadId )); 
 } 
 
 private < T > RFuture < Long > tryAcquireAsync ( long waitTime , long leaseTime , TimeUnit unit , long threadId ) { 
 RFuture < Long > ttlRemainingFuture ; 
 if ( leaseTime != - 1 ) { 
 // 手动设置过期时间 
 ttlRemainingFuture = tryLockInnerAsync ( waitTime , leaseTime , unit , threadId , RedisCommands . EVAL_LONG ); 
 } else { 
 // 启用看门狗机制，使用默认的30秒过期时间 
 ttlRemainingFuture = tryLockInnerAsync ( waitTime , internalLockLeaseTime , 
 TimeUnit . MILLISECONDS , threadId , RedisCommands . EVAL_LONG ); 
 } 
 
 // 处理获取锁成功的情况 
 ttlRemainingFuture . onComplete (( ttlRemaining , e ) -> { 
 if ( e != null ) { 
 return ; 
 } 
 // 如果获取锁成功且启用看门狗机制 
 if ( ttlRemaining == null ) { 
 if ( leaseTime != - 1 ) { 
 internalLockLeaseTime = unit . toMillis ( leaseTime ); 
 } else { 
 scheduleExpirationRenewal ( threadId ); // 启动看门狗 
 } 
 } 
 }); 
 return ttlRemainingFuture ; 
 } 
 另外，Redisson 还提供了分布式限流器 RRateLimiter，基于令牌桶算法实现，用于控制分布式环境下的访问频率。 
 // API 接口限流 
 @RestController 
 public class ApiController { 
 
 @Autowired 
 private RedissonClient redissonClient ; 
 
 @GetMapping ( "/api/data" ) 
 public ResponseEntity <?> getData () { 
 RRateLimiter limiter = redissonClient . getRateLimiter ( "api.data" ); 
 limiter . trySetRate ( RateType . OVERALL , 100 , 1 , RateIntervalUnit . MINUTES ); 
 
 if ( limiter . tryAcquire ()) { 
 // 处理请求 
 return ResponseEntity . ok ( processData ()); 
 } else { 
 // 限流触发 
 return ResponseEntity . status ( 429 ). body ( "Rate limit exceeded" ); 
 } 
 } 
 } 
 
 
 详细说说Redisson的看门狗机制？ 
 Redisson 的看门狗机制是一种自动续期机制，用于解决分布式锁的过期问题。 
 基本原理是这样的：当调用 lock() 方法加锁时，如果没有显式设置过期时间，Redisson 会默认给锁加一个 30 秒的过期时间，同时启用一个名为“看门狗”的定时任务，每隔 10 秒（默认是过期时间的 1/3），去检查一次锁是否还被当前线程持有，如果是，就自动续期，将过期时间延长到 30 秒。 
 
 // 伪代码展示核心逻辑 
 private void renewExpiration () { 
 Timeout task = commandExecutor . getConnectionManager () 
 . newTimeout ( new TimerTask () { 
 @Override 
 public void run ( Timeout timeout ) { 
 // 用 Lua 脚本检查并续期 
 if ( redis . call ( "get" , lockKey ) == currentThreadId ) { 
 redis . call ( "expire" , lockKey , 30 ); 
 // 递归调用，继续下一次续期 
 renewExpiration (); 
 } 
 } 
 }, 10 , TimeUnit . SECONDS ); 
 } 
 续期的 Lua 脚本会检查锁的 value 是否匹配当前线程，如果匹配就延长过期时间。这样就能保证只有锁的真正持有者才能续期。 
 当调用 unlock() 方法时，看门狗任务会被取消。或者如果业务逻辑执行完但忘记 unlock 了，看门狗也会帮我们自动检查锁，如果锁已经不属于当前线程了，也会自动停止续期。 
 这样我们就不用担心业务执行时间过长导致锁被提前释放，也避免了手动估算过期时间的麻烦，同时也解决了分布式环境下的死锁问题。 
 
 
 看门狗机制中的检查锁过程是原子操作吗？ 
 是的，Redisson 使用了 Lua 脚本来保证锁检查的原子性。 
 
 Redis 在执行 Lua 脚本时，会把整个脚本当作一个命令来处理，期间不会执行其他命令。所以 hexists 检查和 expire 续期是原子执行的。 
 
 
 Redlock你了解多少？ 
 Redlock 是 Redis 作者 antirez 提出的一种分布式锁算法，用于解决单个 Redis 实例作为分布式锁时存在的单点故障问题。 
 Redlock 的核心思想是通过在多个完全独立的 Redis 实例上同时获取锁来实现容错。 
 
 minLocksAmount 方法返回的 locks.size()/2 + 1 ，正是 Redlock 算法要求的少数服从多数原则。failedLocksLimit 方法会计算允许失败的锁数量，确保即使部分实例失败，只要成功的实例数量超过一半就认为获取锁成功。 
 红锁会尝试依次向所有 Redis 实例获取锁，并记录成功获取的锁数量，当数量达到 minLocksAmount 时就认为获取成功，否则释放已获取的锁并返回失败。 
 虽然 Redlock 存在一些争议，比如说时钟漂移问题、网络分区导致的脑裂问题，但它仍然是一个相对成熟的分布式锁解决方案。 
 
 
 红锁能不能保证百分百上锁？ 
 不能，Redlock 无法保证百分百上锁成功，这是由分布式系统的本质特性决定的。 
 当有网络分区时，客户端可能无法与足够数量的 Redis 实例通信。比如在 5 个 Redis 实例的部署中，如果网络分区导致客户端只能访问到 2 个实例，那么无论如何都无法满足红锁要求的少数服从多数原则，获取锁的时候必然失败。 
 public boolean tryLock ( long waitTime , long leaseTime , TimeUnit unit ) throws InterruptedException { 
 // ... 
 for ( ListIterator < RLock > iterator = locks . listIterator (); iterator . hasNext ();) { 
 RLock lock = iterator . next (); 
 boolean lockAcquired ; 
 try { 
 lockAcquired = lock . tryLock ( awaitTime , newLeaseTime , TimeUnit . MILLISECONDS ); 
 } catch ( RedisResponseTimeoutException e ) { 
 lockAcquired = false ; // 网络超时导致失败 
 } catch ( Exception e ) { 
 lockAcquired = false ; // 其他异常导致失败 
 } 
 
 // 如果剩余可尝试的实例数量不足以达到多数派，直接退出 
 if ( locks . size () - acquiredLocks . size () == failedLocksLimit ()) { 
 break ; 
 } 
 } 
 
 // 检查是否达到多数派要求 
 if ( acquiredLocks . size () >= minLocksAmount ( locks )) { 
 return true ; 
 } else { 
 unlockInner ( acquiredLocks ); 
 return false ; // 未达到多数派，获取失败 
 } 
 } 
 时钟漂移也会影响成功率。即使所有实例都可达，如果各个 Redis 实例之间存在明显的时钟漂移，或者客户端在获取锁的过程中耗时过长，比如网络延迟、GC 停顿等，都可能会导致锁在获取完成前就过期，从而获取失败。 
 在实际应用中，可以通过重试机制来提高锁的成功率。 
 for ( int i = 0 ; i < maxRetries ; i ++) { 
 if ( redLock . tryLock ( waitTime , leaseTime , TimeUnit . MILLISECONDS )) { 
 return true ; 
 } 
 Thread . sleep ( retryDelay ); 
 } 
 return false ; 
 
 
 项目中有用到分布式锁吗？ 
 在 PmHub 项目中，我有使用 Redission 的分布式锁来确保流程状态的更新按顺序执行，且不被其他流程服务干扰。 
 
 
 
 
 
 
 
 
 
 
 
 底层结构
