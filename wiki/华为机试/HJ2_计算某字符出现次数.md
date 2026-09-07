# HJ2 计算某字符出现次数

## 一、答案

```python
import sys


s = sys.stdin.readline().rstrip("\n")
c = sys.stdin.readline().strip()

answer = s.lower().count(c.lower())
print(answer)
```

## 二、解题思路

题目要求统计字符 `c` 在字符串 `s` 中出现了多少次。

如果 `c` 是字母，需要忽略大小写。例如目标字符是 `o`，那么字符串中的 `o` 和 `O` 都要统计。

最简单的处理方法是：

1. 把字符串 `s` 全部转换为小写；
2. 把目标字符 `c` 也转换为小写；
3. 使用 `count()` 统计目标字符出现的次数。

例如：

```python
s = "HELLONowcoder123"
c = "o"
```

转换为小写以后：

```python
s.lower()  # "hellonowcoder123"
c.lower()  # "o"
```

字符串中共有三个 `o`，所以答案是：

```text
3
```

如果目标字符是数字，例如 `1`：

```python
"1".lower()
```

结果仍然是 `"1"`，不会改变。因此字母和数字可以使用相同的代码处理，不需要单独判断。

## 三、代码逐行解释

### 1. 读取字符串

```python
s = sys.stdin.readline().rstrip("\n")
```

`sys.stdin.readline()` 读取第一行字符串。

读取一行时，末尾通常会带一个换行符 `\n`，所以使用：

```python
.rstrip("\n")
```

只删除末尾的换行符。

这里不能使用 `split()`，因为题目的原字符串中允许包含空格。我们需要保留整行字符串，而不是把它拆成多个单词。

### 2. 读取目标字符

```python
c = sys.stdin.readline().strip()
```

读取第二行的目标字符，并使用 `strip()` 删除它两边可能存在的换行符。

题目保证 `c` 是字母或数字，不会是空格，所以这里可以安全地使用 `strip()`。

### 3. 统一转换成小写

```python
s.lower()
c.lower()
```

`lower()` 会把大写字母转换为小写：

```python
"A".lower()  # "a"
"O".lower()  # "o"
```

原本就是小写的字母和数字不会改变：

```python
"o".lower()  # "o"
"1".lower()  # "1"
```

这样就实现了字母不区分大小写。

### 4. 统计出现次数

```python
answer = s.lower().count(c.lower())
```

字符串的 `count()` 方法可以统计一个字符出现了多少次。

例如：

```python
"hellonowcoder123".count("o")
```

结果是：

```text
3
```

最后输出答案：

```python
print(answer)
```

## 四、示例

### 示例 1

输入：

```text
HELLONowcoder123
o
```

忽略大小写后，原字符串是：

```text
hellonowcoder123
```

其中 `o` 出现了 `3` 次，所以输出：

```text
3
```

### 示例 2

输入：

```text
H E L L O Nowcoder123
1
```

数字 `1` 出现了 `1` 次，所以输出：

```text
1
```

## 五、也可以使用循环统计

如果暂时不熟悉 `count()`，也可以手动遍历字符串：

```python
import sys


s = sys.stdin.readline().rstrip("\n").lower()
c = sys.stdin.readline().strip().lower()

answer = 0

for ch in s:
    if ch == c:
        answer += 1

print(answer)
```

这个版本的过程是：

```text
依次查看字符串中的每个字符；
如果它和目标字符相同，答案加 1。
```

两个版本的结果相同，使用 `count()` 的版本更简洁。

## 六、复杂度

设字符串 `s` 的长度为 `n`：

- 时间复杂度：`O(n)`，需要检查字符串中的字符；
- 空间复杂度：`O(n)`，`lower()` 会生成转换后的小写字符串。

## 七、记忆方式

```text
第一行读取原字符串；
第二行读取目标字符；
lower() 忽略字母大小写；
count() 统计出现次数。
```
