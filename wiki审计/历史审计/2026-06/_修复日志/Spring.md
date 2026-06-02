---
unit: Spring
fix_date: 2026-06-01
fixer: 知识库管理专家 + Spring 领域专家
phase: 1（单元内真实修复）
---

# Spring 单元修复日志

工作目录：`/home/ubuntu/ADgai/dsq/Obsidian/wiki/Spring/`
范围铁律：只改本文件夹；不碰 `Spring索引_MOC.md`（MOC，留阶段2）；不碰 `wiki/面试题目.md`；跨文件夹坏链只记录不改。

## 一、改了哪些文件、各做了什么

### 1. AOP 与动态代理.md
- **P2-3（逻辑 bug，事实性）**：JDK 动态代理 `invoke`（原 L149）与 CGLIB `intercept`（原 L197）两处示例 `return null;` → `return returnValue;`。原代码计算了 `returnValue` 却返回 null，对非 void 方法会丢弃真实返回值。
- **P2-8（域内冗余）**：`### AspectJ 是什么？` 小节原本重述了与 `### 说说 Spring AOP 和 AspectJ 区别？` 几乎相同的对比段落。精简为「定义 + `[!note]` callout 指回对比小节」，callout 用文件内锚点 `[[#说说 Spring AOP 和 AspectJ 区别？]]`（本文件内部锚点，已自修）。

### 2. Spring 基础与 IoC.md
- **P2-1（领域准确性）**：原「Spring ORM 提供了对 MyBatis-Plus 等 ORM 框架的集成支持」改为「Spring ORM 集成 Hibernate/JPA；MyBatis/MyBatis-Plus 不属于 Spring ORM，通过第三方 `mybatis-spring` 整合」。
- **P2-4（领域准确性，时序）**：Bean 生命周期「第三阶段：初始化」补全 BeanPostProcessor before/after 双回调，点明 `@PostConstruct` 由 `InitDestroyAnnotationBeanPostProcessor` 在 before 阶段触发、AOP 代理在 `postProcessAfterInitialization`（after）生成。
- **P2-5（结构，>400 行）**：在 H1 `# Spring 基础与 IoC` 下方新增 `> [!info] 本篇导读` callout，列出概述 / IoC·DI / Bean / 依赖注入四大块与高频考点。

### 3. Spring 事务.md
- **P2-2（领域准确性，会误导面试作答）**：`#### protected 和 private 方法加事务会生效吗？` 小节纠正「protected 理论上生效」的错误表述。明确根因是 `AnnotationTransactionAttributeSource` 默认 `publicMethodsOnly = true`，只解析 public 方法的事务属性；protected/default 即便能被 CGLIB 子类重写也不会织入事务。强调「能被重写 ≠ 事务生效」，声明式事务须标注 public 方法。

### 4. Spring Boot 与微服务.md
- **P2-7（时效性）**：自定义 Starter「第四步」主线由已废弃的 `META-INF/spring.factories` 改为 Boot 3.x 的 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`；旧机制降级为 `[!note] 兼容旧版本` callout 说明（含 Boot 2.7 起废弃、3.0 移除）。
- **P2-7 关联**：`#### Spring Boot Starter 的原理了解吗？` 小节中「`spring.factories` 是核心」的绝对表述改为「2.7 前 spring.factories / 3.0 起 AutoConfiguration.imports」并列说明。
- **P2-6（结构，重复+孤悬链接块）**：删除挂在「## 补充 → ### 注册中心挂了…」末尾、无 `##` 标题的孤悬相关链接块（原 L294-299），把其独有项（`[[Redis 基础]]`、`[[MySQL 基础与架构]]`、以及 MVC 一条更完整的描述）合并进正式的 `## 相关链接`，去重后保留 7 条。

## 二、拆分清单
无拆分。本单元最大文件 IoC.md 加导读 callout 后 427 行（<600 行阈值，方法论 >400 行仅要求顶部速览 callout，已满足），其余文件均 < 310 行。

## 三、锚点变更（供阶段2全局改链参考）
- **AOP 与动态代理.md**：`### AspectJ 是什么？` 标题文本未改（锚点不变），但其下正文大幅精简——若有指向该节具体句子的深链需复核。`### 说说 Spring AOP 和 AspectJ 区别？` 标题未改。
- **Spring 基础与 IoC.md**：所有 `##/###` 标题文本均未改动，仅在 H1 下新增 callout，**无锚点变更**。Bean 生命周期、单例/三级缓存等小节标题保持原样。
- **Spring 事务.md**：`#### protected 和 private 方法加事务会生效吗？` 标题未改，仅正文改写，**无锚点变更**。
- **Spring Boot 与微服务.md**：标题层级与文本未改，**无锚点变更**。
- 结论：本次修复**未改动任何标题文本**，不产生需要阶段2全局改链的锚点漂移。

## 四、暂存清单
无。本单元未发现需跨域搬迁的整段内容（无 ≥50 行跨域正文）。

## 五、留给阶段2的链接问题（跨文件夹坏链 / 锚点漂移，仅记录未改）

| 源文件:行 | 现链接 | 问题 | 建议指向 |
|----------|--------|------|----------|
| Spring 事务.md : 相关链接区（原 L117） | `[[MySQL 锁与事务机制]]` | 目标文件不存在；MySQL 域实际为 `锁机制.md` / `事务与MVCC.md` | `[[事务与MVCC]]`（隔离级别映射）或 `[[锁机制]]` |
| AOP 与动态代理.md : 相关链接区（L221） | `[[JVM 类加载机制]]` | 跨域，需核对 JVM 域是否存在同名文件/锚点 | 核对 JVM 域文件名 |
| AOP 与动态代理.md : 相关链接区（L222） | `[[线程基础与ThreadLocal]]` | 跨域，需核对并发域文件名 | 核对并发域文件名 |
| Spring 基础与 IoC.md : 相关链接区（L425-426 区域） | `[[JVM 内存管理]]`、`[[线程基础与ThreadLocal]]` | 跨域，需核对 JVM / 并发域文件名 | 核对对应域文件名 |
| Spring 事务.md : 相关链接区 | `[[线程基础与ThreadLocal]]` | 跨域，需核对并发域文件名 | 核对并发域文件名 |
| Spring Boot 与微服务.md : 相关链接区 | `[[Redis 基础]]`、`[[MySQL 基础与架构]]`、`[[高可用与分库分表]]` | 跨域，需核对 Redis / MySQL 域文件名是否精确匹配 | 核对对应域文件名 |

> 另：审计报告 P1-2 / P1-3 涉及 `wiki/面试题目.md` 锚点（指向 IoC 文档的 `#@Autowired 和 @Resource 注解的区别？` 与三级缓存小节）。本阶段铁律禁止改 `面试题目.md`，且本次未改动 IoC 文档相关标题，锚点目标依旧有效——交阶段2全局改链统一核对题目侧锚点文本。

## 六、P0/P1 修复计数与遗留

- 本单元审计报告内**无 P0**（0 红旗）。
- 审计报告中标注为 P1 的是「坏链/双向同步破损」三条（P1-1 跨域坏链、P1-2 / P1-3 面试题目锚点）——**全部属于跨文件夹链接问题，按铁律只记录不改**（见上表，交阶段2）。
- 任务单（本阶段实际可执行项，报告中归为 P2 但属本阶段「事实性错误/结构/时效性/域内SSoT」范畴）：**共 8 项，全部修复**。
  - 领域准确性（事实性）：P2-1、P2-2、P2-3、P2-4 — 4/4 ✅
  - 结构 / 时效性 / 域内冗余：P2-5（导读）、P2-6（重复链接块）、P2-7（Starter 3.x）、P2-8（AspectJ 去重）— 4/4 ✅
- **未修（按铁律保留）**：
  - P2-9（MOC 伪标题、「抛奔了」笔误）：位于 `Spring索引_MOC.md`，MOC 文件留阶段2，**未碰**。
  - 全部跨文件夹坏链/锚点：见第五节，留阶段2。

## 七、校验
- 6 文件均单一 H1；代码围栏成对（fence 数为偶）；改动后仍为合法 Markdown。
- 未引入 00-/01- 前缀文件；callout 仅用 info/note/tip/warning，无嵌套、无连用。
