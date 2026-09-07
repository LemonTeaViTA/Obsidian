# HJ8 合并表记录

## 一、答案

```python
import sys


n = int(sys.stdin.readline())
records = {}

for _ in range(n):
    index, value = map(int, sys.stdin.readline().split())
    records[index] = records.get(index, 0) + value

for index in sorted(records):
    print(index, records[index])
```

## 二、解题思路

每条记录包含两个数字：

```text
索引 数值
```

题目要求：

1. 相同索引的数值相加；
2. 按照索引从小到大输出。

这类“通过一个值找到另一个值”的问题适合使用字典。

可以让：

```text
字典的键 key：记录索引
字典的值 value：这个索引对应的数值总和
```

例如输入：

```text
0 1
0 2
1 2
3 4
```

处理过程：

```python
records = {}

# 读到 0 1
records = {0: 1}

# 读到 0 2，相同索引继续相加
records = {0: 3}

# 读到 1 2
records = {0: 3, 1: 2}

# 读到 3 4
records = {0: 3, 1: 2, 3: 4}
```

最后将索引排序，依次输出：

```text
0 3
1 2
3 4
```

## 三、代码逐行解释

### 1. 读取记录数量

```python
n = int(sys.stdin.readline())
```

第一行表示后面有多少条记录。

例如：

```text
4
```

表示接下来还有 `4` 行记录。

### 2. 创建空字典

```python
records = {}
```

`{}` 表示一个空字典。

字典保存的是“键和值”的对应关系，例如：

```python
records = {
    0: 3,
    1: 2,
    3: 4
}
```

这里的意思是：

```text
索引 0 对应的数值总和是 3；
索引 1 对应的数值总和是 2；
索引 3 对应的数值总和是 4。
```

### 3. 循环读取每条记录

```python
for _ in range(n):
    index, value = map(int, sys.stdin.readline().split())
```

如果一行输入是：

```text
0 2
```

`split()` 按空格拆开：

```python
["0", "2"]
```

`map(int, ...)` 把两个字符串转换为整数：

```python
index = 0
value = 2
```

### 4. 合并相同索引

```python
records[index] = records.get(index, 0) + value
```

这是本题最关键的一行。

```python
records.get(index, 0)
```

意思是：

```text
如果字典中已经有这个索引，就取出它原来的数值；
如果还没有这个索引，就使用默认值 0。
```

#### 索引第一次出现

假设字典是空的：

```python
records = {}
```

现在读到：

```text
0 1
```

执行：

```python
records.get(0, 0)
```

字典中还没有索引 `0`，所以得到默认值 `0`。

于是：

```python
records[0] = 0 + 1
```

结果是：

```python
records = {0: 1}
```

#### 索引再次出现

现在字典是：

```python
records = {0: 1}
```

又读到：

```text
0 2
```

执行：

```python
records.get(0, 0)
```

因为索引 `0` 已经存在，所以得到原来的值 `1`。

于是：

```python
records[0] = 1 + 2
```

结果是：

```python
records = {0: 3}
```

### 5. 对索引排序

```python
for index in sorted(records):
```

直接遍历字典时，不应该依赖它恰好符合题目要求的顺序，因此需要显式排序。

```python
sorted(records)
```

排序的是字典中的键，也就是记录索引。

例如：

```python
records = {3: 4, 0: 3, 1: 2}
```

排序后：

```python
[0, 1, 3]
```

### 6. 输出索引和合并后的数值

```python
print(index, records[index])
```

`index` 是当前索引，`records[index]` 是这个索引对应的数值总和。

`print()` 接收多个值时，会默认使用一个空格分隔。

例如：

```python
print(0, 3)
```

输出：

```text
0 3
```

## 四、示例完整执行过程

输入：

```text
4
0 1
0 2
1 2
3 4
```

第一条记录：

```text
索引 0，数值 1
records = {0: 1}
```

第二条记录：

```text
索引 0，数值 2
0 已经存在，所以 1 + 2 = 3
records = {0: 3}
```

第三条记录：

```text
索引 1，数值 2
records = {0: 3, 1: 2}
```

第四条记录：

```text
索引 3，数值 4
records = {0: 3, 1: 2, 3: 4}
```

索引排序后是：

```python
[0, 1, 3]
```

完整输出：

```text
0 3
1 2
3 4
```

注意：题目示例在你复制的内容中只显示了 `0 3`，应该是后两行没有复制完整。按照题意，索引 `1` 和索引 `3` 的记录也必须输出。

## 五、不使用 `get()` 的写法

如果暂时不熟悉字典的 `get()`，可以使用 `if` 判断：

```python
import sys


n = int(sys.stdin.readline())
records = {}

for _ in range(n):
    index, value = map(int, sys.stdin.readline().split())

    if index in records:
        records[index] += value
    else:
        records[index] = value

for index in sorted(records):
    print(index, records[index])
```

两种写法的意思完全相同：

```text
索引已经存在：在原数值上继续相加；
索引第一次出现：直接保存当前数值。
```

`get()` 版本更简洁，`if` 版本更直观。

## 六、复杂度

设输入记录数为 `n`，合并后有 `k` 个不同索引：

- 读取和合并平均需要 `O(n)` 时间；
- 对索引排序需要 `O(k log k)` 时间；
- 空间复杂度为 `O(k)`。

因为 `k <= n`，也可以简单记作：

```text
时间复杂度：O(n log n)
空间复杂度：O(n)
```

## 七、记忆方式

```text
字典的键保存索引；
字典的值保存数值总和；
get(index, 0) 取旧值，没有就按 0；
sorted(records) 将索引从小到大排序。
```
