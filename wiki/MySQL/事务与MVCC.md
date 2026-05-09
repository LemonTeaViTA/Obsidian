---
module: MySQL
tags: [MySQL, 事务, ACID, 隔离级别, MVCC, ReadView]
difficulty: hard
last_reviewed: 2026-05-09
---

# 事务与 MVCC

> 本文专讲事务的 ACID 特性、四大隔离级别、以及 MVCC 的实现原理。锁的具体类型、死锁与 DDL 操作请见 [[锁机制]]。

## 事务的 ACID

### MySQL 事务的四大特性说一下？

事务是一条或多条 SQL 语句组成的执行单元。四个特性分别是原子性、一致性、隔离性和持久性。

- 原子性：事务中的操作要么全部执行、要么全部失败
- 一致性：数据从事务开始前的一个一致状态转移到结束后的另外一个一致状态
- 隔离性：并发事务之间互不干扰
- 持久性：事务提交后数据不会丢失

#### 详细说一下原子性？

原子性意味着事务中的所有操作要么全部完成，要么全部不完成。如果事务中的任何一个操作失败了，整个事务都会回滚到事务开始之前的状态。

```sql
START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
UPDATE accounts SET balance = balance + 100 WHERE user_id = 2;
-- 如果第二条语句失败，第一条也会回滚
COMMIT;
```

#### 详细说一下一致性？

一致性确保事务从一个一致的状态转换到另一个一致的状态。比如在银行转账事务中，无论发生什么，转账前后两个账户的总金额应保持不变。

#### 详细说一下隔离性？

隔离性意味着并发执行的事务是彼此隔离的，一个事务的执行不会被其他事务干扰。隔离性主要是为了解决事务并发执行时可能出现的脏读、不可重复读、幻读等问题。

#### 详细说一下持久性？

持久性确保事务一旦提交，它对数据所做的更改就是永久性的，即���系统发生崩溃，数据也能恢复到最近一次提交的状态。MySQL 的持久性是通过 InnoDB 引擎的 redo log 实现的。

### ACID 靠什么保证的呢？

- 原子性：通过 Undo Log 实现，事务失败时根据 Undo Log 回滚
- 持久性：通过 Redo Log 实现，事务提交时先写 Redo Log 并刷盘
- 隔离性：由 MVCC 和锁机制共同实现
- 一致性：由其他三大特性协同保证

> [!tip] 一句话记住 ACID 的实现
> A 靠 **undo log 回滚**，D 靠 **redo log 重做**，I 靠 **MVCC + 锁**，C 是结果（前三者协同的结果）。这是面试官追问"ACID 怎么实现的"时的答题钥匙。

#### 详细说说如何保证持久性？

MySQL 的持久性主要由预写 Redo Log、双写机制、两阶段提交以及 Checkpoint 刷盘机制共同保证。

事务提交时，MySQL 会先将修改操作写入 Redo Log 并强制刷盘，再将内存中的数据页刷入磁盘。崩溃后通过 Redo Log 重放恢复数据。

InnoDB 的数据页大小为 16KB，大于操作系统的 4KB 页大小，为解决部分写入问题，MySQL 采用了双写机制：脏页刷盘时先写入 2MB 的双写缓冲区，再写入磁盘实际位置。

在涉及主从复制时，通过两阶段提交保证 Redo Log 和 Binlog 的一致性：第一阶段写入 Redo Log 并标记为 prepare 状态；第二阶段写入 Binlog 再提交 Redo Log 为 commit 状态。

#### 详细说说如何保证隔离性？

隔离性主要通过锁机制和 MVCC 来实现。一个事务正在修改某条数据时，MySQL 会通过临键锁来防止其他事务同时进行修改，避免数据冲突，同时临键锁可以防止幻读现象的发生。

MVCC 主要用来优化读操作，通过保存数据的历史版本，让读操作不需要加锁就能直接读取快照，提高读的并发性能。

#### 事务会不会自动提交？

是的，MySQL 默认开启了事务自动提交模式。每条��独的 SQL 语句都会被视为一个独立的事务处理单元，执行成功后自动 COMMIT，执行失败时自动 ROLLBACK。

```sql
SELECT @@autocommit;  -- 查看当前会话的自动提交状态

START TRANSACTION;
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
UPDATE accounts SET balance = balance + 100 WHERE user_id = 2;
COMMIT;
```

> [!warning] Spring `@Transactional` 与 autocommit 的微妙关系
> Spring 在进入 `@Transactional` 方法时会调用 `connection.setAutoCommit(false)`，方法结束时统一 commit/rollback。这意味着：方法内每条 SQL 都不再自动提交，全部走同一个事务。如果方法里抛了 RuntimeException 没被捕获，Spring 会回滚整个事务。详见 [[Spring 事务]]。

## 隔离级别

### 事务的隔离级别有哪些？

隔离级别定义了一个事务可能受其他事务影响的程度，MySQL 支持四种隔离级别：

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|---------|------|----------|------|
| Read Uncommitted（读未提交） | 可能 | 可能 | 可能 |
| Read Committed（读已提交） | 不会 | 可能 | 可能 |
| Repeatable Read（可重复读） | 不会 | 不会 | 可能（InnoDB 已解决） |
| Serializable（可串行化） | 不会 | 不会 | 不会 |

读未提交会出现脏读，读已提交会出现不可重复读，可重复读是 InnoDB 默认的隔离级别，通过 MVCC 和临键锁能够防止大多数并发问题。串行化最安全，但性能较差，通常不推荐使用。

> [!tip] MySQL 默认 RR，Oracle 默认 RC
> MySQL 的 InnoDB 默认隔离级别是 **Repeatable Read（可重复读）**，而 Oracle、PostgreSQL、SQL Server 的默认级别都是 **Read Committed（读已提交）**。原因是 MySQL 早期主从复制基于 statement 格式 binlog，必须用 RR + 间隙锁才能保证主从数据一致。但在生产实践中，**互联网公司（如阿里）的规约是把 MySQL 改为 RC**，因为 RC 没有间隙锁、死锁概率低、性能更高。

#### A 事务未提交，B 事务上查询到的是旧值还是新值？

如果 B 是普通的 SELECT（快照读），它读的是旧值，不会阻塞；如果 B 是当前读（`SELECT ... FOR UPDATE`），它会被阻塞直到事务 A 提交或回滚。

```sql
-- 会话A 更新但未提交
START TRANSACTION;
UPDATE accounts SET balance = 8000 WHERE name = '王二';

-- 会话B 快照读，读到旧值 1000
SELECT * FROM accounts WHERE name = '王二';

-- 会话C 当前读，被阻塞直到会话A 提交或回滚
SELECT * FROM accounts WHERE name = '王二' FOR UPDATE;
```

#### 怎么更改事务的隔离级别？

```sql
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;  -- 修改当前会话
SET GLOBAL TRANSACTION ISOLATION LEVEL READ COMMITTED;    -- 修改全局（影响新连接）
```

### 事务的隔离级别是如何实现的？

- 读未提交：通过行锁共享锁确保一个事务在更新行数据但没有提交的情况下，其他事务不能更新该行数据，但不会阻止脏读。
- 读已提交：在更新数据前加行级排他锁，不允许其他事务写入或读取未提交的数据。每次读取数据前都生成一个新的 ReadView，所以会出现不可重复读。
- 可重复读：只在第一次读操作时生成 ReadView，后续读操作都使用这个 ReadView，从而避免不可重复读。对于当前读操作，通过临键锁锁住当前行和前间隙，防止幻读。
- 串行化：读操作加表级共享锁，写操作加表级排他锁，直到事务结束后才释放锁。

### 请详细说说幻读呢？

幻读是指在同一个事务中，多次执行相同的范围查询，结果却不同。这种现象通常发生在其他事务在两次查询之间插入或删除了符合当前查询条件的数据。

#### 如何避免幻读？

MySQL 在可重复读隔离级别下，通过 MVCC 和临键锁可以在一定程度上避免幻读。

方式一：查询时显式加锁，利用临键锁锁定查询范围，防止其他事务插入新的数据：

```sql
START TRANSACTION;
SELECT * FROM user_info WHERE id > 1 FOR UPDATE; -- 加临键锁
COMMIT;
```

方式二：不要在事务中尝试去更新其他事务插入/删除的数据，利用快照读来避免幻读。

#### 什么是当前读呢？

当前读是指读取记录的最新已提交版本，并且在读取时对记录加锁，确保其他并发事务不能修改当前记录。`SELECT ... LOCK IN SHARE MODE`、`SELECT ... FOR UPDATE`，以及 UPDATE、DELETE，都属于当前读。

| SQL语句 | 是否当前读 | 是否加锁 |
|--------|----------|---------|
| SELECT * FROM user WHERE id=1 | 否 | 否 |
| SELECT * FROM user WHERE id=1 FOR UPDATE | 是 | 加排他锁 |
| SELECT * FROM user WHERE id=1 LOCK IN SHARE MODE | 是 | 加共享锁 |
| UPDATE user SET ... WHERE id=1 | 是 | 加排他锁 |
| DELETE FROM user WHERE id=1 | 是 | 加排他锁 |

#### 什么是快照读呢？

快照读是 InnoDB 通过 MVCC 实现的一种非阻塞读方式。当事务执行 SELECT 查询时，InnoDB 根据事务开始时生成的 Read View 去判断每条记录的可见性，从而读取符合条件的历史版本。

## MVCC

### MVCC 了解吗？

MVCC 指的是多版本并发控制，每次修改数据时，都会生成一个新的版本，而不是直接在原有数据上进行修改。每个事务只能看到在它开始之前已经提交的数据版本，读操作不会阻塞写操作，写操作也不会阻塞读操作。

其底层实现主要依赖于 Undo Log 和 Read View。每条记录会包含三个隐藏列：

- `DB_TRX_ID`：记录修改该行的事务 ID
- `DB_ROLL_PTR`：指向 Undo Log 中的前一个版本
- `DB_ROW_ID`：唯一标识该行数据（仅无主键时生成）

> [!tip] MVCC 的核心价值
> 没有 MVCC 之前，读会阻塞写、写会阻塞读，并发性能极差。MVCC 让 SELECT 走快照不加锁，UPDATE/DELETE 才走当前读加锁——读写不再互相阻塞，吞吐量大幅提升。这是 InnoDB 战胜 MyISAM 的核心武器之一。

### 请详细说说什么是版本链？

版本链是指 InnoDB 中同一条记录的多个历史版本，通过 `DB_ROLL_PTR` 字段将它们像链表一样串起来，用来支持 MVCC 的快照读。

当更新一行数据时，InnoDB 不会直接覆盖原有数据，而是创建一个新的数据版本，并更新 `DB_TRX_ID` 和 `DB_ROLL_PTR`，使它们指向前一个版本和相关的 undo 日志。这样，老版本的数据就不会丢失，可以通过版本链找到。

#### Undo Log 怎么知道前一个版本是什么、在哪？

靠的是每行记录里的隐藏字段 `DB_ROLL_PTR`（回滚指针）。它存储的是一个指向 Undo Log 段中具体位置的物理指针（rollback segment + page no + offset），���接定位到该行的上一个版本。

每次事务修改一行数据时，InnoDB 会：
1. 把旧值写入 Undo Log，生成一条 undo 记录
2. 把当前行的 `DB_ROLL_PTR` 指向这条新的 undo 记录
3. 这条 undo 记录自身也有一个 `DB_ROLL_PTR`，指向更早的 undo 记录

这样就形成了一条单向链表：**当前数据页的最新行 → undo 记录 V3 → undo 记录 V2 → undo 记录 V1**。ReadView 沿着这条链逐个比对 `DB_TRX_ID`，找到第一个对当前事务可见的版本就返回。

#### MVCC 的版本数据存储在哪里？

最新版本存储在 InnoDB 的数据页（Buffer Pool / 磁盘表空间）中，历史版本存储在 Undo Log 中。每次修改数据时，InnoDB 会先把旧值写入 Undo Log，然后在数据页上更新为新值，并通过 `DB_ROLL_PTR` 指向 Undo Log 中的旧版本。ReadView 判断当前版本不可见时，就沿着 `DB_ROLL_PTR` 回溯 Undo Log 版本链，找到对当前事务可见的那个版本。

> [!warning] 长事务会撑爆 undo log
> 如果一个事务持续 1 小时不提交，期间所有被修改过的记录都不能被 purge（清理 undo log），undo log 表空间会持续膨胀，最严重时把磁盘打满。**线上严禁长事务**——这也是为什么阿里 Java 手册要求：事务方法不要嵌套远程调用、循环里别开事务、查询 + 更新一起的事务要小。

### 请详细说说什么是 ReadView？

ReadView 是 InnoDB 为每个事务创建的一份"可见性视图"，用于判断在执行快照读时，哪些数据版本是当前事务可以看到的。

ReadView 记录了 4 个重要的信息：

- `creator_trx_id`：创建该 ReadView 的事务 ID
- `m_ids`：所有活跃事务的 ID 列表
- `min_trx_id`：所有活跃事务中最小的事务 ID
- `max_trx_id`：下一个将要生成的事务 ID

#### ReadView 是如何判断记录的某个版本是否可见的？

通过三个步骤来判断：

① 如果某个数据版本的 `DB_TRX_ID` 小于 `min_trx_id`，则该数据版本在生成 ReadView 之前就已经提交，对当前事务可见。

② 如果 `DB_TRX_ID` 大于 `max_trx_id`，则表示创建该数据版本的事务在生成 ReadView 之后开始，对当前事务不可见。

③ 如果 `DB_TRX_ID` 在 `min_trx_id` 和 `max_trx_id` 之间，需要判断 `DB_TRX_ID` 是否在 `m_ids` 列表中：不在则可见（已提交），在则不可见（仍活跃）。

#### 可重复读和读已提交在 ReadView 上的区别是什么？

- 可重复读：在第一次读取数据时生成一个 ReadView，这个 ReadView 会一直保持到事务结束，保证多次读取同一行数据时结果一致。
- 读已提交：每次读取数据前都生成一个新的 ReadView，保证每次读取的数据都是最新的。

#### 如果两个 AB 事务并发修改一个变量，那么 A 读到的值是什么？

取决于 A 是快照读还是当前读。如果是快照读，InnoDB 会使用 MVCC 的 ReadView 判断记录版本是否可见，若事务 B 尚未提交或在 A 的视图不可见，则 A 会读到旧值；如果是当前读，则需要加锁，若 B 已提交可直接读取，否则 A 会阻塞直到 B 结束。

## 相关链接

- [[锁机制]] — 行锁、间隙锁、临键锁、死锁
- [[索引机制详解]] — 索引决定锁的粒度
- [[引擎与日志]] — undo log 是 MVCC 的实现基础
- [[Spring 事务]] — Spring `@Transactional` 与 MySQL 隔离级别
- [[高可用与分库分表]] — 分布式事务的解决方案
