# HJ3 明明的随机数

## 一、答案

```python
import sys


n = int(sys.stdin.readline())
numbers = set()

for _ in range(n):
    number = int(sys.stdin.readline())
    numbers.add(number)

sorted_numbers = sorted(numbers)

for number in sorted_numbers:
    print(number)
```

## 二、解题思路

题目要求完成两件事：

1. 删除重复数字；
2. 将剩余数字从小到大排序并逐行输出。

Python 中可以使用：

- `set` 完成去重；
- `sorted()` 完成从小到大排序。

例如输入的数字是：

```text
2、2、1
```

放入集合后：

```python
{1, 2}
```

重复的 `2` 自动只保留一个。

排序后：

```python
[1, 2]
```

最后依次输出：

```text
1
2
```

## 三、代码逐行解释

### 1. 读取数字个数

```python
n = int(sys.stdin.readline())
```

第一行输入表示后面有多少个数字。

例如：

```text
3
```

说明后面还有 `3` 行数字。

`sys.stdin.readline()` 读取到的是字符串，所以使用 `int()` 转换成整数。

### 2. 创建集合

```python
numbers = set()
```

`set()` 创建一个空集合。

集合有一个重要特点：

```text
相同的元素只能保存一份
```

例如：

```python
numbers = set()
numbers.add(2)
numbers.add(2)
numbers.add(1)
```

最终集合中只有：

```python
{1, 2}
```

### 3. 循环读取 `n` 个数字

```python
for _ in range(n):
    number = int(sys.stdin.readline())
    numbers.add(number)
```

`range(n)` 表示循环 `n` 次。

如果 `n = 3`，循环就会执行三次，每次读取一个数字。

```python
numbers.add(number)
```

把数字放入集合。如果数字已经存在，集合不会重复保存。

这里的 `_` 只是一个变量名，表示我们只关心循环次数，不需要使用当前是第几次循环。

### 4. 从小到大排序

```python
sorted_numbers = sorted(numbers)
```

集合负责去重，但集合本身不保证按照从小到大的顺序排列，因此还需要调用 `sorted()`。

例如：

```python
numbers = {2, 1}
```

排序后：

```python
sorted_numbers = [1, 2]
```

注意：`sorted()` 的返回结果是一个列表。

### 5. 逐行输出

```python
for number in sorted_numbers:
    print(number)
```

依次取出排序后的每一个数字。每次调用一次 `print()`，就会输出一行。

例如列表是：

```python
[1, 2]
```

第一次循环输出：

```text
1
```

第二次循环输出：

```text
2
```

## 四、示例执行过程

输入：

```text
3
2
2
1
```

第一行：

```python
n = 3
```

接下来循环三次。

第一次读到 `2`：

```python
numbers = {2}
```

第二次又读到 `2`：

```python
numbers = {2}
```

因为集合不会保存重复数字，所以没有变化。

第三次读到 `1`：

```python
numbers = {1, 2}
```

排序：

```python
sorted_numbers = [1, 2]
```

最终输出：

```text
1
2
```

## 五、为什么不能只用 `sort()`

排序只能改变数字的顺序，不能删除重复数字。

例如：

```python
numbers = [2, 2, 1]
numbers.sort()
```

结果是：

```python
[1, 2, 2]
```

两个 `2` 仍然存在。

所以本题需要：

```text
先使用 set 去重
再使用 sorted 排序
```

## 六、另一种一次性读取写法

也可以一次性读取全部输入：

```python
import sys


data = list(map(int, sys.stdin.read().split()))
n = data[0]
numbers = data[1:n + 1]

for number in sorted(set(numbers)):
    print(number)
```

这个版本也正确，但对于初学者，前面的逐行读取版本更容易和题目的输入格式对应。

## 七、复杂度

假设输入数字个数为 `n`，去重后剩余 `k` 个数字：

- 放入集合平均需要 `O(n)` 时间；
- 排序需要 `O(k log k)` 时间；
- 空间复杂度为 `O(k)`。

因为 `k <= n`，也可以简单记成：

```text
时间复杂度：O(n log n)
空间复杂度：O(n)
```

## 八、记忆方式

```text
set() 创建集合；
add() 把数字放进集合并自动去重；
sorted() 从小到大排序；
for + print() 逐行输出。
```
