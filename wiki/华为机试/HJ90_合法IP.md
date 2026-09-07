# HJ90 合法 IP

## 题目意思

IPv4 地址必须由 4 段数字组成，格式如下：

```text
数字.数字.数字.数字
```

每一段都必须是 `0` 到 `255` 之间的整数。

例如：

```text
10.137.17.1       合法
255.255.255.255   合法
255.255.255.1000  不合法，因为最后一段超过 255
1.2.3             不合法，因为只有 3 段
1..3.4            不合法，因为中间有空段
```

## Python 答案

```python
import sys

ip = sys.stdin.readline().strip()
parts = ip.split('.')

valid = True

# IPv4 必须正好有 4 段
if len(parts) != 4:
    valid = False
else:
    for part in parts:
        # 不能为空，并且必须全部由数字组成
        if part == '' or not part.isdigit():
            valid = False
            break

        # 多位数字不能以 0 开头，例如 01 不符合规范
        # 单独的 0 是合法的
        if len(part) > 1 and part[0] == '0':
            valid = False
            break

        number = int(part)

        # 每段的范围必须是 0 到 255
        if number < 0 or number > 255:
            valid = False
            break

if valid:
    print('YES')
else:
    print('NO')
```

## 代码解释

### `split('.')`

```python
parts = ip.split('.')
```

按照点号切分字符串：

```text
"10.137.17.1".split('.')
```

得到：

```python
['10', '137', '17', '1']
```

所以先判断 `len(parts) == 4`。

### `part == ''`

如果输入是：

```text
1..3.4
```

切分结果是：

```python
['1', '', '3', '4']
```

第二段是空字符串，因此不合法。

### `part.isdigit()`

判断这一段是否全部由数字组成：

```python
'123'.isdigit()   # True
'12a'.isdigit()   # False
'-1'.isdigit()    # False
```

这样可以排除字母、负号和其它符号。

### `int(part)` 和范围判断

字符串切分后得到的是字符串，例如 `'137'`。使用：

```python
number = int(part)
```

可以把它转换成整数，然后检查：

```python
0 <= number <= 255
```

代码中的写法：

```python
if number < 0 or number > 255:
```

效果相同。

### 为什么 `01` 不合法

虽然 Python 可以把 `'01'` 转换成整数 `1`，但 IP 地址的每一段应使用规范写法：

```text
0      合法
1      合法
01     不合法
001    不合法
```

因此需要在转换前额外判断：

```python
if len(part) > 1 and part[0] == '0':
```


## 复杂度

IP 地址最多只有 4 段，因此时间和空间都可以看作 `O(1)`。
