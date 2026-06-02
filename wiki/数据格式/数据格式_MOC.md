---
module: 数据格式
tags: [数据格式, MOC, XML, OOXML, PDF, DOM]
difficulty: easy
last_reviewed: 2026-06-01
---

# 数据格式 MOC (Map of Content)

数据格式知识是文档解析和 RAG 管道的基础——理解 XML 标记语言、OOXML 的 ZIP+XML 结构、PDF 页面描述语言、DOM 操作接口，才能明白为什么 docx 能直接拿到标题层级、PDF 为什么是"低结构"而不是"无结构"。

---

## 🗺️ 知识体系导航

 XML
**基础标记语言概念**——理解 XML 是理解 docx/xlsx/pptx 内部结构、Spring/Mybatis 配置、SVG 图形的前置。
👉 **[[XML]]**

 DOM：文档对象模型
**操作 XML/HTML 文档的统一接口标准**——Spring 容器解析配置、Mybatis 解析 Mapper、浏览器渲染网页背后都在用 DOM。
👉 **[[DOM]]**

 OOXML：Office 文档的内部结构
**`.docx / .xlsx / .pptx` 三种文件的统一标准**——ZIP 包里装的一堆 XML，每个结构信息都用 XML 标签和属性显式标注。理解它就明白为什么 Word 解析能直接拿到标题层级。
👉 **[[OOXML]]**

 PDF：页面描述语言
**澄清 PDF 本质**——不是"图片塞在一起"，而是页面描述语言（绘制指令而非像素）。理解这一点才能明白为什么 PDF 在格式光谱里是"低结构"而不是"无结构"。
👉 **[[PDF]]**

---

## 相关链接

- [[文档解析_MOC]] — 文档解析依赖数据格式基础
- [[RAG基础与架构]] — RAG 管道需要处理多种数据格式
- [[Java基础索引_MOC]] — Java 解析 XML/DOM 的工具库
