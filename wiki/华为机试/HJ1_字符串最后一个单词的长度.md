# HJ1 字符串最后一个单词的长度

## 一、答案

```python
import sys


words = sys.stdin.readline().split()
last_word = words[-1]

print(len(last_word))
```

## 二、解题思路

题目会输入一行句子，例如：

```text
hello nowcoder
```

我们需要完成三步：

1. 读取这一整行句子；
2. 按照空格把句子拆成多个单词；
3. 找到最后一个单词，输出它的长度。

执行：

```python
words = sys.stdin.readline().split()
```

以后，句子会被拆成一个列表：

```python
["hello", "nowcoder"]
```

Python 列表中的 `-1` 表示最后一个元素，所以：

```python
last_word = words[-1]
```

得到：

```python
"nowcoder"
```

最后使用 `len()` 计算字符串长度：

```python
len("nowcoder")
```

结果是：

```text
8
```

## 三、代码逐行解释

### 1. 导入 `sys`

```python
import sys
```

导入 `sys`，用于读取 ACM 模式的标准输入。

### 2. 读取并拆分句子

```python
words = sys.stdin.readline().split()
```

这行代码分为两部分。

先执行：

```python
sys.stdin.readline()
```

它会读取一整行输入。

然后执行：

```python
.split()
```

它会按照空格把句子拆成多个单词。

例如输入：

```text
I am a student
```

拆分后：

```python
words = ["I", "am", "a", "student"]
```

### 3. 取得最后一个单词

```python
last_word = words[-1]
```

Python 列表下标的含义是：

```text
words[0]  表示第一个元素
words[1]  表示第二个元素
words[-1] 表示最后一个元素
```

因此：

```python
["I", "am", "a", "student"][-1]
```

得到：

```python
"student"
```

### 4. 输出单词长度

```python
print(len(last_word))
```

`len()` 用来计算字符串中有多少个字符，`print()` 用来输出答案。

例如：

```python
len("student")
```

结果是 `7`，所以程序输出：

```text
7
```

## 四、示例

### 示例 1

输入：

```text
HelloNowcoder
```

这一行只有一个单词，所以它既是第一个单词，也是最后一个单词。

```python
words = ["HelloNowcoder"]
last_word = "HelloNowcoder"
```

输出：

```text
13
```

### 示例 2

输入：

```text
I am a student
```

拆分后：

```python
["I", "am", "a", "student"]
```

最后一个单词是 `student`，长度为 `7`。

输出：

```text
7
```

## 五、复杂度

设输入句子的总长度为 `n`：

- 时间复杂度：`O(n)`，需要读取并拆分整行字符串；
- 空间复杂度：`O(n)`，需要保存拆分后的单词列表。

## 六、记忆方式

```text
readline() 读取一行；
split() 按空格拆成单词；
words[-1] 取最后一个单词；
len() 计算单词长度。
```
