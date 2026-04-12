## 包装类与 Object
### Integer 127 与 128 的 `==` 比较结果？

**答案：**

```java
Integer a = 127, b = 127; // a == b -> true
Integer c = 128, d = 128; // c == d -> false
```

因为 `Integer` 默认缓存区间是 `-128~127`，区间内复用缓存对象，区间外新建对象。

---

### String 怎么转 Integer？原理？

**答案：**

常见方法：

- `Integer.parseInt(String)`
- `Integer.valueOf(String)`

核心都依赖解析逻辑将字符串逐位转为数值；`valueOf` 额外返回包装类型并可能复用缓存。

---

### Object 类的常见方法？

**答案：**

高频：

- `equals`：对象相等判断。
- `hashCode`：哈希码。
- `toString`：字符串表示。
- `clone`：对象拷贝（受限于接口与实现）。
- `getClass`：运行时类信息。
- `wait/notify/notifyAll`：线程协作。

其中 `equals/hashCode` 需要成对考虑。

---
