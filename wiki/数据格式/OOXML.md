---
module: 数据格式
tags: [数据格式, OOXML, docx, xlsx, pptx, Office]
difficulty: medium
last_reviewed: 2026-05-20
---

# OOXML：Office 文档的内部结构

> Office Open XML（OOXML）是 .docx / .xlsx / .pptx 三种文件的统一标准。理解它就明白：Word 解析为什么能直接拿到标题层级、Excel 解析为什么能直接读出单元格类型、PPT 解析为什么能拿到形状坐标——==它们的内部都是 ZIP 包里装的一堆 XML，每个结构信息都用 XML 标签和属性显式标注==。
>
> 前置知识：[[XML]]（标记语言基础）。

---

## 一、什么是 OOXML

**OOXML = Office Open XML（开放式 Office XML）**，由微软主导制定的开放文档标准。

### 标准化历程

- **2006**：ECMA International 发布 **ECMA-376**，把 Office 2007 引入的新文档格式标准化
- **2008**：通过 ISO/IEC 投票成为 **ISO/IEC 29500** 国际标准
- 微软 Office、WPS、LibreOffice、Google Docs 等都支持读写 OOXML

### 与老二进制格式的对比

| 维度 | 老格式（.doc/.xls/.ppt） | OOXML（.docx/.xlsx/.pptx） |
|------|------------------------|--------------------------|
| 容器 | 微软专有的 OLE 复合文件（CFB） | 标准 ZIP 包 |
| 内容 | 私有二进制结构 | 一堆 XML 文件 |
| 开放性 | 私有规范，逆向工程困难 | 开放标准，任何工具可读 |
| 体积 | 较大 | ZIP 压缩，体积小 |
| 可读性 | 不可直接看 | 解压后可用文本编辑器查看 |

==老格式必须依赖微软的解析器，OOXML 任何能读 ZIP + 解析 XML 的工具都能处理==——这是 Office 文档可以被 python-docx / openpyxl 等开源库轻松解析的根本原因。

### 三个扩展名都是 OOXML

| 扩展名 | 应用 | 主体目录 |
|--------|------|---------|
| .docx | Word | `word/` |
| .xlsx | Excel | `xl/` |
| .pptx | PowerPoint | `ppt/` |

它们共享一套容器规范，主体内容目录不同。

---

## 二、共同的容器结构

### ZIP 是 OOXML 的容器

把 `xxx.docx` 改名为 `xxx.zip` 就能直接解压——OOXML 文件本质就是 ZIP 包。

### 共有的目录骨架

不管是 docx、xlsx 还是 pptx，解压后都能看到这两个公共部分：

```
├── [Content_Types].xml      ← MIME 类型清单
├── _rels/
│   └── .rels                ← 顶层关系文件，指向主文档
└── word/ 或 xl/ 或 ppt/      ← 主体目录，结构因类型而异
```

### `[Content_Types].xml`

声明每种内部文件对应的 MIME 类型。读取器先看这个清单决定如何解析每个文件。

```xml
<Types>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/word/document.xml"
            ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
```

### `_rels/` 目录与关系文件（.rels）

OOXML 的关键设计：==XML 之间不直接通过路径引用，而是通过关系 ID 引用==。每个有引用关系的 XML 都有一个对应的 `.rels` 文件描述它引用了什么。

例子：`word/_rels/document.xml.rels` 描述 `word/document.xml` 引用了哪些资源：

```xml
<Relationships>
  <Relationship Id="rId1" Type="...image"
                Target="media/image1.png"/>
  <Relationship Id="rId2" Type="...styles"
                Target="styles.xml"/>
</Relationships>
```

`document.xml` 里需要插图的位置写 `r:embed="rId1"`，解析器通过 rId1 → media/image1.png 找到实际文件。

==这种间接寻址叫 "Open Packaging Conventions"（OPC）==——把"哪些文件"和"它们之间的关系"分开管理，便于增删改和复用。

---

## 三、docx 内部结构

### 主体目录

```
word/
├── document.xml             ← 正文内容（核心）
├── styles.xml               ← 样式定义
├── numbering.xml            ← 编号定义（列表）
├── settings.xml             ← 文档全局设置
├── theme/theme1.xml         ← 主题
├── media/                   ← 嵌入的图片
└── _rels/
    └── document.xml.rels    ← document.xml 的关系
```

### document.xml 关键元素

```xml
<w:document>
  <w:body>
    <w:p>                                            <!-- 段落 -->
      <w:pPr>                                        <!-- 段落属性 -->
        <w:pStyle w:val="Heading1"/>                 <!-- 应用 Heading1 样式 -->
      </w:pPr>
      <w:r>                                          <!-- 文本运行区 -->
        <w:t>第一章 引言</w:t>                       <!-- 实际文本 -->
      </w:r>
    </w:p>
    <w:tbl>                                          <!-- 表格 -->
      <w:tr>                                         <!-- 行 -->
        <w:tc>                                       <!-- 单元格 -->
          <w:p><w:r><w:t>姓名</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>
```

| 元素 | 含义 |
|------|------|
| `<w:p>` | 段落（paragraph） |
| `<w:pPr>` | 段落属性（含样式引用） |
| `<w:r>` | 运行区（run），同一段内字体相同的连续文本 |
| `<w:t>` | 实际文本（text） |
| `<w:tbl>` / `<w:tr>` / `<w:tc>` | 表格 / 行 / 单元格 |
| `<w:numPr>` | 列表编号属性 |
| `<w:drawing>` | 图片占位 |

`w:` 前缀是 WordprocessingML 命名空间。

==docx 的"原生语义"体现在 `<w:pStyle w:val="Heading1"/>` 这种==——直接告诉解析器"这是一级标题"，不用看字号字体猜。

---

## 四、xlsx 内部结构

==这是回答"Excel 没有像 Word 一样的标签和语义，怎么做到单元格属性原生可读"的关键章节。==

### 4.1 目录结构

```
xl/
├── workbook.xml                ← 工作簿（Sheet 列表、命名区域）
├── _rels/workbook.xml.rels     ← 工作簿引用关系
├── sharedStrings.xml           ← 共享字符串表
├── styles.xml                  ← 样式表（字体/数字格式/对齐/边框）
├── worksheets/
│   ├── sheet1.xml              ← 第一个工作表数据
│   ├── sheet2.xml              ← 第二个工作表数据
│   └── _rels/                  ← 工作表的关系（如有图片图表）
└── theme/theme1.xml
```

### 4.2 单元格 `<c>` 元素：单元格其实自带一堆属性

Excel 表格在 sheet1.xml 里大概长这样：

```xml
<worksheet>
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>           <!-- A1 = 共享字符串表第 0 项 -->
      <c r="B1" t="s"><v>1</v></c>           <!-- B1 = 共享字符串表第 1 项 -->
    </row>
    <row r="2">
      <c r="A2"><v>100</v></c>               <!-- A2 = 数字 100 -->
      <c r="B2" s="3"><v>0.85</v></c>        <!-- B2 = 0.85，应用样式索引 3（百分比格式） -->
      <c r="C2" t="b"><v>1</v></c>           <!-- C2 = 布尔 TRUE -->
      <c r="D2" t="str"><v>临时文本</v></c>  <!-- D2 = 内联字符串 -->
      <c r="E2"><f>SUM(A2:D2)</f><v>101.85</v></c>  <!-- E2 = 公式 + 缓存值 -->
    </row>
  </sheetData>
</worksheet>
```

==每个 `<c>` 元素自带的原生属性==：

| 属性/子元素 | 含义 | 取值示例 |
|-----------|------|---------|
| `r` | reference，单元格地址 | `A1`、`B5`、`AA100` |
| `t` | type，单元格类型 | `n`（数字，省略时默认）、`s`（共享字符串）、`b`（布尔）、`d`（日期）、`str`（内联字符串）、`e`（错误值） |
| `s` | style，样式索引 | 整数，指向 styles.xml 的 `cellXfs` 数组 |
| `<v>` | value，值 | 数字直接存；字符串存索引；布尔存 0/1 |
| `<f>` | formula，公式 | 如 `SUM(A2:D2)`；同时 `<v>` 缓存计算结果 |

> [!tip] 这就是"网格化的单元格 + 单元格属性原生可读"的真相
> 单元格不是孤立的格子，==每个 `<c>` 元素都用 XML 属性显式标注地址、类型、样式索引、值==。
>
> 比 Word 的语义标签更"硬"——Word 的 `<w:pStyle>` 是"作者打算把这段当标题"的语义；xlsx 的 `t="n"`、`s="3"` 是==确凿的结构化数据==，类型就是类型，没有歧义。
>
> 所以 openpyxl 这种解析器可以直接 `ws['A2'].value` 拿到 100（int 类型），完全不需要从视觉上猜。

### 4.3 共享字符串表（sharedStrings.xml）

字符串通常重复（如表头"姓名"在多个 Sheet 出现多次）。Excel 把所有不重复字符串集中存到 `sharedStrings.xml`，单元格只存索引：

```xml
<!-- sharedStrings.xml -->
<sst count="3" uniqueCount="3">
  <si><t>姓名</t></si>     <!-- 索引 0 -->
  <si><t>年龄</t></si>     <!-- 索引 1 -->
  <si><t>张三</t></si>     <!-- 索引 2 -->
</sst>
```

`<c r="A1" t="s"><v>0</v></c>` 表示 A1 = 共享字符串表第 0 项 = "姓名"。

==大表格的体积优化全靠这个机制==——10000 行表格里"姓名"这个表头只存一次。

### 4.4 合并单元格（mergeCells）

```xml
<worksheet>
  <sheetData>...</sheetData>
  <mergeCells count="2">
    <mergeCell ref="A1:C1"/>     <!-- A1 横跨 A1-C1 -->
    <mergeCell ref="D1:D3"/>     <!-- D1 纵跨 D1-D3 -->
  </mergeCells>
</worksheet>
```

==合并区域只在左上角单元格存值，其余单元格不存==——这就是为什么解析时合并区域只有左上角有值。`<mergeCells>` 元素列出所有合并区域，解析器照此==展开填充==到所有被合并的单元格。

> 文档解析中"合并单元格展开"的处理逻辑就是基于这个机制，详见 [[RAG基础与架构#3.3.1 表格结构识别（TSR）]]。

### 4.5 样式表（styles.xml）

`styles.xml` 集中存所有字体、数字格式、对齐方式、边框、填充。单元格通过 `s="3"` 引用第 3 个样式。

```xml
<!-- styles.xml 简化片段 -->
<styleSheet>
  <numFmts>
    <numFmt numFmtId="164" formatCode="0.00%"/>   <!-- 自定义百分比格式 -->
  </numFmts>
  <cellXfs count="4">
    <xf numFmtId="0"/>                            <!-- 索引 0：默认 -->
    <xf numFmtId="14"/>                           <!-- 索引 1：日期 -->
    <xf numFmtId="3"/>                            <!-- 索引 2：千分位数字 -->
    <xf numFmtId="164"/>                          <!-- 索引 3：自定义百分比 -->
  </cellXfs>
</styleSheet>
```

这套==间接寻址是 OOXML 体积控制的核心==——常用样式只存一次，单元格只引用索引。

### 4.6 多 Sheet 与命名区域（workbook.xml）

```xml
<workbook>
  <sheets>
    <sheet name="销售数据" sheetId="1" r:id="rId1"/>
    <sheet name="汇总"     sheetId="2" r:id="rId2"/>
  </sheets>
  <definedNames>
    <definedName name="价格表">销售数据!$A$1:$D$100</definedName>
  </definedNames>
</workbook>
```

每个 Sheet 是独立的 XML 文件（worksheets/sheet1.xml、sheet2.xml），`r:id="rId1"` 通过 `_rels/workbook.xml.rels` 映射到具体文件。命名区域可以让公式用 `=SUM(价格表)` 而不是冰冷的 `=SUM(销售数据!$A$1:$D$100)`。

---

## 五、pptx 内部结构

### 主体目录

```
ppt/
├── presentation.xml            ← 演示文稿主文件（幻灯片列表、母版引用）
├── slides/
│   ├── slide1.xml              ← 第一张幻灯片
│   ├── slide2.xml              ← 第二张幻灯片
│   └── _rels/                  ← 各张幻灯片的关系文件
├── slideLayouts/               ← 布局
├── slideMasters/               ← 母版
├── notesSlides/                ← 备注页
├── theme/
└── media/                      ← 图片、视频
```

### slide.xml 关键元素

```xml
<p:sld>
  <p:cSld>
    <p:spTree>
      <p:sp>                                          <!-- 形状 -->
        <p:nvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="100" y="200"/><a:ext cx="500" cy="300"/></a:xfrm></p:spPr>
        <p:txBody>                                    <!-- 形状内的文本 -->
          <a:p><a:r><a:t>标题文本</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:graphicFrame>                                <!-- 表格、图表 -->
        ...
      </p:graphicFrame>
      <p:pic>                                         <!-- 图片 -->
        ...
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>
```

| 元素 | 含义 |
|------|------|
| `<p:sp>` | 形状（Shape，含文本框、按钮等） |
| `<p:txBody>` | 形状内的文本 |
| `<p:graphicFrame>` | 表格、图表 |
| `<p:pic>` | 图片 |
| `<a:xfrm>` | 位置和大小（offset + extent） |

### 三层继承

==幻灯片样式是三层继承结构==：母版（slideMasters）→ 布局（slideLayouts）→ 幻灯片（slides）。一张幻灯片继承自某个布局，布局继承自某个母版。这就是"修改母版能影响所有页"的原理。

备注页放在 `notesSlides/` 目录，与正文分离——这是 [[RAG基础与架构#3.4.4 PPT（pptx）：信息分散与隐藏]] 中"备注页分离"问题的内部原因。

---

## 六、解析 OOXML 的实践

主流解析库的本质：

| 库 | 处理流程 | 提供的 API 形态 |
|----|---------|---------------|
| **python-docx** | 解 ZIP → 解析 `word/document.xml` 为 DOM 树 | `doc.paragraphs`、`paragraph.style.name` |
| **openpyxl** | 解 ZIP → 解析 sheetN.xml + sharedStrings.xml + styles.xml | `ws['A1'].value`、`ws['A1'].number_format` |
| **python-pptx** | 解 ZIP → 解析 slideN.xml | `slide.shapes`、`shape.text_frame.text` |
| **MarkItDown**（微软） | 三种格式统一转 Markdown | 一行 API：`MarkItDown().convert(path)` |
| **Docling**（IBM） | 完整结构化解析 → DoclingDocument 模型 | 统一文档对象，保留层级和元素类型 |

==它们都不是"魔法"==，本质都是：**解 ZIP + 解析里面的 XML + 包装成易用 API**。理解了 OOXML 的内部结构，再看这些库的源码就特别清晰。

---

## 相关链接

- [[XML]] — XML 标记语言基础（OOXML 的载体）
- [[RAG基础与架构]] — OOXML 在文档解析中的位置（参见 3.4.2 / 3.4.3 / 3.4.4）
