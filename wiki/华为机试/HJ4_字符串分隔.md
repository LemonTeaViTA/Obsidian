# HJ4 字符串分隔

## 一、答案

```python
import sys


s = sys.stdin.readline().strip()

zero_count = (-len(s)) % 8
s += "0" * zero_count

for i in range(0, len(s), 8):
    print(s[i:i + 8])
```

## 二、解题思路

题目要求：

1. 每 `8` 个字符输出一行；
2. 如果最后剩余字符不足 `8` 个，就在末尾补 `0`；
3. 补到字符串总长度是 `8` 的倍数。

可以分成两步解决：

```text
第一步：计算需要补多少个 0，并补在字符串末尾；
第二步：每次取 8 个字符并输出。
```

例如：

```text
hellonowcoder
```

长度是 `13`，距离下一个 `8` 的倍数 `16` 还差 `3`，所以补三个 `0`：

```text
hellonowcoder000
```

然后每 `8` 个字符切一段：

```text
hellonow
coder000
```

## 三、代码逐行解释

### 1. 读取字符串

```python
s = sys.stdin.readline().strip()
```

`sys.stdin.readline()` 读取一整行输入，`strip()` 删除行末的换行符。

题目保证字符串只由小写字母和数字组成，不包含空格，所以这里可以直接使用 `strip()`。

### 2. 计算需要补多少个 `0`

```python
zero_count = (-len(s)) % 8
```

`zero_count` 表示还需要补多少个字符，才能让字符串长度成为 `8` 的倍数。

例如字符串长度为 `13`：

```python
zero_count = (-13) % 8
           = 3
```

因为：

```text
13 + 3 = 16
```

`16` 是 `8` 的倍数。

如果字符串长度已经是 `8`，那么：

```python
zero_count = (-8) % 8
           = 0
```

此时不需要补 `0`。

常见长度对应的补零数量如下：

| 原长度 | 需要补几个 `0` | 补齐后长度 |
| ---: | ---: | ---: |
| 1 | 7 | 8 |
| 7 | 1 | 8 |
| 8 | 0 | 8 |
| 9 | 7 | 16 |
| 13 | 3 | 16 |
| 16 | 0 | 16 |

### 3. 在字符串末尾补 `0`

```python
s += "0" * zero_count
```

Python 中，字符串乘以一个整数表示重复多次：

```python
"0" * 3
```

得到：

```python
"000"
```

`+=` 表示追加到原字符串末尾。

例如：

```python
s = "coder"
zero_count = 3
s += "0" * zero_count
```

结果是：

```python
"coder000"
```

### 4. 每次移动 8 个位置

```python
for i in range(0, len(s), 8):
```

`range(开始位置, 结束位置, 步长)`。

这里：

```text
开始位置是 0；
结束位置是字符串长度；
每次增加 8。
```

如果补齐后的字符串长度是 `16`，那么 `i` 会依次等于：

```text
0、8
```

### 5. 使用切片取出 8 个字符

```python
print(s[i:i + 8])
```

`s[i:i + 8]` 表示从下标 `i` 开始，取到下标 `i + 8` 之前。

也就是一共取 `8` 个字符。

例如：

```python
s = "hellonowcoder000"
```

第一次循环：

```python
i = 0
s[0:8] = "hellonow"
```

第二次循环：

```python
i = 8
s[8:16] = "coder000"
```

每次 `print()` 输出一行，所以结果是：

```text
hellonow
coder000
```

## 四、示例执行过程

输入：

```text
hellonowcoder
```

第一步，计算长度：

```python
len(s) = 13
```

第二步，计算补零数量：

```python
zero_count = (-13) % 8
           = 3
```

第三步，补三个 `0`：

```text
hellonowcoder000
```

第四步，按照每段 8 个字符切分：

```text
hellonow
coder000
```

最终输出：

```text
hellonow
coder000
```

## 五、边界情况

### 字符串正好有 8 个字符

输入：

```text
abcdefgh
```

长度已经是 `8` 的倍数，不需要补 `0`：

```text
abcdefgh
```

### 字符串只有一个字符

输入：

```text
a
```

需要补 `7` 个 `0`：

```text
a0000000
```

### 字符串有 16 个字符

输入：

```text
abcdefghijklmnop
```

不需要补 `0`，直接分成两行：

```text
abcdefgh
ijklmnop
```

## 六、另一种更直观的补零写法

如果暂时不熟悉 `(-len(s)) % 8`，也可以这样写：

```python
import sys


s = sys.stdin.readline().strip()

remainder = len(s) % 8

if remainder != 0:
    zero_count = 8 - remainder
    s += "0" * zero_count

for i in range(0, len(s), 8):
    print(s[i:i + 8])
```

含义是：

```text
先看长度除以 8 余多少；
如果余数不是 0，就补 8 - 余数 个 0。
```

这个版本代码稍长，但对初学者更直观。

## 七、复杂度

设原字符串长度为 `n`：

- 时间复杂度：`O(n)`，需要输出整个字符串；
- 空间复杂度：`O(n)`，需要保存补齐后的字符串。

## 八、记忆方式

```text
先补 0，让长度变成 8 的倍数；
range(0, len(s), 8) 每次移动 8 位；
s[i:i + 8] 每次切出 8 个字符。
```
