---
module: 数据格式
tags: [数据格式, DOM, XML, HTML, W3C]
difficulty: easy
last_reviewed: 2026-05-20
---

# DOM：文档对象模型

> DOM 不只是浏览器的概念，而是==操作 XML/HTML 文档的统一接口标准==。Spring 容器解析配置、Mybatis 解析 Mapper、浏览器渲染网页、Android 解析布局，背后都在用 DOM。本文只讲核心概念。
>
> 前置知识：[[XML]]（标记语言基础）。

---

## 一、DOM 是什么

**DOM = Document Object Model（文档对象模型）**，由 **W3C** 在 1998 年发布的标准（DOM Level 1，最初为 XML 设计，后扩展到 HTML）。

==DOM 定义了"如何把树形文档加载到内存里，并提供一套标准接口去访问/修改它"。==

### 为什么需要 DOM

XML/HTML 文件本身是字符串——一长串字符，无法直接操作。如果你想"找到 id 为 `submit` 的按钮，把它的文本改成'提交'"，光有字符串是做不到的：

- 字符串里的 `<button id="submit">...</button>` 只是文本
- 没法直接说"找按钮"——这是树结构上的概念
- 改完一个标签，整个字符串要重排

==解决方案：解析器把字符串解析成树形数据结构，并提供操作 API。==这棵树 + API 就是 DOM。

---

## 二、DOM 的三层含义

很多资料把 DOM 讲糊涂，因为它同时是三个东西：

| 层 | 含义 | 例子 |
|---|------|------|
| **数据结构** | 文档在内存里的树形组织 | 节点 + 子节点 + 属性 + 文本 |
| **API 标准** | W3C 规定的一套访问/修改方法 | `getElementById`、`querySelector`、`appendChild` |
| **跨语言实现** | 各语言按这套标准提供库 | JS（浏览器）、Java（org.w3c.dom）、Python（xml.dom） |

==DOM 标准是接口规范==，所以你在 Java 里写的 `document.getElementById("submit")` 和 JS 里写的 `document.getElementById("submit")` 长得几乎一样——都遵循同一份 W3C 规范。

---

## 三、DOM 的节点类型

DOM 树由不同类型的节点组成。常见的：

| 节点类型 | 英文 | 例子 |
|---------|------|------|
| 文档节点 | Document | 整棵树的根（不是 `<html>`，是 `<html>` 之上的虚拟根） |
| 元素节点 | Element | `<div>`、`<p>`、`<button>` |
| 属性节点 | Attribute | `id="submit"`、`class="title"` |
| 文本节点 | Text | "标题文字"、"按钮文本" |
| 注释节点 | Comment | `<!-- 注释 -->` |
| 文档片段节点 | DocumentFragment | 临时容器，不在文档树中 |

==每个节点 = 节点类型 + 节点名 + 属性集合 + 子节点列表 + 文本内容==。

---

## 四、DOM 树结构示例

```html
<!-- HTML 源码 -->
<html>
  <body>
    <h1 class="title">标题</h1>
    <p>段落 <a href="#">链接</a></p>
  </body>
</html>
```

解析后的 DOM 树：

```
Document （文档节点，根）
└── html （元素节点）
    └── body （元素节点）
        ├── h1 （元素节点）
        │   ├── 属性节点: class="title"
        │   └── #text "标题"
        └── p （元素节点）
            ├── #text "段落 "
            └── a （元素节点）
                ├── 属性节点: href="#"
                └── #text "链接"
```

### 节点之间的关系

每个节点都通过 DOM API 暴露这些"亲戚关系"：

| 关系 | API（JavaScript） |
|------|------------------|
| 父节点 | `node.parentNode` |
| 子节点列表 | `node.childNodes` |
| 第一个/最后一个子节点 | `node.firstChild` / `node.lastChild` |
| 前一个/后一个兄弟节点 | `node.previousSibling` / `node.nextSibling` |

这些是 W3C DOM Core 标准定义的，==所有遵循 DOM 标准的实现都有这些接口==。

---

## 五、DOM 不只是浏览器专属

这是关于 DOM 最常见的误解。DOM 最早就是为 **XML** 设计的（1998 年），后来才扩展到 HTML。

==任何需要"把树形文档加载到内存方便代码操作"的场景都用 DOM==：

| 场景 | 用 DOM 做什么 |
|------|-------------|
| 浏览器 | JS 操作页面：`document.querySelector('h1').textContent = '新标题'` |
| Spring 容器 | 解析 `beans.xml` 构建 IoC 容器 |
| Mybatis | 解析 Mapper XML，提取 `<select>`/`<insert>` 等 SQL 节点 |
| Android | 解析布局 XML（layout.xml）构建 View 树 |
| Java JAXP | `DocumentBuilder` + `Document` 标准 API 解析任意 XML |
| Python xml.dom | 标准库提供的 DOM 实现，解析 XML/HTML |
| 文档解析器 | python-docx / openpyxl 内部解析 OOXML 时也用 DOM |

==同一份 DOM 标准，跨平台跨语言通用。==

> [!tip] 浏览器 DOM 的特殊性
> 浏览器的 DOM 在标准 DOM Core 之上扩展了大量与显示相关的接口（如 `style`、`offsetTop`、`getBoundingClientRect`）以及事件系统（`addEventListener`）。这些不是核心 DOM 的一部分，是浏览器扩展。
>
> 所以浏览器 DOM ⊃ DOM 核心。你在 Java 里用的 `org.w3c.dom` 只覆盖核心部分，没有 `style.color` 这种东西。

---

## 相关链接

- [[XML]] — XML 标记语言基础（DOM 最早就是为操作 XML 而设计）
- [[OOXML]] — Office 文档内部 XML 通过 DOM 解析
- [[计算机网络]] — DOM 树在浏览器渲染管线中的位置
