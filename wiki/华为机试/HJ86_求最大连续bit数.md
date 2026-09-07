# HJ86 求最大连续 bit 数

## 一、答案

~~~python
import sys

n = int(sys.stdin.readline())
binary = bin(n)[2:]

current = 0
answer = 0

for bit in binary:
    if bit == '1':
        current += 1
        answer = max(answer, current)
    else:
        current = 0

print(answer)
~~~

## 二、题目翻译成人话

输入一个十进制整数，先看它的二进制表示，再找连续出现的 `1` 最长有多少个。

例如 200 的二进制是 `11001000`，最长的连续 `1` 是 `11`，长度为 2。

## 三、这是什么类型的题目

这是“进制转换 + 遍历 + 连续区间统计”题。

## 四、两个变量分别表示什么

`current` 表示当前这一段连续 `1` 的长度；`answer` 表示目前为止找到的最长连续 `1` 长度。

例如二进制 `110111`：

~~~text
字符  current  answer
1       1        1
1       2        2
0       0        2
1       1        2
1       2        2
1       3        3
~~~

## 五、遇到 1 和 0 怎么办

遇到 `1`：

~~~python
current += 1
answer = max(answer, current)
~~~

遇到 `0`：

~~~python
current = 0
~~~

0 会截断当前连续的 1，所以重新计数。但 `answer` 不能清零，因为之前的最长结果仍然有效。

## 六、`bin(n)[2:]` 是什么

`bin(n)` 把整数转换成二进制字符串，但会带前缀 `0b`：

~~~python
bin(200)  # '0b11001000'
~~~

`[2:]` 从下标 2 开始截取，去掉 `0b`：

~~~python
bin(200)[2:]  # '11001000'
~~~

## 七、样例 200

200 的二进制是 `11001000`：

~~~text
第1位1：current=1，answer=1
第2位1：current=2，answer=2
第3位0：current=0，answer=2
第4位0：current=0，answer=2
第5位1：current=1，answer=2
后面的0继续把current清零
~~~

最终输出 2。

## 八、样例 1023

1023 的二进制是 10 个连续的 `1`，所以输出 10。

## 九、不使用 `bin` 的位运算版本

~~~python
import sys

n = int(sys.stdin.readline())
current = 0
answer = 0

while n > 0:
    if n & 1:
        current += 1
        answer = max(answer, current)
    else:
        current = 0

    n >>= 1

print(answer)
~~~

`n & 1` 查看最低位是不是 1；`n >>= 1` 把二进制右移一位，继续检查下一位。初学时推荐先使用 `bin(n)[2:]` 版本。

## 十、复杂度

假设二进制长度为 `L`：

- 字符串版本时间复杂度：`O(L)`；
- 字符串版本额外空间复杂度：`O(L)`；
- 位运算版本额外空间复杂度：`O(1)`。

## 十一、记忆方式

~~~text
遇到1：current加1，并更新answer
遇到0：current清零
最后输出answer
~~~

## 十二、常见错误：变量名拼写不一致

下面的写法是错误的：

```python
current = 0

if bit == '1':
    current += 1
else:
    curent = 0    # 少写了一个 r
```

`current` 和 `curent` 是两个不同的变量。Python 不会自动认为它们是同一个名字，因此原来的 `current` 并没有清零。

正确写法是：

```python
else:
    current = 0
```

变量名必须前后一致，尤其要注意字母拼写。
