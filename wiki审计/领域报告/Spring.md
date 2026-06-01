---
audit_unit: Spring
audit_date: 2026-06-01
auditor: 知识库管理专家 + Spring 领域专家
scope: 只读审计，禁止修改 wiki 原文件
---

# Spring 单元审计报告

## ① 单元概览

审计目录：`/home/ubuntu/ADgai/dsq/Obsidian/wiki/Spring/`，共 6 个 `.md` 文件。

| 文件 | 行数 | frontmatter | 健康度 | 主要问题 |
|------|------|------------|--------|----------|
| Spring 基础与 IoC.md | 417 | 完整 | 🟡 | >400 无顶部摘要 callout；MyBatis-Plus 归入 Spring ORM 的技术表述错误；Bean 生命周期 BPP 时序简化 |
| Spring Boot 与微服务.md | 306 | 完整 | 🟡 | 两个「相关链接」块（一个无标题孤悬于「补充」内）；自定义 Starter 教程主线仍以已废弃的 spring.factories 为主 |
| AOP 与动态代理.md | 222 | 完整 | 🟡 | JDK/CGLIB 两段示例 `return null` 丢弃真实返回值（逻辑 bug）；AspectJ 对比内容文内重复两处 |
| Spring 事务.md | 118 | 完整 | 🟡 | protected 方法「理论上事务生效」表述不准确；跨域坏链 `[[MySQL 锁与事务机制]]` |
| Spring MVC 架构.md | 63 | 完整 | 🟢 | 无明显问题，内容准确清晰 |
| Spring索引_MOC.md | 53 | 完整 | 🟢 | 导航小节用「加粗伪标题」而非真实 `##/###`，略削弱锚点；覆盖完整无孤儿 |

整体健康度：🟡（0 红旗，多处黄/P1/P2）。frontmatter 四字段全部齐全，`last_reviewed` 均为 2026-05-09（≤6 月），零 UTF-8 乱码，无 >600 行文档，无 Diátaxis ≥2 类混杂的红旗，无域内 SSoT P0 违规。

---

## ② 逐条问题（P0/P1/P2）

### P1 — 坏链 / 双向同步破损

**P1-1｜跨域 wikilink 指向不存在的文件**
- 文件：`Spring 事务.md` 第 117 行
- 问题：`[[MySQL 锁与事务机制]]` 目标文件不存在。MySQL 域实际文件为 `锁机制.md` 与 `事务与MVCC.md`，没有「MySQL 锁与事务机制」。
- 修复：改为 `[[锁机制]]` 或 `[[事务与MVCC]]`（隔离级别映射建议指向 `事务与MVCC`）。

**P1-2｜面试题目.md 锚点与标题不精确匹配（双向同步破损）**
- 文件：`面试题目.md` 第 289 行
- 问题：链接锚点 `[[Spring 基础与 IoC#@Autowired 和 @Resource 的区别]]`，但 IoC 文档实际标题为 `### @Autowired 和 @Resource 注解的区别？`（多了「注解」二字与结尾「？」）。锚点文本与标题未精确一致，链接无法跳转。
- 修复：把题目锚点改为 `#@Autowired 和 @Resource 注解的区别？`。

**P1-3｜面试题目锚点语义错配（链接可跳但答非所问）**
- 文件：`面试题目.md` 第 288 行
- 问题：题目「Spring 如何解决循环依赖？三级缓存了解吗？」链接到 `#🌟项目启动时Spring的IoC会做什么？`，但该小节讲的是启动流程，**完全没有**三级缓存/循环依赖内容。三级缓存正文实际位于 IoC 文档 `### Spring如何实现单例模式？`（第 361-375 行，含 warning callout）。
- 修复：锚点改指向 `#Spring如何实现单例模式？`，或在 IoC 文档中将三级缓存独立成「如何解决循环依赖」小节后再对齐。

### P2 — 领域知识准确性

**P2-1｜MyBatis-Plus 被错误归入 Spring ORM 模块**
- 文件：`Spring 基础与 IoC.md` 第 42 行
- 问题：「Spring ORM 提供了对 MyBatis-Plus 等 ORM 框架的集成支持」。Spring ORM 模块集成的是 Hibernate/JPA/JDO；MyBatis 不属于 Spring ORM，且 MyBatis 是半自动持久层框架（非严格 ORM），其与 Spring 的整合走第三方 `mybatis-spring`，MyBatis-Plus 又是 MyBatis 的增强。表述存在概念混淆。
- 修复：改为「Spring ORM 集成 Hibernate/JPA 等 ORM 框架；MyBatis/MyBatis-Plus 通过 mybatis-spring 整合」。

**P2-2｜protected 方法事务「理论上生效」表述不准确**
- 文件：`Spring 事务.md` 第 111 行
- 问题：「对于 protected 方法来说……所以理论上通过代理对象调用时事务是生效的」。实际上 Spring 的 `AnnotationTransactionAttributeSource` 默认 `publicMethodsOnly=true`，只解析 **public** 方法的事务属性；protected/default 即便走 CGLIB 子类代理，事务通常也不会生效。原文给读者「protected 可能生效」的误导。
- 修复：明确「Spring 声明式事务默认仅对 public 方法生效，protected/default 即使能被子类重写也不会织入事务」。

**P2-3｜JDK / CGLIB 代理示例丢弃真实返回值（逻辑 bug）**
- 文件：`AOP 与动态代理.md` 第 145-151 行（JDK `invoke`）与第 193-198 行（CGLIB `intercept`）
- 问题：两段都先 `Object returnValue = method.invoke(target, args);` 计算了返回值，却 `return null;`。`returnValue` 被计算后从未使用，对非 void 方法会错误返回 null。
- 修复：两处均改为 `return returnValue;`。

**P2-4｜Bean 生命周期中 BeanPostProcessor 时序简化**
- 文件：`Spring 基础与 IoC.md` 第 320-325 行
- 问题：原文叙述为「@PostConstruct → afterPropertiesSet → initMethod，初始化后再调用 BeanPostProcessor 后置处理」。实际上 `postProcessBeforeInitialization` 在 @PostConstruct/afterPropertiesSet 之前执行（@PostConstruct 本身由 InitDestroyAnnotationBeanPostProcessor 在 before 阶段触发），`postProcessAfterInitialization`（AOP 代理生成处）才在 initMethod 之后。仅提「后置处理」忽略了 before 环节。属面试可接受的简化，但严格性欠佳。
- 修复：补一句「初始化前后各有一次 BeanPostProcessor 回调（before/after）」。

### P2 — 知识库管理（结构 / 边界 / Diátaxis / 冗余）

**P2-5｜>400 行文档缺顶部渐进式摘要 callout**
- 文件：`Spring 基础与 IoC.md`（417 行）
- 问题：方法论要求 >400 行文档应有顶部渐进式摘要 callout，本文直接从「## Spring 概述」开始，缺少导读。
- 修复：在 H1 下补一个 `> [!info] 本篇导读` callout，列出 IoC/Bean/DI 三大块与高频考点。

**P2-6｜重复且孤悬的「相关链接」块**
- 文件：`Spring Boot 与微服务.md` 第 294-299 行 与 第 301-306 行
- 问题：存在两个相关链接列表。第一个（294-299）挂在「## 补充 → ### 为什么需要注册中心」之后，没有自己的 `## 相关链接` 标题，等于孤悬在补充小节内；第二个（301-306）才是正式的 `## 相关链接`。两者内容部分重叠（IoC/AOP/事务）。
- 修复：删除第一个块，把其中独有项（Redis 基础、MySQL 基础与架构）合并进正式的 `## 相关链接`。

**P2-7｜自定义 Starter 教程主线仍以已废弃机制为主（过时倾向）**
- 文件：`Spring Boot 与微服务.md` 第 70-75 行
- 问题：自定义 Starter 第四步直接演示在 `META-INF/spring.factories` 注册（Boot 2.x 机制）。虽然第 88 行 warning 已指出 3.0 改用 `AutoConfiguration.imports`，但教程操作主线仍是旧机制。2026 年新项目普遍 Boot 3.x + JDK 17，建议正文步骤直接给新机制。
- 修复：第四步示例改为 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`，旧机制降为兼容性说明。

**P2-8｜AOP 文档内 AspectJ 对比重复两处（域内轻度冗余）**
- 文件：`AOP 与动态代理.md` 第 74-80 行「Spring AOP 和 AspectJ 区别」与 第 211-216 行「AspectJ 是什么」
- 问题：两处均叙述「Spring AOP 只支持方法级别 / 只能拦截容器管理的 Bean，AspectJ 可织入字段/构造/异常」，内容近乎重复。未达 SSoT P0（非 ≥50 行重复），属同文档内冗余。
- 修复：将「AspectJ 是什么」精简为定义 + callout 链接到对比小节，避免重述。

**P2-9｜MOC 用加粗伪标题代替真实 Markdown 标题**
- 文件：`Spring索引_MOC.md` 第 20-41 行
- 问题：「核心重灾区：底层思想 IoC」等导航小节以行首空格 + 加粗/emoji 呈现，而非真实 `##/###` 标题，导致大纲面板与锚点跳转缺失。另第 40 行「抛奔了 Spring Boot」措辞疑似笔误（抛弃/投奔混写）。
- 修复：将各导航小节改为真实 `###` 标题；修正「抛奔了」措辞。

---

## ③ 领域知识点准确性评价

整体技术质量较高，覆盖了 Java + Agent 求职方向中后端必备的 Spring 高频考点，且对 2026 年现状有针对性更新（Boot 3.0 自动装配迁移、Boot 2.0+ 默认 CGLIB、阿里手册 @Resource 建议、三级缓存仅解 Setter 循环依赖等 callout 都准确且有面试价值）。

准确且到位的部分：
- IoC/DI 区分、BeanFactory vs ApplicationContext（懒/饿加载）、三级缓存定义与「构造器注入解不了」的跟进点，表述准确。
- 事务七大传播行为、REQUIRED/REQUIRES_NEW 组合的回滚结论、隔离级别、@Transactional 四类失效场景，准确且贴合面试。
- AOP 织入三时机、五种通知、Spring AOP vs AspectJ 机制差异，概念清晰。
- Spring MVC 组件链路与 RESTful/HttpMessageConverter 流程，准确无误（本单元最干净的一篇）。
- Spring Cloud Alibaba 组件、注册中心 AP/CP 对比、注册中心宕机本地缓存兜底，工程视角到位。

需修正的技术点：见 P2-1（MyBatis-Plus 误入 Spring ORM）、P2-2（protected 事务生效误导）、P2-3（代理示例 return null 丢返回值）、P2-4（BPP 时序简化）。其中 P2-2、P2-3 是会被面试官追问/能跑出��误结果的实质问题，建议优先修。

未发现遗漏的致命空白；若要进一步加深面试深度，可补充：循环依赖为何需要三级而非二级缓存（与 AOP 代理提前暴露的关系）、@Async/事务自调用失效的统一根因（同为 this 绕过代理）、SpringApplication.run 中 SpringApplicationRunListener/事件机制。这些属增强项，非缺陷。

---

## ④ 本单元小结

Spring 单元 6 篇文档结构规范、frontmatter 齐全、review 日期新鲜、无乱码、无 >600 行超长文、无 Diátaxis ≥2 类混杂、无域内 SSoT P0 违规，整体处于健康偏上水平。无 🔴 红旗。

需整改项集中在两类：一是链接质量（1 处跨域坏链 `MySQL 锁与事务机制`、1 处面试题锚点不精确匹配、1 处锚点语义错配，均影响双向同步与跳转），二是少量领域准确性瑕疵（MyBatis-Plus 归类、protected 事务、代理示例 return null）。另有 IoC 文档缺顶部摘要、Boot 文档重复相关链接块、Starter 教程主线偏旧、MOC 伪标题等结构/时效性黄旗。

建议优先级：先修 3 处链接问题（P1，影响知识库可用性与双向同步硬指标）→ 再修 P2-2/P2-3 两个会误导面试作答的技术点 → 最后处理摘要 callout、重复链接块、Starter 教程主线等结构项。整体健康度：🟡。
