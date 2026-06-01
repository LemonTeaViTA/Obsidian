---
module: RAG
tags: [RAG, Code RAG, AST, 代码检索, Cursor, Claude Code]
difficulty: hard
last_reviewed: 2026-05-25
---

# Code RAG：代码理解与检索

> Cursor / Continue / Claude Code / GitHub Copilot 的核心技术。==文档 RAG 的方法论不能直接套到代码上==——代码有结构化、有依赖、有调用关系，需要专门的策略。本文讲清楚 Code RAG 与传统 RAG 的差异、AST 切分、代码 Embedding、仓库级索引、调用图增强。
>
> 通用 RAG 知识见 [[RAG基础与架构]]，本文只讲==代码场景特化==。

---

## 一、Code RAG 与传统 RAG 的差异

### 1.1 代码的特殊性

| 维度 | 文档（自然语言） | 代码 |
|------|----------------|------|
| ==结构== | 段落（弱） | AST 树（强） |
| ==依赖关系== | 隐式（语义关联） | ==显式==（import / call / inherit） |
| ==粒度== | 句子/段落 | 函数/类/文件/模块 |
| ==上下文== | 局部信息够用 | ==经常需要跨文件==（看类型定义、看调用方） |
| 同义性 | 同义词常见 | ==精确语义==（int 不是 long） |
| 长度分布 | 较均匀 | ==极不均衡==（getter 1 行 vs 长函数 200 行） |

### 1.2 同样的"切分 + 检索"思路用在代码上的问题

```python
# 用文档的方法切代码：
def chunk_code_naive(code, chunk_size=500):
    return [code[i:i+chunk_size] for i in range(0, len(code), chunk_size)]
```

==错==：
- 切到函数中间，半个函数没意义
- 切到字符串中间，破坏字符串
- 跨函数边界，==同一 chunk 里有两个不相关的函数==

==所以 Code RAG 必须用 AST-aware 的策略==。

### 1.3 Code RAG 解决的典型场景

| 场景 | 例子 |
|------|------|
| ==代码补全== | "我现在在写一个 OrderService，需要参考相似的 UserService" |
| ==代码搜索== | "怎么用 RestTemplate 发送 multipart 请求" |
| ==仓库问答== | "这个项目的认证逻辑在哪里实现？" |
| ==重构辅助== | "把所有用 deprecated API 的地方找出来" |
| ==代码审查== | "这个函数的所有调用方在哪？" |

---

## 二、代码分块策略

### 2.1 AST-aware 切分（基础）

AST-aware 切分是 Code RAG 的==基础==。用语法解析器（==tree-sitter==）解析代码，按函数/类/方法切分：

```python
# tree-sitter 是当前事实标准
import tree_sitter_languages

parser = tree_sitter_languages.get_parser("java")
tree = parser.parse(code.encode())

def extract_chunks(node):
    chunks = []
    for child in node.children:
        if child.type in ("method_declaration", "class_declaration"):
            chunks.append({
                "code": child.text.decode(),
                "type": child.type,
                "name": get_node_name(child),
                "start_line": child.start_point[0],
                "end_line": child.end_point[0],
            })
        chunks.extend(extract_chunks(child))
    return chunks
```

==tree-sitter 支持 ~40 种语言==——Java/Python/Go/JavaScript/Rust 等都有。

### 2.2 多粒度索引（Cursor 模式）

==Cursor 模式==的做法是==同一份代码同时建多个粒度的索引==：

```
file:        整个文件向量
class:       每个类向量
function:    每个函数向量
chunk:       函数内的细分块（长函数）
line range:  连续 30 行（cursor 用）
```

==检索时按需召回==：
- 查"某个功能在哪" → file/class 粒度
- 查"具体实现" → function 粒度
- 查"某段逻辑" → chunk/line 粒度

### 2.3 Function-level 切分要点

```python
def chunk_function(func_node, code_text, max_lines=80):
    """
    单个函数为一个 chunk。
    超长函数（如 200 行）按逻辑块再切：
    - if/for/while 块边界
    - 注释段边界
    """
    func_text = func_node.text.decode()
    if count_lines(func_text) <= max_lines:
        return [func_text]

    # 长函数按内部结构切
    sub_chunks = []
    for body_child in func_node.child_by_field_name("body").children:
        sub_chunks.append(body_child.text.decode())
    return sub_chunks
```

==跨函数边界绝对不能合并==。

### 2.4 元数据丰富化

```python
chunk_metadata = {
    "language": "java",
    "type": "method",                                  # method/class/file
    "name": "calculateTax",
    "qualified_name": "com.acme.OrderService.calculateTax",  # 全限定名
    "file_path": "src/main/java/com/acme/OrderService.java",
    "start_line": 145,
    "end_line": 178,
    "params": ["orderAmount", "taxRate"],              # 函数签名
    "return_type": "BigDecimal",
    "imports": ["java.math.BigDecimal"],               # 用到的导入
    "calls": ["getTaxRate", "round"],                  # 调用了哪些函数
    "called_by": ["processOrder", "previewOrder"],     # 谁调用了它（==关键==）
    "annotations": ["@Transactional", "@Cacheable"],
    "git_last_modified": "2024-12-15",
    "test_coverage": 0.85,                             # 测试覆盖率
}
```

==`calls` / `called_by` 是 Code RAG 的关键==——这是==调用图==的核心。

---

## 三、代码 Embedding 模型

### 3.1 主流模型

| 模型 | 参数 | 特点 |
|------|------|------|
| **CodeBERT** | 125M | 老牌，2020，6 种语言 |
| **GraphCodeBERT** | 125M | CodeBERT + 数据流图 |
| **Voyage-code-3** | API | 商业方案，代码检索效果强 |
| **Jina Code Embeddings**（jina-embeddings-v2-base-code） | 0.5B / 1.5B | Jina 出品，长上下文（8K） |
| **Salesforce CodeXEmbed**（SFR-Embedding-Code） | 400M / 2B / 7B | 多语言代码检索专用，开源 |
| **Nomic-Embed-Code** | 7B | 开源代码检索，2025 |
| **Qwen2.5-Coder-Embedding / CodeGemma-Embedding**（待核实） | — | 社区常提的"基于 Qwen2.5-Coder / CodeGemma 微调的 embedding"，是否有官方专用变体需按厂商最新发布核实 |

> [!warning] 模型名以厂商最新发布为准
> Code Embedding 领域更新很快，且"代码 LLM"与"代码 embedding 变体"经常被混称。表中 CodeBERT / GraphCodeBERT / Voyage-code-3 / Jina code embeddings / Salesforce CodeXEmbed / Nomic-Embed-Code 是已确认的代码检索模型；而"Qwen2.5-Coder-Embedding""CodeGemma-Embedding"这类名字可能指社区微调版而非官方专用 embedding，选型前请到对应厂商/HuggingFace 核实确切型号与参数。

### 3.2 通用 Embedding vs Code Embedding 对比

==代码场景中专门的 Code Embedding 显著优于通用 Embedding==：

```
查询: "如何在 Java 中读取 JSON 文件"

通用 Embedding（BGE-M3）：
  ❌ 召回：含 JSON 字符串的任意代码（包括序列化、转换等无关场景）

Code Embedding（Voyage-code-3 / CodeXEmbed）：
  ✅ 召回：FileReader + ObjectMapper.readValue 模式
  ✅ 理解到 "读取 JSON 文件" = 文件 IO + JSON 反序列化
```

==原因==：Code Embedding 训练时见过==代码模式==——知道 ObjectMapper 和 JSON 强相关，BGE-M3 只看到字面词。

### 3.3 选型建议

| 场景 | 推荐 |
|------|------|
| 中小规模（< 10万文件） | CodeXEmbed-2B / Jina code embeddings（开源、便宜） |
| 大规模 / 高精度 | CodeXEmbed-7B / Nomic-Embed-Code 或 Voyage-code-3 |
| 超大规模 / 商业 SLA | Voyage-code-3 / OpenAI text-embedding-3 |
| 单语言（如纯 Java） | 在通用代码 embedding 上微调（详见 [[RAG向量与Embedding#六、Embedding 微调]]） |

---

## 四、仓库级别 RAG（核心）

仓库级别 RAG 是 Code RAG 的==核心==——==Cursor / Continue / Claude Code 都做这件事==：把整个代码仓库索引起来，对话时实时检索。

### 4.1 整体流程

```
代码仓库
   ↓
[1] 文件遍历 + .gitignore 过滤
   ↓
[2] 语言检测（每文件）
   ↓
[3] AST 解析 + 多粒度切分
   ↓
[4] Code Embedding 编码
   ↓
[5] 调用图提取（LSP / 静态分析）
   ↓
[6] 向量库存储（Qdrant/Milvus）+ 调用图存储（图数据库 or 关系库）
   ↓
[7] 监听 git commit / 文件保存事件
   ↓
[8] 增量更新（==关键==）
```

### 4.2 增量更新（性能关键）

==仓库索引最大的成本是 embedding==——10 万文件首次索引可能要几小时。==每次代码改动都全量重索引==绝对不可行。

#### 增量策略

```python
def incremental_update(git_diff):
    """git commit 后增量更新"""
    changed_files = git_diff.changed_files()

    for file in changed_files:
        # 1. 删除该文件所有旧 chunk
        vector_db.delete(filter=f"file_path == '{file.path}'")

        # 2. 重新切分
        new_chunks = ast_chunk(file.path)

        # 3. 重新 embedding
        embeddings = embedder.embed([c.code for c in new_chunks])

        # 4. 重新入库
        vector_db.insert(zip(new_chunks, embeddings))

        # 5. 更新调用图（影响范围更大）
        update_call_graph(file.path)
```

==注意==：函数签名变化会影响所有调用方的 chunk 元数据（`called_by` 字段），需要==级联更新==。

#### 文件保存监听（更细粒度）

VSCode 插件级 RAG（如 Continue）监听 `onDidSaveTextDocument`：

```typescript
vscode.workspace.onDidSaveTextDocument(async (doc) => {
  await reindexFile(doc.fileName);
});
```

==秒级感知==代码变化。

### 4.3 检索策略

#### 多路召回（Cursor 实战）

==Cursor 实战==中的多路召回：

```python
def code_retrieve(query, current_file, cursor_position):
    # 路径 1：向量检索（语义相关）
    semantic_chunks = vector_db.search(query, top_k=20)

    # 路径 2：lexical 检索（关键词精确匹配）
    lexical_chunks = bm25.search(query, top_k=10)

    # 路径 3：当前文件附近（局部上下文）
    nearby_chunks = get_nearby(current_file, cursor_position, lines=50)

    # 路径 4：调用关系（看当前函数的调用方/被调用方）
    callgraph_chunks = call_graph.neighbors(current_function, depth=2)

    # 路径 5：最近编辑历史（用户刚改过的文件常常相关）
    recent_chunks = get_recently_edited(top_n=5)

    # RRF 融合
    return rrf_merge([
        semantic_chunks,
        lexical_chunks,
        nearby_chunks,
        callgraph_chunks,
        recent_chunks
    ], top_k=10)
```

==文档 RAG 通常 1-2 路召回，代码 RAG 经常 5+ 路==——上下文信号更丰富。

### 4.4 上下文窗口的代码组装

代码上下文窗口的组装策略和文档不同：

```
传统文档 RAG context：
  [chunk_1 文本]
  [chunk_2 文本]
  [chunk_3 文本]
  + query

代码 RAG context（==更有结构==）：
  ## 当前文件（用户正在编辑）：
  ```java
  src/main/java/OrderService.java
  ```

  ## 相关函数定义：
  - `Order.calculateTotal()` (Order.java:45)
  - `Tax.compute()` (Tax.java:12)

  ## 相关类型定义：
  - `class Order { ... }` (Order.java:1-30)

  ## 测试用例（如果有）：
  - `OrderServiceTest.testCalculate()`

  ## 用户问题/光标位置：
  ...
```

==显式标注每段的角色==——LLM 才能正确利用。

---

## 五、调用图增强（Code RAG 杀手锏）

调用图增强是 Code RAG 的==杀手锏==。

### 5.1 为什么需要调用图

==向量检索找不到"调用关系"==：

```
查询: "这个 calculateTotal 函数都被谁调用了？"

向量检索：召回==看起来语义相似==的代码（其他 calculate 函数）
正确答案：在调用图里查 in-edges
```

==调用图是结构化数据==，不应该靠向量瞎猜。

### 5.2 提取调用图

#### 方法 A：LSP（Language Server Protocol）

==每种语言都有 LSP server==（jdtls / gopls / pyright），提供精准的调用关系 API：

```python
# 类似 Claude Code 的 LSP MCP 集成
def get_callers(file_path, function_name):
    response = lsp_client.send_request("textDocument/references", {
        "textDocument": {"uri": file_path},
        "position": position_of(function_name)
    })
    return response.locations
```

==优点==：精准（编译器级），跨文件，==支持类型推断==
==缺点==：需要项目能编译（可能不可行）

#### 方法 B：静态分析

```python
# 用 tree-sitter 提取调用
def extract_calls(func_node):
    calls = []
    for child in walk(func_node):
        if child.type == "method_invocation":
            calls.append(get_call_target(child))
    return calls
```

==优点==：不要求编译
==缺点==：动态调用、反射、lambda 难处理

==生产推荐==：==LSP 主，静态分析兜底==。

### 5.3 调用图 + RAG 混合检索

```python
def graph_enhanced_retrieve(query, current_func):
    # 1. 向量检索找语义相关
    semantic = vector_search(query, top_k=10)

    # 2. 从当前函数出发，沿调用图扩展
    graph_neighbors = call_graph.bfs(
        start=current_func,
        depth=2,
        direction="both"  # 调用方 + 被调用方
    )

    # 3. 取交集 / 并集（按场景）
    if query_intent == "understand_impact":
        # "这个函数改了谁会受影响" → 沿调用关系
        return graph_neighbors
    elif query_intent == "find_similar":
        # "找类似的实现" → 向量
        return semantic
    else:
        # 综合 → 并集 + 重排
        return rerank(union(semantic, graph_neighbors))
```

### 5.4 工程实例：GitNexus

==[[Harness Engineering#GitNexus：代码库知识图谱引擎]]==——把整个代码库构建成知识图谱：

- 节点：文件 / 类 / 函数 / 变量 / 类型
- 边：定义 / 调用 / 继承 / 依赖
- 与向量库混合检索

详见 Harness Engineering wiki 中的 GitNexus 介绍。

---

## 六、生产工程模式

### 6.1 实时 vs 预索引

| 模式 | 适用 | 实现 |
|------|------|------|
| ==预索引== | IDE 插件、企业代码搜索 | 后台跑，索引存本地或服务端 |
| ==实时索引== | 临时仓库分析、新仓库快速上手 | 用户首次提问时实时构建 |
| ==混合== | Cursor 模式 | 启动时初始索引，编辑时增量更新 |

==Claude Code 走"按需索引"==：不预先全量索引，由 Agent 用 grep / find 工具按需读取。==优势==：零启动延迟、内存占用小；==劣势==：每次都要现读。

### 6.2 性能数据（参考）

| 仓库规模 | 全量初始索引 | 增量更新（每次 commit） | 单次查询延迟 |
|---------|-------------|----------------------|------------|
| 小（< 1万文件） | 5-10 分钟 | < 5 秒 | < 200ms |
| 中（1-10万文件） | 30-60 分钟 | 10-30 秒 | < 500ms |
| 大（> 10万文件） | 数小时 | 1-2 分钟 | < 1s（需要分布式） |

### 6.3 成本控制

==Embedding 调用费==是大头：

```
仓库 5 万文件 × 平均 5 chunk/文件 = 25 万 chunks
Embedding API 单价：$0.10 / 百万 token
平均 chunk 100 token → 2500 万 token → $2.5

每天增量更新 + 偶尔全量重建 → 月成本 ~$50-200
```

==中型团队==：本地部署轻量代码 embedding（如 CodeXEmbed-2B / Jina code embeddings，4GB GPU 跑），==成本几乎为零==。

---

## 七、实战建议

### 7.1 起步推荐组合

```
切分：tree-sitter（function-level）
Embedding：CodeXEmbed-2B / Jina code embeddings（本地）
向量库：Qdrant 或 ChromaDB
调用图：LSP（如有可编译项目）/ tree-sitter 静态分析
框架参考：Cursor / Continue / sweep-ai
```

### 7.2 进阶路径

```
基础（function-level + 向量检索）
  ↓
中级（多粒度 + 多路召回）
  ↓
高级（调用图 + 多路重排）
  ↓
顶级（Agentic 代码理解，Claude Code 模式：Agent 用工具按需读代码）
```

### 7.3 主流产品对比

| 产品 | 索引策略 | 检索策略 |
|------|---------|---------|
| **Cursor** | 仓库全量索引 + 增量 | 多路向量 + 关键词 + 文件路径 |
| **Continue (VSCode)** | 文件级实时索引 | 向量 + nearby + 调用图 |
| **GitHub Copilot** | 仓库索引 + 智能上下文 | 自适应（按 query 类型） |
| **Claude Code** | ==不预索引== | Agent 用 grep/find 工具实时读 |
| **sweep-ai** | 仓库索引 | 多路 + LLM 重排 |

==Claude Code 的"无索引"模式特别==——更像是 Agent 调工具读文件，而不是传统 RAG。==这是 Harness Engineering 的胜利==：让 Agent 自己探索，而不是预先索引一切。

---

## 相关链接

- [[RAG基础与架构]] — 通用 RAG 流程（本文是其代码场景特化）
- [[RAG向量与Embedding#六、Embedding 微调]] — Code Embedding 微调方法
- [[RAG检索策略]] — 多路召回 + 重排（在代码场景的特化）
- [[Harness Engineering#GitNexus：代码库知识图谱引擎]] — 调用图与代码 RAG 的工程实例
- [[AI 编程工具]] — Cursor / Claude Code 等的产品定位
