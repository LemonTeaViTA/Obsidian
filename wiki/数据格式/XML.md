---
module: 数据格式
tags: [数据格式, XML, 标记语言, DOM]
difficulty: easy
last_reviewed: 2026-05-20
---

# XML

> XML 是基础但常被跳过的概念。理解 XML 是理解 docx/xlsx/pptx 内部结构、Spring/Mybatis 配置、SVG 图形、SOAP 协议、Claude Prompt 标签的前置。本文只讲基础概念。

---

## 一、什么是标记语言

写文档时，"内容"和"内容的角色"是两码事：

- 内容："第一章 引言"
- 角色："这是一级标题"

只存纯文本，角色信息就丢了。==标记语言（Markup Language）的核心思想：用**标签**把内容的角色信息和内容捆在一起。==

```
<h1>第一章 引言</h1>      ← 标签 h1 表示"这是一级标题"
<p>这是一段正文。</p>      ← 标签 p 表示"这是段落"
```

**共同祖先：SGML**（Standard Generalized Markup Language，1986）。

SGML 太复杂，后来分化出两支：
- **HTML**：简化版，固定一套标签，专为网页设计
- **XML**：保留可扩展性，用于通用数据描述

---

## 二、XML 是什么、为什么会有它

**XML = eXtensible Markup Language（可扩展标记语言）**，1998 年 W3C 标准。

### 为什么会有 XML

HTML 的标签是==固定==的——浏览器只认 `<h1>`、`<p>`、`<table>` 这些。但人们想用标签描述任何领域的数据：发票、订单、医疗记录、配置文件……HTML 标签不够用，又不能随便造（造了浏览器也不认）。

XML 的设计目标：==允许自己定义标签==，只要满足语法规则，任何工具都能解析。

### 一个 XML 例子

```xml
<?xml version="1.0" encoding="UTF-8"?>
<order id="A-2026-001">
  <customer>
    <name>张三</name>
    <phone>13800138000</phone>
  </customer>
  <items>
    <item>
      <product>笔记本</product>
      <price currency="CNY">5999</price>
      <quantity>1</quantity>
    </item>
    <item>
      <product>键盘</product>
      <price currency="CNY">399</price>
      <quantity>2</quantity>
    </item>
  </items>
  <total>6797</total>
</order>
```

### XML 的核心特性：自描述

看一眼标签就知道字段含义：`<customer>` 是客户、`<price currency="CNY">` 是人民币价格。**不需要额外文档说明数据格式**——这就是"自描述性"。

---

## 三、XML 树

XML 文档天然是==树形结构==（嵌套的标签自然成树）。

### 三种节点

| 节点类型 | 例子 | 说明 |
|---------|------|------|
| 元素节点（Element） | `<order>`、`<customer>` | 标签本身，可以有子节点 |
| 属性节点（Attribute） | `id="A-2026-001"`、`currency="CNY"` | 挂在元素节点上的键值对 |
| 文本节点（Text） | `张三`、`5999` | 元素的文本内容，是叶子节点 |

### 树形结构示例

上面的订单 XML 对应的树：

```
order (id="A-2026-001")              ← 根节点
├── customer
│   ├── name → "张三"
│   └── phone → "13800138000"
├── items
│   ├── item (第一个)
│   │   ├── product → "笔记本"
│   │   ├── price (currency="CNY") → "5999"
│   │   └── quantity → "1"
│   └── item (第二个)
│       ├── product → "键盘"
│       ├── price (currency="CNY") → "399"
│       └── quantity → "2"
└── total → "6797"
```

### 良构（well-formed）的基本规则

- ==必须有且只有一个根节点==
- 标签必须开闭对称：`<a>...</a>`，空元素用 `<a/>` 自闭合
- 嵌套必须合法：`<a><b></b></a>` 对，`<a><b></a></b>` 错
- 属性值必须用引号：`id="A1"`，不能写 `id=A1`
- 大小写敏感：`<Order>` 和 `<order>` 是不同标签

不满足良构规则的 XML，标准解析器会直接报错（HTML 则容错）。

---

## 四、XML 与 HTML、JSON 的对比

XML 经常被拿来和 HTML、JSON 比较。理解三者的差异有助于明白 XML 的定位。

| 特性 | XML | HTML | JSON |
|------|-----|------|------|
| 标签 | 可扩展（自定义） | 固定（浏览器认的那套） | 无标签，只有键值对 |
| 容错 | 严格闭合，不闭合就报错 | 容错（浏览器尽量渲染） | 严格语法，多余逗号就报错 |
| 主要目的 | 描述结构化数据/文档 | 描述网页表现 | 描述结构化数据 |
| 自描述 | 强（标签即语义） | 中（部分标签有语义） | 弱（只有键名暗示语义） |
| 体积 | 冗长（开闭标签翻倍） | 中等 | 紧凑 |
| 注释 | 支持 `<!-- -->` | 支持 `<!-- -->` | 不支持 |
| 典型应用 | 配置文件、文档格式（docx）、SOAP | 网页 | API 数据传输 |

**一句话总结：**
- **XML**：适合==有层次的复杂文档==（合同、配置、富文本）
- **HTML**：是 XML 思想在网页表现层的特化
- **JSON**：适合==轻量数据传输==，前后端 API 主流

> [!info] 同一个订单的三种表达
> 同一个订单数据，XML 约 300 字节、HTML 不适合存数据、JSON 约 150 字节。但 XML 能附加更多元信息（属性、命名空间、注释），适合需要长期归档的复杂结构。

---

## 五、原生语义与"XML 原生"格式

这是==理解文档解析为什么有难易之分的关键概念==。

### 什么叫"原生语义"

==标签本身就携带"这是什么"的语义信息==，机器不用猜。

```xml
<w:p>            ← w:p = paragraph，"这是段落"
  <w:pPr>
    <w:pStyle w:val="Heading1"/>   ← "这段用 Heading1 样式（一级标题）"
  </w:pPr>
  <w:r><w:t>第一章 引言</w:t></w:r>
</w:p>
```

`w:pStyle="Heading1"` 这个标签直接告诉解析器："这一段是一级标题"。==解析器不需要看字号、字重、颜色去推断==。

### 为什么 docx/xlsx/pptx 是"XML 原生"

==Word/Excel/PowerPoint 的 .docx/.xlsx/.pptx 文件，本质是 ZIP 压缩包，里面装的是一堆 XML 文件==——把 `xxx.docx` 改名为 `xxx.zip` 就能直接解压看到。

这套文件格式叫 **OOXML（Office Open XML）**，是 ECMA-376 / ISO 29500 国际标准。三种文件共享一套容器规范：
- 解压后都有 `[Content_Types].xml`、`_rels/` 这些公共结构
- 主体内容分别在 `word/`、`xl/`、`ppt/` 目录下
- 主文档（如 `word/document.xml`、`xl/worksheets/sheet1.xml`）里用带原生语义的 XML 标签和属性表达内容

举个最直观的例子，docx 里的标题就是这样写的：

```xml
<w:p>
  <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>   <!-- 这段用 Heading1 样式 -->
  <w:r><w:t>第一章 引言</w:t></w:r>
</w:p>
```

`w:pStyle="Heading1"` 直接告诉解析器"这是一级标题"，不用看字号字重猜。

> [!info] 三种格式的 XML 内部结构详见 [[OOXML]]
> 包括：docx 的段落/表格/样式元素、xlsx 单元格 `<c>` 的 r/t/s 原生属性和共享字符串机制、pptx 的形状和母版三层继承——这些都是"为什么 OOXML 容易解析"的根本原因。

### 对比：PDF 没有原生语义

PDF 文件里只记录"在 (x=120, y=350) 位置画 24 号黑色加粗的字'第一章 引言'"——==没有任何"这是标题"的信息==。要还原结构得反向猜（看字号大小、是否独占一行、是否有编号前缀等）。

> [!tip] 这就是文档解析难度差异的根源
> docx/xlsx/pptx 容易解析，是因为 XML 原生语义已经把结构信息明明白白写出来了；PDF 难解析，是因为 PDF 是"打印格式"，所有结构信息都被丢弃了，只剩坐标。
>
> 详见 [[RAG基础与架构#3.2 格式光谱：结构化程度决定解析起点]]。

---

## 六、XML 命名空间（Namespace）

不同来源的 XML 可能用同名的标签表达不同含义。比如 `<title>` 在订单里是"职位"、在书目里是"书名"——合并到一份文档里就冲突了。

**解决方案：命名空间**，给标签加前缀，前缀绑定到一个 URI（仅作为唯一标识符，不需要真的能访问）。

```xml
<root xmlns:order="http://example.com/order"
      xmlns:book="http://example.com/book">
  <order:title>高级工程师</order:title>
  <book:title>三体</book:title>
</root>
```

docx 里见到的 `<w:p>`、`<w:pPr>` 中的 `w:` 就是 Word 命名空间的前缀，绑定的 URI 是 `http://schemas.openxmlformats.org/wordprocessingml/2006/main`。

---

## 七、DOM 树是什么

**DOM = Document Object Model（文档对象模型）**。XML/HTML 文件本身只是字符串，==解析器读入这串字符后，在内存里构建出一棵树形数据结构，这棵树就是 DOM 树==。

### DOM 树和 XML 树的关系

本质是同一种东西（标签的嵌套树），但术语侧重点不同：
- **XML 树**：通常指 XML 文件本身的逻辑结构（静态描述）
- **DOM 树**：强调"在程序里可以被代码操作"（动态对象 + 标准 API）

每个 DOM 节点 = 标签名 + 属性集合 + 子节点 + 文本内容。

> [!info] DOM 的完整内容详见 [[DOM]]
> 包括 DOM 的三层含义（数据结构 / API 标准 / 跨语言实现）、节点类型、节点关系 API、以及 DOM 不只是浏览器专属（Spring/Mybatis/Android/Java JAXP 都用 DOM）。

---

## 八、在哪里会遇到 XML

XML 在工程里到处都是，这里给一个索引（具体语法不在本文展开）：

| 场景 | 典型文件 |
|------|---------|
| Java 配置 | Spring `beans.xml`、Mybatis `Mapper.xml`、Maven `pom.xml`、Tomcat `web.xml` |
| 文档格式 | `.docx` / `.xlsx` / `.pptx` 内部（[[OOXML]]）、SVG 矢量图、XHTML |
| 数据交换协议 | SOAP（早期 Web 服务）、RSS（订阅）、XMPP（即时通讯） |
| LLM Prompt | Claude 推荐用 `<example>` / `<thinking>` 等结构化标签组织 prompt |

==XML 不是过时的技术，而是依然广泛存在于配置、文档、协议层的基础设施。== 现代 API 数据交换被 JSON 取代，但描述复杂结构和长期归档场景下，XML 依然是首选。

---

## 相关链接

- [[DOM]] — 操作 XML/HTML 文档的标准接口
- [[OOXML]] — Office 文档（docx/xlsx/pptx）内部的 XML 结构
- [[RAG基础与架构]] — XML 原生语义在文档解析中的关键作用
- [[计算机网络]] — DOM 树在浏览器渲染管线中的位置
- [[Spring 基础与 IoC]] — Spring XML 配置（应用层）
