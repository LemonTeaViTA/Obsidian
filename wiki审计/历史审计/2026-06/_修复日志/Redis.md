# Redis 单元修复日志

- 单元：Redis
- 修复人：知识库管理 + Redis 领域知识专家
- 日期：2026-06-01
- 工作目录：/home/ubuntu/ADgai/dsq/Obsidian/wiki/Redis/

## 一、改了哪些文件、各做了什么

### 1. Redis 实战场景.md（新建）
- 新建文件，作为秒杀 / 限流 / SCAN / 客户端断连检测的实战 How-to 唯一出处（SSoT）。
- 顶部加 `[!info] 本文导读` 速览 callout。
- 内容：海量 key 按前缀查找（SCAN）、秒杀场景五角色、三种限流算法（计数器/滑动窗口/令牌桶，含 Lua）、客户端断连检测（tcp-keepalive / timeout / 连接池）。
- 167 行，单一 Diátaxis 类型（How-to）。

### 2. 底层数据结构与实战.md
- 加顶部 `[!info] 本文导读` 速览 callout（P1-4）。
- **删除整个「实战应用」章节**（原 L301–418，约 120 行：SCAN 前缀、秒杀角色、限流、客户端断连），迁移到 Redis 实战场景.md。原 `## 实战应用` 小节保留为标题 + 一个 `[!info] 该内容已迁移，见 Redis 实战场景` 占位 callout（P0-1）。
- SDS 结构（原 L40–47）：补充 `[!note] 3.2+ 实际拆分为 5 种 sdshdr`，说明 sdshdr5/8/16/32/64、flags、alloc 取代 free（P1-5）。
- intset 结构（原 L183–191）：encoding 注释改为 INTSET_ENC_INT16/32/64，新增 `[!note] contents 的真实类型`，说明 int8_t[] 是裸字节缓冲、元素按 encoding 解释为 2/4/8 字节（P1-8）。
- 相关链接新增 `[[Redis 实战场景]]`。
- 行数 425 → 326。

### 3. Redis 进阶功能.md
- 加顶部 `[!info] 本文导读` 速览 callout（P1-4）。
- 「消息队列」末尾新增「Redis Stream 是什么？」小节：XADD/XREAD/XGROUP/XREADGROUP/XACK/XPENDING、消费组、PEL/XCLAIM、与 Kafka 对比、Spring Data Redis StreamMessageListenerContainer 集成（P1-6）。
- 「Lua 脚本」小节：**删除滑动窗口限流 Lua 代码块**（原 L249–265），改为一句话 + 链接 `[[Redis 实战场景#限流方案]]`（P0-1，限流 SSoT 收敛到实战场景）。保留秒杀 Lua、解锁 Lua（这两段是 Lua 语法示例，留在本文）。
- 相关链接新增 `[[Redis 实战场景]]`。
- 行数 403 → 431（净增因 Stream 小节 + 速览，删了限流 Lua）。

### 4. Redis 基础.md
- 「部署过 Redis 吗？」小节：**删除 `make && make install`、redis.conf、docker run 等安装命令**，合并原「高可用方案部署过吗」小节，精简为一句"部署过单机/Docker/哨兵/Cluster，详见 [[高可用与集群]]"（P1-1）。
- 「Redis 可以用来干什么？」小节：**删除 22 行令牌桶 Lua 代码块**，改为一句话 + 链接 `[[Redis 实战场景#限流方案]]`（P0-1/P1-2）。
- 「Redis 为什么快」callout：6.0 多线程 callout 精简，去掉与下文「Redis 6.0 使用多线程是怎么回事」重复的完整阐述，改为一句 + "详见下文"（P1-3）。完整解答保留在 L218 小节。
- 相关链接新增 `[[Redis 实战场景]]`。
- 行数 285 → 243。Diátaxis 收敛为 Explanation + Reference（去掉了 How-to 部署/Lua）。

### 5. 缓存经典问题.md
- 加顶部 `[!info] 本文导读` 速览 callout（P1-4）。
- 「如何保证本地缓存和分布式缓存的一致」末尾新增「Redis 6 的 Client-side caching 是什么？」小节：CLIENT TRACKING、per-key / BCAST 两种模式、Lettuce/Jedis 支持现状（P1-7）。
- 相关链接新增 `[[Redis 实战场景]]`。
- 行数 502 → 524。

### 未改动文件
- Redis 持久化.md、高可用与集群.md：报告判定 🟢，无 P0/P1，未改。
- Redis索引_MOC.md：按铁律不碰 MOC，未改。

## 二、拆分清单

| 旧文件 | 动作 | 新文件 / 去向 | 装什么 |
|--------|------|--------------|--------|
| 底层数据结构与实战.md「实战应用」节 | 拆出 | **Redis 实战场景.md（新建）** | SCAN 前缀查找、秒杀五角色、限流三算法（含 Lua）、客户端断连检测 |
| Redis 进阶功能.md「Lua 脚本」滑动窗口限流 | 去重删除 | 合并进 Redis 实战场景.md#限流方案 | 滑动窗口 Lua |
| Redis 基础.md 令牌桶 Lua | 去重删除 | 指向 Redis 实战场景.md#限流方案 | 令牌桶 Lua（实战场景已有等价令牌桶脚本） |

## 三、锚点变更（阶段2全局改链可能用到）

- 底层数据结构与实战.md：`## 实战应用` 标题**保留**（仅内容变为迁移 callout），其下原三级标题已删除：
  - 旧锚点 `底层数据结构与实战#假如 Redis 里面有 1 亿个 key...` → 新 `Redis 实战场景#海量 key 按前缀查找` 内的同名 H3
  - 旧锚点 `底层数据结构与实战#Redis 在秒杀场景下可以扮演什么角色？` → `Redis 实战场景#Redis 在秒杀场景下可以扮演什么角色？`
  - 旧锚点 `底层数据结构与实战#Redis 如何做限流呢？` → `Redis 实战场景#Redis 如何做限流呢？`
  - 旧锚点 `底层数据结构与实战#客户端宕机后 Redis 服务端如何感知到？` → `Redis 实战场景#客户端宕机后 Redis 服务端如何感知到？`
- 其余文件标题未改名、未移动。
- 经检索，wiki 内当前无其他文件深链到上述旧锚点（仅 MOC 用 `[[底层数据结构与实战]]` 文件级链接，不受影响）。

## 四、暂存清单

无。本单元所有迁移均发生在 Redis 文件夹内部（同域），未跨域，故未写 _迁移暂存/。

## 五、留给阶段2的链接问题

1. **MOC 缺新文件链接**：Redis索引_MOC.md L24–27「核心重灾区：底层数据结构与实战」段落正文提到"海量前缀 KEY 匹配和秒杀场景的实战运用"，但这些内容已迁出到新文件 [[Redis 实战场景]]。建议阶段2在 MOC 中新增一个指向 `[[Redis 实战场景]]` 的条目/链接。（本阶段按铁律不碰 MOC）
2. **MOC 列表语法（P2-1，遗留）**：Redis索引_MOC.md L20–46 学习模块用前导空格而非 `-`，渲染为段落。建议阶段2统一改为 `- **xxx**`。（属 MOC，未动）
3. 跨文件夹链接核查：`[[Spring Boot 与微服务]]`、`[[HashMap核心原理]]`、`[[MySQL 基础与架构]]` 目标文件均存在（分别在 Spring/、集合框架/、MySQL/），**无坏链**。

## 六、P0/P1 完成情况

### P0（1 条）
- ✅ P0-1 SSoT 违规：实战 How-to 多文件重复。已全部收敛——实战内容统一到新建 Redis 实战场景.md；底层数据结构与实战.md 删实战节留迁移 callout；进阶功能.md 删滑动窗口限流 Lua 改链接；基础.md 删令牌桶 Lua 改链接。限流的唯一全文出处 = Redis 实战场景#限流方案。

### P1（8 条）
- ✅ P1-1 基础.md 删部署/安装命令（make/docker/redis.conf），精简为一句 + 链接。
- ✅ P1-2 基础.md Diátaxis 收敛：去掉部署 How-to 与令牌桶 Lua，聚焦 Explanation + Reference。
- ✅ P1-3 基础.md 6.0 多线程 callout 去重，精简为一句 + "详见下文"。
- ✅ P1-4 三篇 >400 行文档补顶部 `[!info]` 速览 callout（进阶功能 / 底层数据结构 / 缓存经典问题）；新建的实战场景也加了。
- ✅ P1-5 SDS 源码过时：补 3.2+ 五种 sdshdr 说明 callout。
- ✅ P1-6 补 Redis Stream 小节（消费组/ACK/PEL/Kafka 对比/Spring 集成）。
- ✅ P1-7 补 Client-side caching（CLIENT TRACKING / per-key / BCAST / Lettuce-Jedis 支持）。
- ✅ P1-8 intset contents 字节数组 + encoding 动态解释说明。

### 本阶段未做（按范围/铁律保留）
- P2-1～P2-5 全部 P2 项未做（限定本阶段做 P0+P1）：MOC 列表语法、缓存经典问题接近 600 行、GEORADIUS 弃用标注、Redlock 争议展开、看门狗 Netty 细节。其中 GEORADIUS/Redlock/看门狗为可选增量，缓存经典问题.md 当前 524 行仍 <600 阈值、暂不需拆。
- MOC 相关（铁律不碰）：见「留给阶段2」。

## 七、本单元文件最终行数

| 文件 | 修复前 | 修复后 |
|------|-------|-------|
| Redis 基础.md | 285 | 243 |
| Redis 实战场景.md | — | 167（新建）|
| Redis 持久化.md | 201 | 201 |
| Redis 进阶功能.md | 403 | 431 |
| 底层数据结构与实战.md | 425 | 326 |
| 缓存经典问题.md | 502 | 524 |
| 高可用与集群.md | 234 | 234 |
| Redis索引_MOC.md | 57 | 57（未动）|

所有文件均 <600 行，结构合法（单 H1、H2 ≤8、无跳级、代码块带语言标签、callout 仅 tip/info/note/warning）。
