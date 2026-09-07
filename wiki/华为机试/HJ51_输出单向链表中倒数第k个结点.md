# HJ51 输出单向链表中倒数第 k 个结点

## 题目意思

链表中的结点顺序是：

```text
1 -> 2 -> 3 -> 4 -> 5
```

从后往前数：

```text
倒数第 1 个：5
倒数第 2 个：4
倒数第 3 个：3
```

所以，如果链表长度是 `n`，要找倒数第 `k` 个结点，它在从前往后数的位置是：

```text
n - k
```

这里是 Python 下标，从 `0` 开始。

例如：

```text
数组：[1, 2, 3, 4, 5]
n = 5，k = 4
下标 = n - k = 1
答案 = 数组[1] = 2
```

## 最简单的 Python 写法

```python
import sys

data = list(map(int, sys.stdin.buffer.read().split()))
index = 0
answers = []

while index < len(data):
    # 读取链表长度
    n = data[index]
    index += 1

    # 读取 n 个结点的值
    values = data[index:index + n]
    index += n

    # 读取倒数第 k 个结点
    k = data[index]
    index += 1

    # Python 下标从 0 开始，所以直接取 n-k
    answers.append(str(values[n - k]))

print("\\n".join(answers))
```

## 为什么下标是 `n - k`

假设：

```text
values = [1, 2, 3, 4, 5]
下标      0  1  2  3  4
```

倒数第 1 个是 `5`，它的下标是 `4`：

```text
n - k = 5 - 1 = 4
```

倒数第 4 个是 `2`，它的下标是 `1`：

```text
n - k = 5 - 4 = 1
```

因此统一使用：

```python
values[n - k]
```

## 样例运行

第一组：

```text
n = 3
values = [1, 2, 3]
k = 1
下标 = 3 - 1 = 2
答案 = 3
```

第二组：

```text
n = 8
values = [1, 2, 3, 4, 5, 6, 7, 8]
k = 4
下标 = 8 - 4 = 4
答案 = 5
```

输出：

```text
3
5
```

## 真正链表中的双指针思路

如果使用真正的链表，不能直接通过下标访问。常见做法是让两个指针相差 `k` 个结点：

1. `fast` 先向后走 `k` 步；
2. 然后 `fast` 和 `slow` 同时向后走；
3. `fast` 到达链表末尾时，`slow` 就在倒数第 `k` 个结点。

不过本题的输入已经直接给出了数组形式的结点值，在 Python 中用 `values[n - k]` 更简单，也完全符合题意。

## 复杂度

读取数据需要 `O(n)` 时间，查找本身是 `O(1)`。

```text
时间复杂度：O(n)
空间复杂度：O(n)
```

