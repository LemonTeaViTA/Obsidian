---
module: Redis
tags: [Redis, RDB, AOF, 持久化]
difficulty: medium
last_reviewed: 2026-04-20
---

# Redis 持久化

## RDB

### 🌟Redis 的持久化方式有哪些？

主要有两种，RDB 和 AOF。RDB 通过创建时间点快照来实现持久化，AOF 通过记录每个写操作命令来实现持久化。

这两种方式可以单独使用，也可以同时使用。这样就可以保证 Redis 服务器在重启后不丢失数据，通过 RDB 和 AOF 文件来恢复内存中原有的数据。

### 详细说一下 RDB？

RDB 持久化机制可以在指定的时间间隔内将 Redis 某一时刻的数据保存到磁盘上的 RDB 文件中，当 Redis 重启时，可以通过加载这个 RDB 文件来恢复数据。

RDB 持久化可以通过 save 和 bgsave 命令手动触发，也可以通过配置文件中的 save 指令自动触发。

- `save`：阻塞 Redis 进程，直到 RDB 文件创建完成。
- `bgsave`：在后台 fork 一个子进程来执行 RDB 持久化操作，主进程不会被阻塞。

#### 什么情况下会自动触发 RDB 持久化？

第一种，在 Redis 配置文件中设置 RDB 持久化参数 `save <seconds> <changes>`，表示在指定时间间隔内，如果有指定数量的键发生变化，就会自动触发 RDB 持久化。

```ini
save 900 1      # 900 秒（15 分钟）内有 1 个 key 发生变化，触发快照
save 300 10     # 300 秒（5 分钟）内有 10 个 key 发生变化，触发快照
save 60 10000   # 60 秒内有 10000 个 key 发生变化，触发快照
```

第二种，主从复制时，当从节点第一次连接到主节点时，主节点会自动执行 bgsave 生成 RDB 文件，并将其发送给从节点。

第三种，如果没有开启 AOF，执行 shutdown 命令时，Redis 会自动保存一次 RDB 文件，以确保数据不会丢失。

## AOF

### 详细说一下 AOF？

AOF 通过记录每个写操作命令，并将其追加到 AOF 文件来实现持久化，Redis 服务器宕机后可以通过重新执行这些命令来恢复数据。

当 Redis 执行写操作时，会将写命令追加到 AOF 缓冲区；Redis 会根据同步策略将缓冲区的数据写入到 AOF 文件。

当 AOF 文件过大时，Redis 会自动进行 AOF 重写，剔除多余的命令，生成一个新的 AOF 文件；当 Redis 重启时，读取 AOF 文件中的命令并重新执行，以恢复数据。

### AOF 的刷盘策略了解吗？

Redis 将 AOF 缓冲区的数据写入到 AOF 文件时，涉及两个系统调用：`write` 将数据写入到操作系统的缓冲区，`fsync` 将 OS 缓冲区的数据刷新到磁盘。刷盘涉及三种策略：

- `always`：每次写命令执行完，立即调用 fsync 同步到磁盘，数据不丢失，但性能较差。
- `everysec`：每秒调用一次 fsync，性能较好，数据丢失的时间窗口为 1 秒。
- `no`：不主动调用 fsync，由操作系统决定，性能最好，但数据丢失的时间窗口不确定。

```ini
appendfsync everysec  # 每秒 fsync 一次
```

### 说说 AOF 的重写机制？

由于 AOF 文件会随着写操作的增加而不断增长，Redis 提供了重写机制来对 AOF 文件进行压缩和优化。

AOF 重写可以通过两种方式触发：

第一种，手动执行 `BGREWRITEAOF` 命令。

第二种，在配置文件中设置自动重写参数：

```ini
auto-aof-rewrite-percentage 100  # AOF 文件大小相比上次重写增长 100% 时触发
auto-aof-rewrite-min-size 64mb   # AOF 文件至少达到 64MB 才考虑重写
```

#### AOF 重写的具体过程是怎样的？

Redis 收到重写指令后，fork 一个子进程遍历内存中的所有键值对，生成重建它们所需的最少命令（如多个 RPUSH 合并为一个、被删除的键不写入新 AOF）。

主进程在执行写操作时，会将命令同时写入旧的 AOF 文件和重写缓冲区。子进程完成重写后，向主进程发送信号，主进程将重写缓冲区中的命令追加到新的 AOF 文件中，然后通过原子性的 rename 替换旧文件。

```ini
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

#### AOF 文件存储的是什么类型的数据？

AOF 文件存储的是 Redis 服务器接收到的写命令数据，以 Redis 协议格式（RESP）保存。每个命令以 `*` 开头，后跟参数数量，每个参数前用 `$` 符号加参数字节长度，然后是参数的实际内容。

#### AOF 重写期间命令可能会写入两次，会造成什么影响？

不会造成问题。现有命令写入当前 AOF 文件，重写缓冲区的命令最终写入新的 AOF 文件，完成后新文件通过原子性的 rename 替换旧文件，两个文件完全分离，不会导致同一个 AOF 文件中出现重复命令。

## RDB 与 AOF 对比

### RDB 和 AOF 各自有什么优缺点？

RDB 通过 fork 子进程在特定时间点对内存数据进行全量备份，生成二进制格式的快照文件。优势在于备份恢复效率高，文件紧凑，恢复速度快，适合大规模数据的备份和迁移场景。缺点是可能丢失两次快照期间的所有数据变更。

AOF 会记录每一条修改数据的写命令，能够提供接近实时的数据备份，数据丢失风险可以控制在 1 秒内甚至完全避免。缺点是文件体积较大，恢复速度慢。

| 对比项 | RDB（快照） | AOF（命令日志） |
|--------|------------|----------------|
| 数据完整性 | 可能丢失几分钟数据 | 最多丢 1 秒数据 |
| 恢复速度 | 快（直接加载二进制快照） | 慢（逐条 replay） |
| 文件大小 | 小（压缩后） | 大（命令追加） |
| 性能影响 | 低（fork 后保存） | 较高（每次写都记录） |
| 写入方式 | 定期全量写 | 每次写命令就记录 |
| 适用场景 | 冷备份，灾难恢复 | 实时持久化，数据安全 |
| 默认状态 | 默认启用 | Redis 7 默认也启用 |
| 重写机制 | 无 | 有（BGREWRITEAOF） |

### RDB 和 AOF 如何选择？

如果是缓存场景，可以接受一定程度的数据丢失，倾向于选择 RDB 或者完全不使用持久化。

如果是处理订单或者支付这样的核心业务，数据丢失将造成严重后果，那么 AOF 就成为必然选择。通过配置每秒同步一次，可以将潜在的数据丢失风险限制在可接受范围内。

实际项目中更偏向于使用 RDB + AOF 的混合模式：

```ini
appendonly yes
appendfsync everysec
aof-use-rdb-preamble yes  # 开启混合持久化，重启时优先加载 RDB，AOF 作为实时同步
```

### 🌟Redis 4.0 的混合持久化了解吗？

混合持久化结合了 RDB 和 AOF 两种方式的优点。在 AOF 重写期间，先以 RDB 格式将内存中的数据快照保存到 AOF 文件的开头，再将重写期间的命令以 AOF 格式追加到文件末尾。

恢复数据时，Redis 先加载 RDB 格式的数据来快速恢复大部分数据，然后通过重放命令恢复最近的数据，在保证数据完整性的同时提升恢复速度。

```ini
aof-use-rdb-preamble yes
```

### Redis 如何恢复数据？

当 Redis 服务重启时，优先查找 AOF 文件，如果存在就通过重放其中的命令来恢复数据；如果不存在或未启用 AOF，则尝试加载 RDB 文件，直接将二进制数据载入内存来恢复。

如果 AOF 文件损坏，可以通过 `redis-check-aof` 工具修复：

```bash
redis-check-aof --repair appendonly.aof
```

`redis-check-rdb` 工具只能验证 RDB 文件的完整性，不支持修复：

```bash
redis-check-rdb dump.rdb
```

### 你在开发中是怎么配置 RDB 和 AOF 的？

大多数生产环境使用混合持久化：

```ini
appendonly yes
aof-use-rdb-preamble yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
save 900 1
save 300 10
save 60 10000
```

纯缓存场景只启用 RDB，关闭 AOF：

```ini
appendonly no
save 3600 1
save 300 100
```

高并发场景应设置 `no-appendfsync-on-rewrite yes`，避免 AOF 重写影响主进程性能；大型实例应设置 `rdb-save-incremental-fsync yes` 来减少大型 RDB 保存对性能的影响。

## 相关链接

- [[Redis 基础]] — Redis 整体概述
- [[高可用与集群]] — 持久化是高可用的基础
- [[Redis 进阶功能]] — 持久化对事务、Pipeline 的影响
- [[MySQL 引擎与日志]] — RDB 类似快照，AOF 类似 binlog
