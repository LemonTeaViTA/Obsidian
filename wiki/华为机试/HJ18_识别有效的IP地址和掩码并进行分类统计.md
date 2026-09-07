# HJ18 识别有效的 IP 地址和掩码并进行分类统计

## 一、答案

```python
import sys


def parse_address(text):
    parts = text.split(".")

    if len(parts) != 4:
        return None

    numbers = []

    for part in parts:
        if not part.isdigit():
            return None

        number = int(part)

        if not 0 <= number <= 255:
            return None

        numbers.append(number)

    return numbers


def is_valid_mask(mask):
    bits = "".join(f"{number:08b}" for number in mask)

    if bits == "0" * 32 or bits == "1" * 32:
        return False

    return "01" not in bits


class_a = 0
class_b = 0
class_c = 0
class_d = 0
class_e = 0
error_count = 0
private_count = 0

for line in sys.stdin:
    line = line.strip()

    if not line:
        continue

    fields = line.split("~")

    if len(fields) != 2:
        error_count += 1
        continue

    ip_text, mask_text = fields
    ip = parse_address(ip_text)

    if ip is None:
        error_count += 1
        continue

    first, second, _, _ = ip

    # 0.*.*.* 和 127.*.*.* 的优先级最高，直接跳过
    if first == 0 or first == 127:
        continue

    mask = parse_address(mask_text)

    if mask is None or not is_valid_mask(mask):
        error_count += 1
        continue

    if 1 <= first <= 126:
        class_a += 1
    elif 128 <= first <= 191:
        class_b += 1
    elif 192 <= first <= 223:
        class_c += 1
    elif 224 <= first <= 239:
        class_d += 1
    elif 240 <= first <= 255:
        class_e += 1

    if first == 10:
        private_count += 1
    elif first == 172 and 16 <= second <= 31:
        private_count += 1
    elif first == 192 and second == 168:
        private_count += 1

print(
    class_a,
    class_b,
    class_c,
    class_d,
    class_e,
    error_count,
    private_count
)
```

## 二、先把题目拆成四步

这道题看起来很长，但处理每一行时只需要完成四步：

```text
第一步：检查 IP 地址格式；
第二步：如果是 0.*.*.* 或 127.*.*.*，直接跳过；
第三步：检查子网掩码是否合法；
第四步：统计 IP 类别和私有 IP。
```

最重要的是处理顺序。

题目明确规定：

```text
0.*.*.* 和 127.*.*.* 直接跳过，
即使它们的掩码错误，也不能计入错误数量。
```

所以特殊 IP 的判断必须放在掩码检查之前。

## 三、输入为什么使用 `for line in sys.stdin`

这道题没有告诉我们确切有多少行，需要一直读取到文件结尾。

因此使用：

```python
for line in sys.stdin:
```

它的意思是：

```text
输入还有下一行，就继续处理；
输入全部读完，循环自动结束。
```

每行的格式是：

```text
IP地址~子网掩码
```

例如：

```text
192.168.0.2~255.255.255.0
```

执行：

```python
ip_text, mask_text = line.split("~")
```

可以拆成：

```python
ip_text = "192.168.0.2"
mask_text = "255.255.255.0"
```

## 四、如何检查 IP 地址格式

代码定义了一个函数：

```python
def parse_address(text):
```

这个函数既可以检查 IP，也可以检查掩码的基本格式，因为它们都应该是四段数字：

```text
数字.数字.数字.数字
```

### 1. 必须正好有四段

```python
parts = text.split(".")

if len(parts) != 4:
    return None
```

例如：

```python
"192.168.0.2".split(".")
```

得到：

```python
["192", "168", "0", "2"]
```

正好四段，暂时合法。

如果是：

```text
192.168.2
```

只有三段，不合法。

### 2. 每一段都必须是数字

```python
if not part.isdigit():
    return None
```

例如：

```python
"168".isdigit()  # True
"".isdigit()     # False
"1A".isdigit()   # False
```

因此：

```text
19..0.
```

拆分后包含空字符串，会被判断为错误 IP。

### 3. 每段必须在 0 到 255

```python
number = int(part)

if not 0 <= number <= 255:
    return None
```

例如：

```text
192.168.0.2    合法范围
192.168.0.256  最后一段超过 255，不合法
```

### 4. 合法时返回四个数字

```python
return numbers
```

例如：

```python
parse_address("192.168.0.2")
```

返回：

```python
[192, 168, 0, 2]
```

如果不合法，则返回：

```python
None
```

## 五、特殊 IP 为什么先跳过

```python
first, second, _, _ = ip

if first == 0 or first == 127:
    continue
```

`first` 是 IP 的第一段数字，`second` 是第二段数字。

例如：

```text
127.201.56.50
```

那么：

```python
first = 127
second = 201
```

题目规定 `0.*.*.*` 和 `127.*.*.*`：

```text
不属于 A～E 类；
不统计私有地址；
掩码即使错误也不统计错误；
直接跳过这一整行。
```

`continue` 表示直接进入下一行，不再检查当前行的掩码。

这是本题非常重要的优先级规则。

## 六、如何判断子网掩码

合法掩码转换成 32 位二进制以后，必须满足：

```text
前面是连续的 1，后面是连续的 0。
```

例如：

```text
11111111 11111111 11111111 11111000
```

这是合法的。

而且：

```text
全 0 非法；
全 1 非法。
```

### 1. 每段转换成八位二进制

```python
bits = "".join(f"{number:08b}" for number in mask)
```

`08b` 表示：

```text
转换为二进制；
长度不足 8 位时，在左边补 0。
```

例如：

```python
f"{255:08b}"  # "11111111"
f"{248:08b}"  # "11111000"
f"{0:08b}"    # "00000000"
```

掩码：

```text
255.255.255.248
```

拼接后：

```text
11111111111111111111111111111000
```

### 2. 排除全 0 和全 1

```python
if bits == "0" * 32 or bits == "1" * 32:
    return False
```

```python
"0" * 32
```

表示由 32 个 `0` 组成的字符串。

```python
"1" * 32
```

表示由 32 个 `1` 组成的字符串。

### 3. 为什么不能出现 `01`

```python
return "01" not in bits
```

合法掩码只能是：

```text
111111...111000...000
```

一旦从 `1` 变成 `0`，后面就不能重新出现 `1`。

如果字符串中出现：

```text
01
```

说明进入 `0` 区域以后又出现了 `1`，一定不合法。

例如非法掩码：

```text
255.254.255.0
```

二进制拼接后：

```text
11111111 11111110 11111111 00000000
```

中间出现了 `01`，所以非法。

## 七、错误数量什么时候增加

下面两种情况都会让错误数量增加一次：

```text
IP 地址错误；
子网掩码错误。
```

代码是：

```python
if ip is None:
    error_count += 1
    continue
```

以及：

```python
if mask is None or not is_valid_mask(mask):
    error_count += 1
    continue
```

一行最多只计一次错误。

如果 IP 和掩码都错误，也只表示这一条地址信息错误一次。

## 八、如何统计 A～E 类

IP 类别只需要查看第一段数字：

```python
if 1 <= first <= 126:
    class_a += 1
elif 128 <= first <= 191:
    class_b += 1
elif 192 <= first <= 223:
    class_c += 1
elif 224 <= first <= 239:
    class_d += 1
elif 240 <= first <= 255:
    class_e += 1
```

对应关系是：

| 第一段范围 | 类别 |
| ---: | --- |
| `1～126` | A 类 |
| `127` | 特殊，跳过 |
| `128～191` | B 类 |
| `192～223` | C 类 |
| `224～239` | D 类 |
| `240～255` | E 类 |
| `0` | 特殊，跳过 |

## 九、如何统计私有 IP

私有 IP 有三个范围。

### 第一种

```text
10.*.*.*
```

代码：

```python
if first == 10:
    private_count += 1
```

### 第二种

```text
172.16.*.* 到 172.31.*.*
```

代码：

```python
elif first == 172 and 16 <= second <= 31:
    private_count += 1
```

### 第三种

```text
192.168.*.*
```

代码：

```python
elif first == 192 and second == 168:
    private_count += 1
```

## 十、为什么一个 IP 可以统计两次

题目说，一个 IP 可以同时计入类别和私有地址。

例如：

```text
192.168.0.2
```

第一段是 `192`，所以它属于 C 类。

前两段是 `192.168`，所以它也是私有 IP。

因此它会同时让：

```text
C 类数量加 1；
私有 IP 数量加 1。
```

这两个统计不是互斥关系。

## 十一、示例 1 完整分析

输入：

```text
10.70.44.68~1.1.1.5
1.0.0.1~255.0.0.0
192.168.0.2~255.255.255.0
19..0.~255.255.255.0
```

### 第一行

```text
10.70.44.68~1.1.1.5
```

IP 格式正确，但掩码 `1.1.1.5` 不是连续的 `1` 后接连续的 `0`，所以错误数加 `1`。

因为掩码错误，这个 IP 不再统计为 A 类或私有地址。

### 第二行

```text
1.0.0.1~255.0.0.0
```

IP 和掩码都合法，第一段是 `1`，所以 A 类加 `1`。

### 第三行

```text
192.168.0.2~255.255.255.0
```

IP 和掩码都合法：

```text
第一段为 192，所以 C 类加 1；
前两段为 192.168，所以私有 IP 加 1。
```

### 第四行

```text
19..0.~255.255.255.0
```

IP 中有空段，格式错误，所以错误数加 `1`。

最终输出：

```text
1 0 1 0 0 2 1
```

## 十二、示例 2 为什么错误掩码也不统计

输入：

```text
0.201.56.50~255.255.255.0
127.201.56.50~255.255.111.255
```

第一条 IP 的第一段是 `0`，直接跳过。

第二条 IP 的第一段是 `127`，也直接跳过。虽然它的掩码错误，但特殊 IP 的跳过规则优先级更高，所以错误数量不增加。

最终输出：

```text
0 0 0 0 0 0 0
```

## 十三、输出顺序

题目要求输出七个数字，顺序不能写错：

```text
A 类数量
B 类数量
C 类数量
D 类数量
E 类数量
错误数量
私有 IP 数量
```

即：

```python
print(
    class_a,
    class_b,
    class_c,
    class_d,
    class_e,
    error_count,
    private_count
)
```

`print()` 接收多个值时会自动使用空格分隔。

## 十四、复杂度

设共有 `T` 行地址信息。

每行只有固定的四段 IP 和四段掩码：

- 时间复杂度：`O(T)`；
- 额外空间复杂度：`O(1)`。

## 十五、记忆方式

```text
先验证 IP；
0 和 127 开头优先跳过；
再验证掩码；
掩码二进制不能全 0、全 1，也不能出现 01；
最后统计 A～E 类和私有 IP；
类别统计与私有统计可以同时增加。
```
