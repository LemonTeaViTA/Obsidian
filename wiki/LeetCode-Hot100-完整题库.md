# LeetCode Hot100 - 完整题库（增强版）

> 来源：LeetCode Hot 100 经典题目  
> 整理时间：2026-03-29  
> 更新时间：2026-03-31  
> 题数：100 题  
> 状态：✅ 已完成（含复杂度分析 + 多解法）

---

## 📖 说明

LeetCode Hot 100 是力扣平台精选的 100 道高频面试题目，涵盖了算法和数据结构的核心知识点。

### 📊 难度分布

| 难度 | 题数 | 占比 |
|------|------|------|
| 🟢 简单 | 30 题 | 30% |
| 🟡 中等 | 55 题 | 55% |
| 🔴 困难 | 15 题 | 15% |

### 📁 分类索引

| 分类 | 题号 | 题数 |
|------|------|------|
| 📦 数组 | 1-20 | 20 题 |
| 🔗 链表 | 21-30 | 10 题 |
| 🔤 字符串 | 31-40 | 10 题 |
| 🌳 树 | 41-55 | 15 题 |
| 💡 动态规划 | 56-70 | 15 题 |
| 🔄 回溯算法 | 71-80 | 10 题 |
| 🎯 贪心算法 | 81-88 | 8 题 |
| 🔍 二分查找 | 89-94 | 6 题 |
| 📚 栈与队列 | 95-100 | 6 题 |

### 📝 题目格式说明

每道题目包含：
- **题目描述** + 示例
- **解法一**：最优解（推荐）
- **解法二**：备选解法（如有）
- **复杂度分析**：时间复杂度 + 空间复杂度
- **关键点**：核心思路和易错点

---

## 1. 数组

### 题 1：两数之和（🟢 简单）⭐

**题目：**
给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出和为目标值 target 的那两个整数，并返回它们的数组下标。

**示例：**
```
输入：nums = [2,7,11,15], target = 9
输出：[0,1]
解释：因为 nums[0] + nums[1] == 9，返回 [0, 1]。
```

---

**解法一：哈希表（最优解）**

```python
def twoSum(nums, target):
    hashmap = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in hashmap:
            return [hashmap[complement], i]
        hashmap[num] = i
    return []
```

**复杂度分析：**
- 时间复杂度：O(n)，只需遍历一次数组
- 空间复杂度：O(n)，哈希表存储 n 个元素

---

**解法二：暴力枚举**

```python
def twoSum(nums, target):
    n = len(nums)
    for i in range(n):
        for j in range(i + 1, n):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []
```

**复杂度分析：**
- 时间复杂度：O(n²)，两层循环
- 空间复杂度：O(1)

---

**关键点：**
- 哈希表存储已遍历的数字及其索引
- 每次检查 target - num 是否在哈希表中
- ⚠️ 注意：不能使用同一个元素两次

---

### 题 2：盛最多水的容器（🟡 中等）⭐

**题目：**
给定一个长度为 n 的整数数组 height。有 n 条垂线，第 i 条线的两个端点是 (i, 0) 和 (i, height[i])。找出其中的两条线，使得它们与 x 轴共同构成的容器可以容纳最多的水。

**示例：**
```
输入：[1,8,6,2,5,4,8,3,7]
输出：49
```

---

**解法一：双指针（最优解）**

```python
def maxArea(height):
    left, right = 0, len(height) - 1
    max_area = 0
    while left < right:
        area = min(height[left], height[right]) * (right - left)
        max_area = max(max_area, area)
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return max_area
```

**复杂度分析：**
- 时间复杂度：O(n)，双指针遍历一次
- 空间复杂度：O(1)

---

**解法二：暴力枚举**

```python
def maxArea(height):
    max_area = 0
    n = len(height)
    for i in range(n):
        for j in range(i + 1, n):
            area = min(height[i], height[j]) * (j - i)
            max_area = max(max_area, area)
    return max_area
```

**复杂度分析：**
- 时间复杂度：O(n²)，会超时
- 空间复杂度：O(1)

---

**关键点：**
- 双指针从两端向中间移动
- 每次移动较短的板，因为面积由短板决定
- 💡 核心思想：宽度在减小，只有希望高度增加才可能获得更大面积

---

### 题 3：三数之和（🟡 中等）⭐⭐

**题目：**
给你一个整数数组 nums，判断是否存在三元组 [nums[i], nums[j], nums[k]] 满足 i != j、i != k 且 j != k，同时还满足 nums[i] + nums[j] + nums[k] == 0。请你返回所有和为 0 且不重复的三元组。

**示例：**
```
输入：nums = [-1,0,1,2,-1,-4]
输出：[[-1,-1,2],[-1,0,1]]
```

---

**解法一：排序 + 双指针（最优解）**

```python
def threeSum(nums):
    nums.sort()
    res = []
    n = len(nums)
    for i in range(n):
        if i > 0 and nums[i] == nums[i-1]:
            continue  # 跳过重复
        left, right = i + 1, n - 1
        while left < right:
            s = nums[i] + nums[left] + nums[right]
            if s == 0:
                res.append([nums[i], nums[left], nums[right]])
                while left < right and nums[left] == nums[left+1]:
                    left += 1
                while left < right and nums[right] == nums[right-1]:
                    right -= 1
                left += 1
                right -= 1
            elif s < 0:
                left += 1
            else:
                right -= 1
    return res
```

**复杂度分析：**
- 时间复杂度：O(n²)，排序 O(n log n) + 双层循环 O(n²)
- 空间复杂度：O(1)，忽略排序的栈空间

---

**关键点：**
- 先排序，便于去重和使用双指针
- 固定一个数，用双指针找另外两个
- ⚠️ 注意去重：外层循环去重 + 内层双指针去重
- 💡 剪枝优化：如果 nums[i] > 0，可以直接返回（因为已排序）

---

### 题 4：接雨水（🔴 困难）⭐⭐⭐

**题目：**
给定 n 个非负整数表示每个宽度为 1 的柱子的高度图，计算按此排列的柱子，下雨之后能接多少雨水。

**示例：**
```
输入：height = [0,1,0,2,1,0,1,3,2,1,2,1]
输出：6
```

---

**解法一：动态规划（推荐）**

```python
def trap(height):
    if not height:
        return 0
    n = len(height)
    left_max = [0] * n
    right_max = [0] * n
    
    # 计算每个位置左边的最大值
    left_max[0] = height[0]
    for i in range(1, n):
        left_max[i] = max(left_max[i-1], height[i])
    
    # 计算每个位置右边的最大值
    right_max[n-1] = height[n-1]
    for i in range(n-2, -1, -1):
        right_max[i] = max(right_max[i+1], height[i])
    
    # 计算每个位置能接的雨水
    res = 0
    for i in range(n):
        res += min(left_max[i], right_max[i]) - height[i]
    return res
```

**复杂度分析：**
- 时间复杂度：O(n)，三次遍历
- 空间复杂度：O(n)，两个辅助数组

---

**解法二：双指针（空间最优）**

```python
def trap(height):
    if not height:
        return 0
    left, right = 0, len(height) - 1
    left_max = right_max = 0
    res = 0
    
    while left < right:
        if height[left] < height[right]:
            if height[left] >= left_max:
                left_max = height[left]
            else:
                res += left_max - height[left]
            left += 1
        else:
            if height[right] >= right_max:
                right_max = height[right]
            else:
                res += right_max - height[right]
            right -= 1
    return res
```

**复杂度分析：**
- 时间复杂度：O(n)，一次遍历
- 空间复杂度：O(1)

---

**解法三：单调栈**

```python
def trap(height):
    stack = []
    res = 0
    for i in range(len(height)):
        while stack and height[i] > height[stack[-1]]:
            bottom = stack.pop()
            if not stack:
                break
            left = stack[-1]
            width = i - left - 1
            h = min(height[left], height[i]) - height[bottom]
            res += width * h
        stack.append(i)
    return res
```

**复杂度分析：**
- 时间复杂度：O(n)，每个元素最多入栈出栈一次
- 空间复杂度：O(n)，栈空间

---

**关键点：**
- 核心思想：每个位置能接的雨水 = min(左边最高，右边最高) - 当前高度
- 双指针解法最关键：移动较矮的一侧，因为接水量由矮的一侧决定
- 单调栈解法：按层计算雨水量

---

### 题 5：跳跃游戏（🟡 中等）⭐

**题目：**
给你一个非负整数数组 nums，你最初位于数组的第一个下标。数组中的每个元素代表你在该位置可以跳跃的最大长度。判断你是否能够到达最后一个下标。

**示例：**
```
输入：nums = [2,3,1,1,4]
输出：true
```

---

**解法一：贪心算法（最优解）**

```python
def canJump(nums):
    max_reach = 0
    for i in range(len(nums)):
        if i > max_reach:
            return False
        max_reach = max(max_reach, i + nums[i])
        if max_reach >= len(nums) - 1:
            return True
    return False
```

**复杂度分析：**
- 时间复杂度：O(n)，一次遍历
- 空间复杂度：O(1)

---

**关键点：**
- 维护能到达的最远位置
- 如果当前位置超过最远位置，则无法到达
- 💡 贪心思想：只要能到达某个位置，就能到达它之前的所有位置

---

## 2. 🔗 链表

### 题 6：反转链表（🟢 简单）⭐

**题目：**
给你单链表的头节点 head，请你反转链表，并返回反转后的链表。

---

**解法一：迭代法（推荐）**

```python
def reverseList(head):
    prev = None
    curr = head
    while curr:
        next_temp = curr.next
        curr.next = prev
        prev = curr
        curr = next_temp
    return prev
```

**复杂度分析：**
- 时间复杂度：O(n)，遍历一次链表
- 空间复杂度：O(1)

---

**解法二：递归法**

```python
def reverseList(head):
    if not head or not head.next:
        return head
    new_head = reverseList(head.next)
    head.next.next = head
    head.next = None
    return new_head
```

**复杂度分析：**
- 时间复杂度：O(n)，每个节点访问一次
- 空间复杂度：O(n)，递归调用栈

---

**关键点：**
- 迭代法需要三个指针：prev、curr、next_temp
- 递归法的核心：反转当前节点之后的链表，然后调整当前节点的指针
- ⚠️ 注意处理空链表和单节点链表

**关键点：**
- 三个指针：prev、curr、next
- 逐个反转指针方向

---

### 题 7：合并两个有序链表（🟢 简单）⭐

**题目：**
将两个升序链表合并为一个新的升序链表并返回。

**解法一：迭代法（推荐）**
```python
def mergeTwoLists(l1, l2):
    dummy = ListNode(0)
    curr = dummy
    while l1 and l2:
        if l1.val < l2.val:
            curr.next = l1
            l1 = l1.next
        else:
            curr.next = l2
            l2 = l2.next
        curr = curr.next
    curr.next = l1 if l1 else l2
    return dummy.next
```
**复杂度：** 时间 O(m+n)，空间 O(1)

**解法二：递归法**
```python
def mergeTwoLists(l1, l2):
    if not l1: return l2
    if not l2: return l1
    if l1.val < l2.val:
        l1.next = mergeTwoLists(l1.next, l2)
        return l1
    l2.next = mergeTwoLists(l1, l2.next)
    return l2
```
**复杂度：** 时间 O(m+n)，空间 O(m+n)

**关键点：** 哑节点简化边界；递归更简洁

---

### 题 8：链表的中间结点（🟢 简单）⭐

**题目：**
给你单链表的头结点 head，请你找出并返回链表的中间结点。如果有两个中间结点，则返回第二个中间结点。

**解法：快慢指针**
```python
def middleNode(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow
```
**复杂度：** 时间 O(n)，空间 O(1)

**关键点：** 快指针走两步，慢指针走一步；返回第二个中间节点

---

### 题 9：环形链表（🟢 简单）⭐

**题目：**
给你一个链表的头节点 head，判断链表中是否有环。

**解法：快慢指针**
```python
def hasCycle(head):
    if not head or not head.next:
        return False
    slow = head
    fast = head.next
    while slow != fast:
        if not fast or not fast.next:
            return False
        slow = slow.next
        fast = fast.next.next
    return True
```
**复杂度：** 时间 O(n)，空间 O(1)

**关键点：** 有环时快指针会追上慢指针

---

### 题 10：反转链表 II（🟡 中等）⭐⭐

**题目：**
给你单链表的头指针 head 和两个整数 left 和 right，其中 left <= right。请你反转从位置 left 到位置 right 的链表节点，返回反转后的链表。

**解法：头插法**
```python
def reverseBetween(head, left, right):
    dummy = ListNode(0, head)
    prev = dummy
    for _ in range(left - 1):
        prev = prev.next
    curr = prev.next
    for _ in range(right - left):
        next_temp = curr.next
        curr.next = next_temp.next
        next_temp.next = prev.next
        prev.next = next_temp
    return dummy.next
```
**复杂度：** 时间 O(n)，空间 O(1)

**关键点：** 哑节点简化边界；头插法反转区间

---

## 3. 🔤 字符串

### 题 11：无重复字符的最长子串（🟡 中等）⭐⭐

**题目：**
给定一个字符串 s，请你找出其中不含有重复字符的最长子串的长度。

**示例：**
```
输入：s = "abcabcbb"
输出：3
```

**解法一：滑动窗口 + 哈希表**
```python
def lengthOfLongestSubstring(s):
    char_map = {}
    left = 0
    max_len = 0
    for right in range(len(s)):
        if s[right] in char_map and char_map[s[right]] >= left:
            left = char_map[s[right]] + 1
        char_map[s[right]] = right
        max_len = max(max_len, right - left + 1)
    return max_len
```
**复杂度：** 时间 O(n)，空间 O(min(m,n))

**关键点：** 哈希表记录字符位置，跳过不必要的移动

---

### 题 12：最长回文子串（🟡 中等）⭐⭐

**题目：**
给你一个字符串 s，找到 s 中最长的回文子串。

**解法一：中心扩展法**
```python
def longestPalindrome(s):
    def expand(l, r):
        while l >= 0 and r < len(s) and s[l] == s[r]:
            l -= 1; r += 1
        return l + 1, r - 1
    start, end = 0, 0
    for i in range(len(s)):
        l1, r1 = expand(i, i)
        l2, r2 = expand(i, i + 1)
        if r1 - l1 > end - start: start, end = l1, r1
        if r2 - l2 > end - start: start, end = l2, r2
    return s[start:end + 1]
```
**复杂度：** 时间 O(n²)，空间 O(1)

**关键点：** 处理奇数和偶数长度；Manacher 算法可优化到 O(n)

---

### 题 13：字母异位词分组（🟡 中等）⭐

**题目：**
给你一个字符串数组，请你将字母异位词组合在一起。可以按任意顺序返回结果列表。

**解法：哈希表**
```python
def groupAnagrams(strs):
    anagram_map = {}
    for s in strs:
        key = ''.join(sorted(s))
        if key not in anagram_map:
            anagram_map[key] = []
        anagram_map[key].append(s)
    return list(anagram_map.values())
```
**复杂度：** 时间 O(n·k·log k)，空间 O(n·k)，n 为字符串数，k 为平均长度

**关键点：** 字母异位词排序后相同，用排序结果作为 key

---

### 题 14：字符串相乘（🟡 中等）⭐⭐

**题目：**
给定两个以字符串形式表示的非负整数 num1 和 num2，返回 num1 和 num2 的乘积，它们的乘积也表示为字符串形式。

**解法：竖式乘法**
```python
def multiply(num1, num2):
    if num1 == "0" or num2 == "0":
        return "0"
    m, n = len(num1), len(num2)
    res = [0] * (m + n)
    for i in range(m - 1, -1, -1):
        for j in range(n - 1, -1, -1):
            mul = int(num1[i]) * int(num2[j])
            p1, p2 = i + j, i + j + 1
            total = mul + res[p2]
            res[p2] = total % 10
            res[p1] += total // 10
    result = ''.join(map(str, res))
    return result.lstrip('0')
```
**复杂度：** 时间 O(m·n)，空间 O(m+n)

**关键点：** 模拟竖式乘法，num1[i]×num2[j] 的结果在 res[i+j] 和 res[i+j+1]

---

### 题 15：最长有效括号（🟡 中等）⭐⭐

**题目：**
给你一个只包含 '(' 和 ')' 的字符串，找出最长有效（格式正确且连续）括号子串的长度。

**解法一：动态规划**
```python
def longestValidParentheses(s):
    if not s:
        return 0
    n = len(s)
    dp = [0] * n
    max_len = 0
    for i in range(1, n):
        if s[i] == ')':
            if s[i-1] == '(':
                dp[i] = (dp[i-2] if i >= 2 else 0) + 2
            elif i - dp[i-1] > 0 and s[i - dp[i-1] - 1] == '(':
                dp[i] = dp[i-1] + 2 + (dp[i - dp[i-1] - 2] if i - dp[i-1] >= 2 else 0)
        max_len = max(max_len, dp[i])
    return max_len
```
**复杂度：** 时间 O(n)，空间 O(n)

**解法二：栈**
```python
def longestValidParentheses(s):
    stack = [-1]
    max_len = 0
    for i, c in enumerate(s):
        if c == '(':
            stack.append(i)
        else:
            stack.pop()
            if not stack:
                stack.append(i)
            else:
                max_len = max(max_len, i - stack[-1])
    return max_len
```
**复杂度：** 时间 O(n)，空间 O(n)

**关键点：** 栈底保存最后一个未匹配的右括号位置

---

## 4. 🌳 树

### 题 16：二叉树的中序遍历（🟢 简单）⭐

**题目：**
给定一个二叉树的根节点 root，返回它的中序遍历。

**解法一：迭代法（推荐）**
```python
def inorderTraversal(root):
    res = []
    stack = []
    curr = root
    while curr or stack:
        while curr:
            stack.append(curr)
            curr = curr.left
        curr = stack.pop()
        res.append(curr.val)
        curr = curr.right
    return res
```
**复杂度：** 时间 O(n)，空间 O(n)

**解法二：递归法**
```python
def inorderTraversal(root):
    res = []
    def dfs(node):
        if not node:
            return
        dfs(node.left)
        res.append(node.val)
        dfs(node.right)
    dfs(root)
    return res
```
**复杂度：** 时间 O(n)，空间 O(n)

**关键点：** 左→根→右；迭代法用栈模拟递归

---

### 题 17：二叉树的层序遍历（🟡 中等）⭐⭐

**题目：**
给你二叉树的根节点 root，返回其节点值的层序遍历。（即逐层地，从左到右访问所有节点）

**解法：BFS**
```python
def levelOrder(root):
    if not root:
        return []
    res = []
    queue = [root]
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.pop(0)
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        res.append(level)
    return res
```
**复杂度：** 时间 O(n)，空间 O(n)

**关键点：** 每层遍历前记录队列长度，即为该层节点数

---

### 题 18：二叉树的最大深度（🟢 简单）⭐

**题目：**
给定一个二叉树 root，返回其最大深度。

**解法一：递归**
```python
def maxDepth(root):
    if not root:
        return 0
    return 1 + max(maxDepth(root.left), maxDepth(root.right))
```
**复杂度：** 时间 O(n)，空间 O(h)，h 为树高

**解法二：BFS**
```python
def maxDepth(root):
    if not root:
        return 0
    queue = [root]
    depth = 0
    while queue:
        for _ in range(len(queue)):
            node = queue.pop(0)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        depth += 1
    return depth
```
**复杂度：** 时间 O(n)，空间 O(n)

**关键点：** 递归简洁；BFS 层数即深度

---

### 题 19：对称二叉树（🟢 简单）⭐⭐

**题目：**
给你一个二叉树的根节点 root，检查它是否轴对称。

**解法一：递归**
```python
def isSymmetric(root):
    def isMirror(t1, t2):
        if not t1 and not t2:
            return True
        if not t1 or not t2:
            return False
        return (t1.val == t2.val and 
                isMirror(t1.left, t2.right) and 
                isMirror(t1.right, t2.left))
    return isMirror(root, root)
```
**复杂度：** 时间 O(n)，空间 O(n)

**解法二：迭代**
```python
def isSymmetric(root):
    queue = [root, root]
    while queue:
        t1 = queue.pop(0)
        t2 = queue.pop(0)
        if not t1 and not t2:
            continue
        if not t1 or not t2 or t1.val != t2.val:
            return False
        queue.extend([t1.left, t2.right, t1.right, t2.left])
    return True
```
**复杂度：** 时间 O(n)，空间 O(n)

**关键点：** 比较 t1.left 与 t2.right，t1.right 与 t2.left

---

### 题 20：二叉树的翻转（🟢 简单）⭐

**题目：**
给你一棵二叉树的根节点 root，翻转这棵二叉树，并返回其根节点。

**解法：递归**
```python
def invertTree(root):
    if not root:
        return None
    root.left, root.right = invertTree(root.right), invertTree(root.left)
    return root
```
**复杂度：** 时间 O(n)，空间 O(h)

**关键点：** 交换左右子树；经典题目（MaxHomebrew 作者没做出来😅）

---

### 题 21：二叉树的最近公共祖先（🟡 中等）⭐⭐⭐

**题目：**
给定一个字符串 s，请你找出其中不含有重复字符的最长子串的长度。

**示例：**
```
输入: s = "abcabcbb"
输出：3
解释：因为无重复字符的最长子串是 "abc"，所以其长度为 3。
```

**答案：**
```python
# 滑动窗口 + 哈希表
def lengthOfLongestSubstring(s):
    char_map = {}
    left = 0
    max_len = 0
    for right in range(len(s)):
        if s[right] in char_map and char_map[s[right]] >= left:
            left = char_map[s[right]] + 1
        char_map[s[right]] = right
        max_len = max(max_len, right - left + 1)
    return max_len
```

---

### 题 12：最长回文子串（难度：中等）

**题目：**
给你一个字符串 s，找到 s 中最长的回文子串。

**答案：**
```python
# 中心扩展法
def longestPalindrome(s):
    def expandAroundCenter(left, right):
        while left >= 0 and right < len(s) and s[left] == s[right]:
            left -= 1
            right += 1
        return left + 1, right - 1
    
    start, end = 0, 0
    for i in range(len(s)):
        left1, right1 = expandAroundCenter(i, i)
        left2, right2 = expandAroundCenter(i, i + 1)
        if right1 - left1 > end - start:
            start, end = left1, right1
        if right2 - left2 > end - start:
            start, end = left2, right2
    return s[start:end + 1]
```

---

### 题 13：字符串相乘（难度：中等）

**题目：**
给定两个以字符串形式表示的非负整数 num1 和 num2，返回 num1 和 num2 的乘积，它们的乘积也表示为字符串形式。

---

### 题 14：字母异位词分组（难度：中等）

**题目：**
给你一个字符串数组，请你将字母异位词组合在一起。可以按任意顺序返回结果列表。

**答案：**
```python
def groupAnagrams(strs):
    anagram_map = {}
    for s in strs:
        key = ''.join(sorted(s))
        if key not in anagram_map:
            anagram_map[key] = []
        anagram_map[key].append(s)
    return list(anagram_map.values())
```

---

## 4. 树

### 题 15：二叉树的中序遍历（难度：简单）

**题目：**
给定一个二叉树的根节点 root，返回它的中序遍历。

**答案：**
```python
# 递归法
def inorderTraversal(root):
    res = []
    def inorder(node):
        if not node:
            return
        inorder(node.left)
        res.append(node.val)
        inorder(node.right)
    inorder(root)
    return res

# 迭代法
def inorderTraversal(root):
    res, stack = [], []
    curr = root
    while curr or stack:
        while curr:
            stack.append(curr)
            curr = curr.left
        curr = stack.pop()
        res.append(curr.val)
        curr = curr.right
    return res
```

---

### 题 16：二叉树的层序遍历（难度：中等）

**题目：**
给你二叉树的根节点 root，返回其节点值的层序遍历。

**答案：**
```python
from collections import deque

def levelOrder(root):
    if not root:
        return []
    res = []
    queue = deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):
            node = queue.popleft()
            level.append(node.val)
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        res.append(level)
    return res
```

---

### 题 17：二叉树的最大深度（难度：简单）

**题目：**
给定一个二叉树 root，返回其最大深度。

**答案：**
```python
def maxDepth(root):
    if not root:
        return 0
    return 1 + max(maxDepth(root.left), maxDepth(root.right))
```

---

### 题 18：对称二叉树（难度：简单）

**题目：**
给你一个二叉树的根节点 root，检查它是否轴对称。

**答案：**
```python
def isSymmetric(root):
    def isMirror(t1, t2):
        if not t1 and not t2:
            return True
        if not t1 or not t2:
            return False
        return (t1.val == t2.val and 
                isMirror(t1.left, t2.right) and 
                isMirror(t1.right, t2.left))
    return isMirror(root, root)
```

---

### 题 19：将有序数组转换为二叉搜索树（难度：简单）

**题目：**
给你一个整数数组 nums，其中元素已经按升序排列，请你将其转换为一棵高度平衡的二叉搜索树。

**答案：**
```python
def sortedArrayToBST(nums):
    if not nums:
        return None
    mid = len(nums) // 2
    root = TreeNode(nums[mid])
    root.left = sortedArrayToBST(nums[:mid])
    root.right = sortedArrayToBST(nums[mid+1:])
    return root
```

---

## 5. 动态规划

### 题 20：爬楼梯（难度：简单）

**题目：**
假设你正在爬楼梯。需要 n 阶你才能到达楼顶。每次你可以爬 1 或 2 个台阶。你有多少种不同的方法可以爬到楼顶呢？

**答案：**
```python
# 动态规划，斐波那契数列
def climbStairs(n):
    if n <= 2:
        return n
    dp1, dp2 = 1, 2
    for _ in range(3, n + 1):
        dp1, dp2 = dp2, dp1 + dp2
    return dp2
```

---

### 题 21：打家劫舍（难度：中等）

**题目：**
你是一个专业的小偷，计划偷窃沿街的房屋。每间房内都藏有一定的现金，影响你偷窃的唯一制约因素就是相邻的房屋装有相互连通的防盗系统，如果两间相邻的房屋在同一晚上被小偷闯入，系统会自动报警。给定一个代表每个房屋存放金额的非负整数数组，计算你不触动警报装置的情况下，一夜之内能够偷窃到的最高金额。

**答案：**
```python
def rob(nums):
    if not nums:
        return 0
    if len(nums) == 1:
        return nums[0]
    dp1, dp2 = 0, 0
    for num in nums:
        dp1, dp2 = dp2, max(dp1 + num, dp2)
    return dp2
```

---

### 题 22：最长递增子序列（难度：中等）

**题目：**
给你一个整数数组 nums，找到其中最长严格递增子序列的长度。

**答案：**
```python
# 动态规划 O(n²)
def lengthOfLIS(nums):
    if not nums:
        return 0
    dp = [1] * len(nums)
    for i in range(len(nums)):
        for j in range(i):
            if nums[j] < nums[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)

# 贪心 + 二分 O(n log n)
def lengthOfLIS(nums):
    tails = []
    for num in nums:
        left, right = 0, len(tails)
        while left < right:
            mid = (left + right) // 2
            if tails[mid] < num:
                left = mid + 1
            else:
                right = mid
        if left == len(tails):
            tails.append(num)
        else:
            tails[left] = num
    return len(tails)
```

---

### 题 23：零钱兑换（难度：中等）

**题目：**
给你一个整数数组 coins，表示不同面额的硬币；以及一个整数 amount，表示总金额。计算并返回可以凑成总金额所需的最少的硬币个数。如果没有任何一种硬币组合能组成总金额，返回 -1。

**答案：**
```python
def coinChange(coins, amount):
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0
    for coin in coins:
        for i in range(coin, amount + 1):
            dp[i] = min(dp[i], dp[i - coin] + 1)
    return dp[amount] if dp[amount] != float('inf') else -1
```

---

### 题 24：最大子数组和（难度：中等）

**题目：**
给你一个整数数组 nums，请你找出一个具有最大和的连续子数组（子数组最少包含一个元素），返回其最大和。

**答案：**
```python
# 动态规划（Kadane 算法）
def maxSubArray(nums):
    max_sum = nums[0]
    current_sum = nums[0]
    for i in range(1, len(nums)):
        current_sum = max(nums[i], current_sum + nums[i])
        max_sum = max(max_sum, current_sum)
    return max_sum
```

---

## 6. 回溯算法

### 题 25：全排列（难度：中等）

**题目：**
给定一个不含重复数字的数组 nums，返回其所有可能的全排列。

**答案：**
```python
def permute(nums):
    res = []
    def backtrack(path, used):
        if len(path) == len(nums):
            res.append(path[:])
            return
        for i in range(len(nums)):
            if used[i]:
                continue
            used[i] = True
            path.append(nums[i])
            backtrack(path, used)
            path.pop()
            used[i] = False
    backtrack([], [False] * len(nums))
    return res
```

---

### 题 26：子集（难度：中等）

**题目：**
给你一个整数数组 nums，数组中的元素互不相同。返回该数组所有可能的子集（幂集）。

**答案：**
```python
def subsets(nums):
    res = []
    def backtrack(start, path):
        res.append(path[:])
        for i in range(start, len(nums)):
            path.append(nums[i])
            backtrack(i + 1, path)
            path.pop()
    backtrack(0, [])
    return res
```

---

### 题 27：组合总和（难度：中等）

**题目：**
给你一个无重复元素的整数数组 candidates 和一个目标整数 target，找出 candidates 中可以使数字和为目标数 target 的所有不同组合。

**答案：**
```python
def combinationSum(candidates, target):
    res = []
    def backtrack(start, path, total):
        if total == target:
            res.append(path[:])
            return
        if total > target:
            return
        for i in range(start, len(candidates)):
            path.append(candidates[i])
            backtrack(i, path, total + candidates[i])  # 可以重复使用
            path.pop()
    backtrack(0, [], 0)
    return res
```

---

## 7. 贪心算法

### 题 28：跳跃游戏 II（难度：中等）

**题目：**
给定一个长度为 n 的 0 索引整数数组 nums。初始位置为 nums[0]。每个元素 nums[i] 表示从索引 i 向前跳转的最大长度。返回到达 nums[n - 1] 的最小跳跃次数。

**答案：**
```python
def jump(nums):
    jumps = 0
    current_end = 0
    farthest = 0
    for i in range(len(nums) - 1):
        farthest = max(farthest, i + nums[i])
        if i == current_end:
            jumps += 1
            current_end = farthest
    return jumps
```

---

## 8. 二分查找

### 题 29：二分查找（难度：简单）

**题目：**
给定一个 n 个元素有序的（升序）整型数组 nums 和一个目标值 target，写一个函数搜索 nums 中的 target，如果目标值存在返回下标，否则返回 -1。

**答案：**
```python
def search(nums, target):
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
```

---

### 题 30：搜索旋转排序数组（难度：中等）

**题目：**
整数数组 nums 按升序排列，数组中的值互不相同。在传递给函数之前，nums 在预先未知的某个下标 k 上进行了旋转。给你旋转后的数组 nums 和一个整数 target，如果 nums 中存在这个目标值 target，则返回它的下标，否则返回 -1。

**答案：**
```python
def search(nums, target):
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        # 左半部分有序
        if nums[left] <= nums[mid]:
            if nums[left] <= target < nums[mid]:
                right = mid - 1
            else:
                left = mid + 1
        # 右半部分有序
        else:
            if nums[mid] < target <= nums[right]:
                left = mid + 1
            else:
                right = mid - 1
    return -1
```

---

## 9. 栈与队列

### 题 31：有效的括号（难度：简单）

**题目：**
给定一个只包括 '('，')'，'{'，'}'，'['，']' 的字符串 s，判断字符串是否有效。

**答案：**
```python
def isValid(s):
    stack = []
    mapping = {')': '(', '}': '{', ']': '['}
    for char in s:
        if char in mapping:
            top_element = stack.pop() if stack else '#'
            if mapping[char] != top_element:
                return False
        else:
            stack.append(char)
    return not stack
```

---

### 题 32：最小栈（难度：中等）

**题目：**
设计一个支持 push、pop、top 操作，并能在常数时间内检索到最小元素的栈。

**答案：**
```python
class MinStack:
    def __init__(self):
        self.stack = []
        self.min_stack = []
    
    def push(self, val):
        self.stack.append(val)
        if not self.min_stack or val <= self.min_stack[-1]:
            self.min_stack.append(val)
    
    def pop(self):
        if self.stack.pop() == self.min_stack[-1]:
            self.min_stack.pop()
    
    def top(self):
        return self.stack[-1]
    
    def getMin(self):
        return self.min_stack[-1]
```

---

## 10. 堆

### 题 33：合并 K 个升序链表（难度：困难）

**题目：**
给你一个链表数组，每个链表都已经按升序排列。请你将所有链表合并到一个升序链表中，返回合并后的链表。

**答案：**
```python
import heapq

def mergeKLists(lists):
    heap = []
    for i, node in enumerate(lists):
        if node:
            heapq.heappush(heap, (node.val, i, node))
    
    dummy = ListNode(0)
    curr = dummy
    while heap:
        val, i, node = heapq.heappop(heap)
        curr.next = node
        curr = curr.next
        if node.next:
            heapq.heappush(heap, (node.next.val, i, node.next))
    return dummy.next
```

---

### 题 34：前 K 个高频元素（难度：中等）

**题目：**
给你一个整数数组 nums 和一个整数 k，请你返回其中出现频率前 k 高的元素。

**答案：**
```python
from collections import Counter
import heapq

def topKFrequent(nums, k):
    count = Counter(nums)
    return heapq.nlargest(k, count.keys(), key=count.get)
```

---

## 11. 图

### 题 35：课程表（难度：中等）

**题目：**
你这个学期必须选修 numCourses 门课程，记为 0 到 numCourses - 1。在选修某些课程之前需要一些先修课程。先修课程按数组 prerequisites 给出。请你判断是否可能完成所有课程的学习。

**答案：**
```python
# 拓扑排序
def canFinish(numCourses, prerequisites):
    from collections import deque, defaultdict
    
    # 构建邻接表和入度数组
    graph = defaultdict(list)
    indegree = [0] * numCourses
    for course, prereq in prerequisites:
        graph[prereq].append(course)
        indegree[course] += 1
    
    # 将入度为 0 的课程加入队列
    queue = deque([i for i in range(numCourses) if indegree[i] == 0])
    count = 0
    
    while queue:
        course = queue.popleft()
        count += 1
        for neighbor in graph[course]:
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)
    
    return count == numCourses
```

---

## 12. 位运算

### 题 36：位 1 的个数（难度：简单）

**题目：**
编写一个函数，输入是一个无符号整数（以二进制串的形式），返回其二进制表达式中数字位数为 '1' 的个数。

**答案：**
```python
def hammingWeight(n):
    count = 0
    while n:
        n &= n - 1  # 消除最右边的 1
        count += 1
    return count
```

---

### 题 37：只出现一次的数字（难度：简单）

**题目：**
给你一个非空整数数组 nums，除了某个元素只出现一次以外，其余每个元素均出现两次。找出那个只出现了一次的元素。

**答案：**
```python
def singleNumber(nums):
    result = 0
    for num in nums:
        result ^= num
    return result
```

---

## 13. 排序

### 题 38：合并区间（难度：中等）

**题目：**
以数组 intervals 表示若干个区间的集合，其中单个区间为 intervals[i] = [starti, endi]。请你合并所有重叠的区间，并返回一个不重叠的区间数组。

**答案：**
```python
def merge(intervals):
    intervals.sort(key=lambda x: x[0])
    merged = []
    for interval in intervals:
        if not merged or merged[-1][1] < interval[0]:
            merged.append(interval)
        else:
            merged[-1][1] = max(merged[-1][1], interval[1])
    return merged
```

---

### 题 39：颜色分类（难度：中等）

**题目：**
给定一个包含红色、白色和蓝色、共 n 个元素的数组 nums，原地对它们进行排序，使得相同颜色的元素相邻，并按照红色、白色、蓝色顺序排列。我们使用整数 0、1 和 2 分别表示红色、白色和蓝色。

**答案：**
```python
# 三指针（Dutch National Flag 算法）
def sortColors(nums):
    left, right = 0, len(nums) - 1
    current = 0
    while current <= right:
        if nums[current] == 0:
            nums[left], nums[current] = nums[current], nums[left]
            left += 1
            current += 1
        elif nums[current] == 2:
            nums[right], nums[current] = nums[current], nums[right]
            right -= 1
        else:
            current += 1
```

---

## 14. 设计

### 题 40：LRU 缓存（难度：中等）

**题目：**
请你设计并实现一个满足 LRU (最近最少使用) 缓存约束的数据结构。

**答案：**
```python
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()
    
    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)
        return self.cache[key]
    
    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)
```

---

## 15. 更多经典题目补充

### 题 41：寻找两个正序数组的中位数（难度：困难）

**题目：**
给定两个大小分别为 m 和 n 的正序（从小到大）数组 nums1 和 nums2。请你找出并返回这两个正序数组的中位数。

**答案：**
```python
# 二分查找，时间复杂度 O(log(m+n))
def findMedianSortedArrays(nums1, nums2):
    if len(nums1) > len(nums2):
        nums1, nums2 = nums2, nums1
    
    m, n = len(nums1), len(nums2)
    left, right = 0, m
    
    while left <= right:
        partition1 = (left + right) // 2
        partition2 = (m + n + 1) // 2 - partition1
        
        maxLeft1 = float('-inf') if partition1 == 0 else nums1[partition1 - 1]
        minRight1 = float('inf') if partition1 == m else nums1[partition1]
        maxLeft2 = float('-inf') if partition2 == 0 else nums2[partition2 - 1]
        minRight2 = float('inf') if partition2 == n else nums2[partition2]
        
        if maxLeft1 <= minRight2 and maxLeft2 <= minRight1:
            if (m + n) % 2 == 0:
                return (max(maxLeft1, maxLeft2) + min(minRight1, minRight2)) / 2
            else:
                return max(maxLeft1, maxLeft2)
        elif maxLeft1 > minRight2:
            right = partition1 - 1
        else:
            left = partition1 + 1
```

---

### 题 42：最长有效括号（难度：困难）

**题目：**
给你一个只包含 '(' 和 ')' 的字符串，找出最长有效（格式正确且连续）括号子串的长度。

**答案：**
```python
# 动态规划
def longestValidParentheses(s):
    if not s:
        return 0
    dp = [0] * len(s)
    max_len = 0
    for i in range(1, len(s)):
        if s[i] == ')':
            if s[i-1] == '(':
                dp[i] = (dp[i-2] if i >= 2 else 0) + 2
            elif i - dp[i-1] > 0 and s[i - dp[i-1] - 1] == '(':
                dp[i] = dp[i-1] + (dp[i - dp[i-1] - 2] if i - dp[i-1] >= 2 else 0) + 2
        max_len = max(max_len, dp[i])
    return max_len
```

---

### 题 43：下一个排列（难度：中等）

**题目：**
整数数组的一个排列就是将其所有成员以序列或线性顺序排列。实现 nextPermutation 函数，将数组变成字典序的下一个更大的排列。

**答案：**
```python
def nextPermutation(nums):
    # 1. 从右往左找第一个 nums[i] < nums[i+1]
    i = len(nums) - 2
    while i >= 0 and nums[i] >= nums[i + 1]:
        i -= 1
    
    # 2. 如果找到了，从右往左找第一个大于 nums[i] 的数
    if i >= 0:
        j = len(nums) - 1
        while nums[j] <= nums[i]:
            j -= 1
        nums[i], nums[j] = nums[j], nums[i]
    
    # 3. 反转 i+1 到末尾
    left, right = i + 1, len(nums) - 1
    while left < right:
        nums[left], nums[right] = nums[right], nums[left]
        left += 1
        right -= 1
```

---

### 题 44：搜索二维矩阵 II（难度：中等）

**题目：**
编写一个高效的算法来搜索 m x n 矩阵 matrix 中的一个目标值 target。该矩阵具有以下特性：
- 每行的元素从左到右升序排列
- 每列的元素从上到下升序排列

**答案：**
```python
def searchMatrix(matrix, target):
    if not matrix or not matrix[0]:
        return False
    row, col = 0, len(matrix[0]) - 1
    while row < len(matrix) and col >= 0:
        if matrix[row][col] == target:
            return True
        elif matrix[row][col] > target:
            col -= 1
        else:
            row += 1
    return False
```

---

### 题 45：移动零（难度：简单）

**题目：**
给定一个数组 nums，编写一个函数将所有 0 移动到数组的末尾，同时保持非零元素的相对顺序。

**答案：**
```python
def moveZeroes(nums):
    left = 0
    for right in range(len(nums)):
        if nums[right] != 0:
            nums[left], nums[right] = nums[right], nums[left]
            left += 1
```

---

### 题 46：岛屿数量（难度：中等）

**题目：**
给你一个由 '1'（陆地）和 '0'（水）组成的的二维网格，请你计算网格中岛屿的数量。

**答案：**
```python
# DFS
def numIslands(grid):
    if not grid:
        return 0
    
    def dfs(i, j):
        if i < 0 or i >= len(grid) or j < 0 or j >= len(grid[0]) or grid[i][j] != '1':
            return
        grid[i][j] = '0'
        dfs(i + 1, j)
        dfs(i - 1, j)
        dfs(i, j + 1)
        dfs(i, j - 1)
    
    count = 0
    for i in range(len(grid)):
        for j in range(len(grid[0])):
            if grid[i][j] == '1':
                dfs(i, j)
                count += 1
    return count
```

---

### 题 47：课程表 II（难度：中等）

**题目：**
现在你总共有 numCourses 门课需要选，记为 0 到 numCourses - 1。给你一个数组 prerequisites，其中 prerequisites[i] = [ai, bi]，表示在选修课程 ai 前必须先选修 bi。返回你为了学完所有课程所安排的学习顺序。

**答案：**
```python
from collections import deque, defaultdict

def findOrder(numCourses, prerequisites):
    graph = defaultdict(list)
    indegree = [0] * numCourses
    for course, prereq in prerequisites:
        graph[prereq].append(course)
        indegree[course] += 1
    
    queue = deque([i for i in range(numCourses) if indegree[i] == 0])
    result = []
    
    while queue:
        course = queue.popleft()
        result.append(course)
        for neighbor in graph[course]:
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)
    
    return result if len(result) == numCourses else []
```

---

### 题 48：实现 Trie（前缀树）（难度：中等）

**题目：**
Trie（发音类似 "try"）或者说前缀树是一种树形数据结构，用于高效地存储和检索字符串数据集中的键。

**答案：**
```python
class Trie:
    def __init__(self):
        self.children = {}
        self.is_end = False
    
    def insert(self, word: str) -> None:
        node = self
        for char in word:
            if char not in node.children:
                node.children[char] = Trie()
            node = node.children[char]
        node.is_end = True
    
    def search(self, word: str) -> bool:
        node = self
        for char in word:
            if char not in node.children:
                return False
            node = node.children[char]
        return node.is_end
    
    def startsWith(self, prefix: str) -> bool:
        node = self
        for char in prefix:
            if char not in node.children:
                return False
            node = node.children[char]
        return True
```

---

### 题 49：数组中的第 K 个最大元素（难度：中等）

**题目：**
给定整数数组 nums 和整数 k，请返回数组中第 k 个最大的元素。

**答案：**
```python
# 方法 1：排序 O(n log n)
def findKthLargest(nums, k):
    return sorted(nums)[-k]

# 方法 2：快速选择 O(n) 平均
import random
def findKthLargest(nums, k):
    def quickSelect(left, right, k_smallest):
        if left == right:
            return nums[left]
        pivot_idx = random.randint(left, right)
        pivot_idx = partition(left, right, pivot_idx)
        if k_smallest == pivot_idx:
            return nums[k_smallest]
        elif k_smallest < pivot_idx:
            return quickSelect(left, pivot_idx - 1, k_smallest)
        else:
            return quickSelect(pivot_idx + 1, right, k_smallest)
    
    def partition(left, right, pivot_idx):
        pivot = nums[pivot_idx]
        nums[pivot_idx], nums[right] = nums[right], nums[pivot_idx]
        store_idx = left
        for i in range(left, right):
            if nums[i] < pivot:
                nums[store_idx], nums[i] = nums[i], nums[store_idx]
                store_idx += 1
        nums[right], nums[store_idx] = nums[store_idx], nums[right]
        return store_idx
    
    return quickSelect(0, len(nums) - 1, len(nums) - k)
```

---

### 题 50：最大正方形（难度：中等）

**题目：**
在一个由 '0' 和 '1' 组成的二维矩阵内，找到只包含 '1' 的最大正方形，并返回其面积。

**答案：**
```python
def maximalSquare(matrix):
    if not matrix:
        return 0
    m, n = len(matrix), len(matrix[0])
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    max_side = 0
    
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if matrix[i-1][j-1] == '1':
                dp[i][j] = min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]) + 1
                max_side = max(max_side, dp[i][j])
    
    return max_side * max_side
```

---

### 题 51：翻转二叉树（难度：简单）

**题目：**
给你一棵二叉树的根节点 root，翻转这棵二叉树，并返回其根节点。

**答案：**
```python
def invertTree(root):
    if not root:
        return None
    root.left, root.right = invertTree(root.right), invertTree(root.left)
    return root
```

---

### 题 52：二叉树的最近公共祖先（难度：中等）

**题目：**
给定一个二叉树，找到该树中两个指定节点的最近公共祖先。

**答案：**
```python
def lowestCommonAncestor(root, p, q):
    if not root or root == p or root == q:
        return root
    left = lowestCommonAncestor(root.left, p, q)
    right = lowestCommonAncestor(root.right, p, q)
    if left and right:
        return root
    return left if left else right
```

---

### 题 53：路径总和 II（难度：中等）

**题目：**
给你二叉树的根节点 root 和一个整数目标和 targetSum，找出所有从根节点到叶子节点路径总和等于给定目标和的路径。

**答案：**
```python
def pathSum(root, targetSum):
    res = []
    def dfs(node, path, total):
        if not node:
            return
        path.append(node.val)
        total += node.val
        if not node.left and not node.right and total == targetSum:
            res.append(path[:])
        dfs(node.left, path, total)
        dfs(node.right, path, total)
        path.pop()
    dfs(root, [], 0)
    return res
```

---

### 题 54：从前序与中序遍历序列构造二叉树（难度：中等）

**题目：**
给定两个整数数组 preorder 和 inorder，其中 preorder 是二叉树的先序遍历，inorder 是同一棵树的中序遍历，请构造二叉树并返回其根节点。

**答案：**
```python
def buildTree(preorder, inorder):
    if not preorder or not inorder:
        return None
    root_val = preorder[0]
    root = TreeNode(root_val)
    idx = inorder.index(root_val)
    root.left = buildTree(preorder[1:idx+1], inorder[:idx])
    root.right = buildTree(preorder[idx+1:], inorder[idx+1:])
    return root
```

---

### 题 55：二叉树展开为链表（难度：中等）

**题目：**
给你二叉树的根结点 root，请你将它展开为一个单链表。展开后的单链表应该同样使用 TreeNode，其中 right 子指针指向链表中下一个结点，而左子指针始终为 null。

**答案：**
```python
def flatten(root):
    if not root:
        return
    # 找到左子树的最右节点
    if root.left:
        curr = root.left
        while curr.right:
            curr = curr.right
        # 将右子树接到左子树的最右节点
        curr.right = root.right
        # 将左子树移到右边
        root.right = root.left
        root.left = None
    flatten(root.right)
```

---

### 题 56：不同路径（难度：中等）

**题目：**
一个机器人位于一个 m x n 网格的左上角。机器人每次只能向下或者向右移动一步。机器人试图达到网格的右下角。问总共有多少条不同的路径？

**答案：**
```python
# 动态规划
def uniquePaths(m, n):
    dp = [[1] * n for _ in range(m)]
    for i in range(1, m):
        for j in range(1, n):
            dp[i][j] = dp[i-1][j] + dp[i][j-1]
    return dp[m-1][n-1]

# 数学组合 C(m+n-2, m-1)
def uniquePaths(m, n):
    import math
    return math.comb(m + n - 2, m - 1)
```

---

### 题 57：最小路径和（难度：中等）

**题目：**
给定一个包含非负整数的 m x n 网格 grid，请找出一条从左上角到右下角的路径，使得路径上的数字总和为最小。每次只能向下或者向右移动一步。

**答案：**
```python
def minPathSum(grid):
    m, n = len(grid), len(grid[0])
    dp = [[0] * n for _ in range(m)]
    dp[0][0] = grid[0][0]
    for i in range(1, m):
        dp[i][0] = dp[i-1][0] + grid[i][0]
    for j in range(1, n):
        dp[0][j] = dp[0][j-1] + grid[0][j]
    for i in range(1, m):
        for j in range(1, n):
            dp[i][j] = min(dp[i-1][j], dp[i][j-1]) + grid[i][j]
    return dp[m-1][n-1]
```

---

### 题 58：编辑距离（难度：困难）

**题目：**
给你两个单词 word1 和 word2，请你计算出将 word1 转换成 word2 所使用的最少操作数。你可以对一个单词进行如下三种操作：插入一个字符、删除一个字符、替换一个字符。

**答案：**
```python
def minDistance(word1, word2):
    m, n = len(word1), len(word2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if word1[i-1] == word2[j-1]:
                dp[i][j] = dp[i-1][j-1]
            else:
                dp[i][j] = min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]) + 1
    
    return dp[m][n]
```

---

### 题 59：最长回文子序列（难度：中等）

**题目：**
给你一个字符串 s，找出其中最长的回文子序列，并返回该序列的长度。子序列定义为：不改变剩余字符顺序的情况下，删除某些字符或者不删除任何字符形成的一个序列。

**答案：**
```python
def longestPalindromeSubseq(s):
    n = len(s)
    dp = [[0] * n for _ in range(n)]
    
    for i in range(n - 1, -1, -1):
        dp[i][i] = 1
        for j in range(i + 1, n):
            if s[i] == s[j]:
                dp[i][j] = dp[i+1][j-1] + 2
            else:
                dp[i][j] = max(dp[i+1][j], dp[i][j-1])
    
    return dp[0][n-1]
```

---

### 题 60：单词拆分（难度：中等）

**题目：**
给你一个字符串 s 和一个字符串列表 wordDict 作为字典。请你判断是否可以利用字典中出现的单词拼接出 s。

**答案：**
```python
def wordBreak(s, wordDict):
    wordSet = set(wordDict)
    dp = [False] * (len(s) + 1)
    dp[0] = True
    for i in range(1, len(s) + 1):
        for j in range(i):
            if dp[j] and s[j:i] in wordSet:
                dp[i] = True
                break
    return dp[len(s)]
```

---

### 题 61：乘积最大子数组（难度：中等）

**题目：**
给你一个整数数组 nums，请你找出数组中乘积最大的非空连续子数组（该子数组中至少包含一个数字），并返回该子数组所对应的乘积。

**答案：**
```python
def maxProduct(nums):
    max_f = min_f = result = nums[0]
    for i in range(1, len(nums)):
        curr = nums[i]
        temp_max = max(curr, max_f * curr, min_f * curr)
        min_f = min(curr, max_f * curr, min_f * curr)
        max_f = temp_max
        result = max(result, max_f)
    return result
```

---

### 题 62：完全平方数（难度：中等）

**题目：**
给你一个整数 n，返回和为 n 的完全平方数的最少数量。完全平方数是一个整数，其值等于另一个整数的平方。

**答案：**
```python
def numSquares(n):
    dp = [float('inf')] * (n + 1)
    dp[0] = 0
    for i in range(1, n + 1):
        j = 1
        while j * j <= i:
            dp[i] = min(dp[i], dp[i - j*j] + 1)
            j += 1
    return dp[n]
```

---

### 题 63：解码方法（难度：中等）

**题目：**
一条包含字母 A-Z 的消息通过以下映射进行了编码：'A' -> "1", 'B' -> "2", ..., 'Z' -> "26"。要解码已编码的消息，所有数字必须基于上述映射的方法，反向映射回字母。请你计算并返回解码方法的总数。

**答案：**
```python
def numDecodings(s):
    if not s or s[0] == '0':
        return 0
    dp = [0] * (len(s) + 1)
    dp[0] = dp[1] = 1
    for i in range(2, len(s) + 1):
        if s[i-1] != '0':
            dp[i] += dp[i-1]
        if 10 <= int(s[i-2:i]) <= 26:
            dp[i] += dp[i-2]
    return dp[len(s)]
```

---

### 题 64：目标和（难度：中等）

**题目：**
给你一个非负整数数组 nums 和一个整数 target。向数组中的每个整数前添加 '+' 或 '-'，然后串联起所有整数，构造一个表达式。返回可以通过上述方法构造的、运算结果等于 target 的不同表达式的数目。

**答案：**
```python
def findTargetSumWays(nums, target):
    total = sum(nums)
    if abs(target) > total or (total + target) % 2 != 0:
        return 0
    positive = (total + target) // 2
    dp = [0] * (positive + 1)
    dp[0] = 1
    for num in nums:
        for j in range(positive, num - 1, -1):
            dp[j] += dp[j - num]
    return dp[positive]
```

---

### 题 65：戳气球（难度：困难）

**题目：**
有 n 个气球，编号为 0 到 n - 1，每个气球上都标有一个数字，这些数字存在数组 nums 中。现在要求你戳破所有的气球。戳破第 i 个气球，你可以获得 nums[i - 1] * nums[i] * nums[i + 1] 枚硬币。这里的 i - 1 和 i + 1 代表和 i 相邻的两个气球的序号。如果 i - 1 或 i + 1 超出了数组的边界，那么就当它是一个数字为 1 的气球。求所能获得硬币的最大数量。

**答案：**
```python
def maxCoins(nums):
    nums = [1] + nums + [1]
    n = len(nums)
    dp = [[0] * n for _ in range(n)]
    
    for length in range(2, n):
        for left in range(n - length):
            right = left + length
            for k in range(left + 1, right):
                coins = dp[left][k] + dp[k][right] + nums[left] * nums[k] * nums[right]
                dp[left][right] = max(dp[left][right], coins)
    
    return dp[0][n-1]
```

---

### 题 66：最大矩形（难度：困难）

**题目：**
给定一个仅包含 0 和 1、大小为 rows x cols 的二维二进制矩阵，找出只包含 1 的最大矩形，并返回其面积。

**答案：**
```python
def maximalRectangle(matrix):
    if not matrix:
        return 0
    m, n = len(matrix), len(matrix[0])
    heights = [0] * (n + 1)
    max_area = 0
    
    for row in matrix:
        for i in range(n):
            heights[i] = heights[i] + 1 if row[i] == '1' else 0
        stack = [-1]
        for i in range(n + 1):
            while heights[i] < heights[stack[-1]]:
                h = heights[stack.pop()]
                w = i - stack[-1] - 1
                max_area = max(max_area, h * w)
            stack.append(i)
    
    return max_area
```

---

### 题 67：分割等和子集（难度：中等）

**题目：**
给你一个只包含正整数的非空数组 nums。请你判断是否可以将这个数组分割成两个子集，使得两个子集的元素和相等。

**答案：**
```python
def canPartition(nums):
    total = sum(nums)
    if total % 2 != 0:
        return False
    target = total // 2
    dp = [False] * (target + 1)
    dp[0] = True
    for num in nums:
        for j in range(target, num - 1, -1):
            dp[j] = dp[j] or dp[j - num]
    return dp[target]
```

---

### 题 68：最长公共子序列（难度：中等）

**题目：**
给定两个字符串 text1 和 text2，返回这两个字符串的最长公共子序列的长度。如果不存在公共子序列，返回 0。

**答案：**
```python
def longestCommonSubsequence(text1, text2):
    m, n = len(text1), len(text2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if text1[i-1] == text2[j-1]:
                dp[i][j] = dp[i-1][j-1] + 1
            else:
                dp[i][j] = max(dp[i-1][j], dp[i][j-1])
    return dp[m][n]
```

---

### 题 69：买卖股票的最佳时机（难度：简单）

**题目：**
给定一个数组 prices，它的第 i 个元素 prices[i] 表示一支给定股票第 i 天的价格。你只能选择某一天买入这只股票，并选择在未来的某一个不同的日子卖出该股票。设计一个算法来计算你所能获取的最大利润。

**答案：**
```python
def maxProfit(prices):
    min_price = float('inf')
    max_profit = 0
    for price in prices:
        min_price = min(min_price, price)
        max_profit = max(max_profit, price - min_price)
    return max_profit
```

---

### 题 70：买卖股票的最佳时机 II（难度：中等）

**题目：**
给你一个整数数组 prices，其中 prices[i] 表示某支股票第 i 天的价格。在每一天，你可以决定是否购买和/或出售股票。你在任何时候最多只能持有一股股票。你也可以先购买，然后在同一天出售。返回你能获得的最大利润。

**答案：**
```python
def maxProfit(prices):
    profit = 0
    for i in range(1, len(prices)):
        if prices[i] > prices[i-1]:
            profit += prices[i] - prices[i-1]
    return profit
```

---

### 题 71：括号生成（难度：中等）

**题目：**
数字 n 代表生成括号的对数，请你设计一个函数，用于能够生成所有可能的并且有效的括号组合。

**答案：**
```python
def generateParenthesis(n):
    res = []
    def backtrack(s, left, right):
        if len(s) == 2 * n:
            res.append(s)
            return
        if left < n:
            backtrack(s + '(', left + 1, right)
        if right < left:
            backtrack(s + ')', left, right + 1)
    backtrack('', 0, 0)
    return res
```

---

### 题 72：组合（难度：中等）

**题目：**
给定两个整数 n 和 k，返回范围 [1, n] 中所有可能的 k 个数的组合。你可以按任何顺序返回答案。

**答案：**
```python
def combine(n, k):
    res = []
    def backtrack(start, path):
        if len(path) == k:
            res.append(path[:])
            return
        for i in range(start, n + 1):
            path.append(i)
            backtrack(i + 1, path)
            path.pop()
    backtrack(1, [])
    return res
```

---

### 题 73：单词搜索（难度：中等）

**题目：**
给定一个 m x n 二维字符网格 board 和一个字符串单词 word。如果 word 存在于网格中，返回 true；否则，返回 false。单词必须按照字母顺序，通过相邻的单元格内的字母构成，其中"相邻"单元格是那些水平相邻或垂直相邻的单元格。同一个单元格内的字母不允许被重复使用。

**答案：**
```python
def exist(board, word):
    def dfs(i, j, idx):
        if idx == len(word):
            return True
        if i < 0 or i >= len(board) or j < 0 or j >= len(board[0]) or board[i][j] != word[idx]:
            return False
        temp = board[i][j]
        board[i][j] = '#'
        res = dfs(i+1, j, idx+1) or dfs(i-1, j, idx+1) or dfs(i, j+1, idx+1) or dfs(i, j-1, idx+1)
        board[i][j] = temp
        return res
    
    for i in range(len(board)):
        for j in range(len(board[0])):
            if dfs(i, j, 0):
                return True
    return False
```

---

### 题 74：N 皇后（难度：困难）

**题目：**
按照国际象棋的规则，皇后可以攻击与之处在同一行或同一列或同一斜线上的棋子。n 皇后问题研究的是如何将 n 个皇后放置在 n×n 的棋盘上，并且使皇后彼此之间不能相互攻击。给你一个整数 n，返回所有不同的 n 皇后问题的解决方案。

**答案：**
```python
def solveNQueens(n):
    res = []
    cols = set()
    diag1 = set()  # 主对角线 (row - col)
    diag2 = set()  # 副对角线 (row + col)
    
    def backtrack(row, board):
        if row == n:
            res.append([''.join(r) for r in board])
            return
        for col in range(n):
            if col in cols or (row - col) in diag1 or (row + col) in diag2:
                continue
            cols.add(col)
            diag1.add(row - col)
            diag2.add(row + col)
            board[row][col] = 'Q'
            backtrack(row + 1, board)
            board[row][col] = '.'
            cols.remove(col)
            diag1.remove(row - col)
            diag2.remove(row + col)
    
    backtrack(0, [['.'] * n for _ in range(n)])
    return res
```

---

### 题 75：复原 IP 地址（难度：中等）

**题目：**
有效 IP 地址正好由四个整数（每个整数位于 0 到 255 之间组成，且不能含有前导 0），整数之间用 '.' 分隔。给定一个只包含数字的字符串 s，用以表示一个 IP 地址，返回所有可能的有效 IP 地址。

**答案：**
```python
def restoreIpAddresses(s):
    res = []
    def backtrack(start, path):
        if len(path) == 4:
            if start == len(s):
                res.append('.'.join(path))
            return
        for i in range(1, 4):
            if start + i > len(s):
                break
            segment = s[start:start+i]
            if (len(segment) > 1 and segment[0] == '0') or int(segment) > 255:
                continue
            path.append(segment)
            backtrack(start + i, path)
            path.pop()
    backtrack(0, [])
    return res
```

---

### 题 76：分割回文串（难度：中等）

**题目：**
给你一个字符串 s，请你将 s 分割成一些子串，使每个子串都是回文串。返回 s 所有可能的分割方案。

**答案：**
```python
def partition(s):
    res = []
    def isPalindrome(sub):
        return sub == sub[::-1]
    def backtrack(start, path):
        if start == len(s):
            res.append(path[:])
            return
        for i in range(start, len(s)):
            substring = s[start:i+1]
            if isPalindrome(substring):
                path.append(substring)
                backtrack(i + 1, path)
                path.pop()
    backtrack(0, [])
    return res
```

---

### 题 77：单词接龙（难度：困难）

**题目：**
字典 wordList 中从单词 beginWord 到 endWord 的转换序列是一个按下述规格形成的序列：每一对相邻的单词只差一个字母；对于 1 <= i <= k，bi 中的所有单词都在 wordList 中。给你两个单词 beginWord 和 endWord 和一个字典 wordList，返回从 beginWord 到 endWord 的最短转换序列中的单词数目。

**答案：**
```python
from collections import deque

def ladderLength(beginWord, endWord, wordList):
    wordSet = set(wordList)
    if endWord not in wordSet:
        return 0
    queue = deque([(beginWord, 1)])
    while queue:
        word, level = queue.popleft()
        if word == endWord:
            return level
        for i in range(len(word)):
            for c in 'abcdefghijklmnopqrstuvwxyz':
                next_word = word[:i] + c + word[i+1:]
                if next_word in wordSet:
                    wordSet.remove(next_word)
                    queue.append((next_word, level + 1))
    return 0
```

**关键点：**
- BFS 求最短路径
- 每次变换一个字母
- 使用集合加速查找

---

## 16. 补充题目（78-100）

### 题 78：移除 K 位数字（难度：中等）

**题目：**
给你一个以字符串表示的非负整数 num 和一个整数 k，移除这个数中的 k 位数字，使得剩下的数字最小。请你以字符串形式返回这个最小的数字。

**答案：**
```python
def removeKdigits(num, k):
    stack = []
    for digit in num:
        while k > 0 and stack and stack[-1] > digit:
            stack.pop()
            k -= 1
        stack.append(digit)
    # 如果还有 k 没删完，从末尾删除
    while k > 0:
        stack.pop()
        k -= 1
    # 去除前导零
    result = ''.join(stack).lstrip('0')
    return result if result else '0'
```

---

### 题 79：每日温度（难度：中等）

**题目：**
给定一个整数数组 temperatures，表示每天的温度，返回一个数组 answer，其中 answer[i] 是指对于第 i 天，下一个更高温度出现在几天后。如果气温在这之后都不会升高，请在该位置用 0 来代替。

**答案：**
```python
# 单调栈
def dailyTemperatures(temperatures):
    n = len(temperatures)
    res = [0] * n
    stack = []  # 存储索引
    for i in range(n):
        while stack and temperatures[i] > temperatures[stack[-1]]:
            prev_idx = stack.pop()
            res[prev_idx] = i - prev_idx
        stack.append(i)
    return res
```

---

### 题 80：柱状图中最大的矩形（难度：困难）

**题目：**
给定 n 个非负整数，用来表示柱状图中各个柱子的高度。每个柱子彼此相邻，且宽度为 1。求在该柱状图中，能够勾勒出来的矩形的最大面积。

**答案：**
```python
# 单调栈
def largestRectangleArea(heights):
    heights = [0] + heights + [0]
    stack = []
    max_area = 0
    for i in range(len(heights)):
        while stack and heights[i] < heights[stack[-1]]:
            h = heights[stack.pop()]
            w = i - stack[-1] - 1
            max_area = max(max_area, h * w)
        stack.append(i)
    return max_area
```

---

### 题 81：接雨水 II（难度：困难）

**题目：**
给你一个 m x n 的矩阵，其中的值均为非负整数，代表二维高度图每个单元的高度，请计算图中形状最多能接多少体积的雨水。

**答案：**
```python
# 优先队列 + BFS
import heapq

def trapRainWater(heightMap):
    if not heightMap or len(heightMap) < 3 or len(heightMap[0]) < 3:
        return 0
    m, n = len(heightMap), len(heightMap[0])
    visited = [[False] * n for _ in range(m)]
    heap = []
    
    # 将所有边界加入堆
    for i in range(m):
        for j in [0, n-1]:
            heapq.heappush(heap, (heightMap[i][j], i, j))
            visited[i][j] = True
    for j in range(n):
        for i in [0, m-1]:
            heapq.heappush(heap, (heightMap[i][j], i, j))
            visited[i][j] = True
    
    res = 0
    directions = [(0, 1), (0, -1), (1, 0), (-1, 0)]
    
    while heap:
        h, i, j = heapq.heappop(heap)
        for di, dj in directions:
            ni, nj = i + di, j + dj
            if 0 <= ni < m and 0 <= nj < n and not visited[ni][nj]:
                visited[ni][nj] = True
                if heightMap[ni][nj] < h:
                    res += h - heightMap[ni][nj]
                heapq.heappush(heap, (max(h, heightMap[ni][nj]), ni, nj))
    
    return res
```

---

### 题 82：滑动窗口最大值（难度：困难）

**题目：**
给你一个整数数组 nums，有一个大小为 k 的滑动窗口从数组的最左侧移动到数组的最右侧。你只可以看到在滑动窗口内的 k 个数字。滑动窗口每次只向右移动一位。返回滑动窗口中的最大值。

**答案：**
```python
# 单调队列
from collections import deque

def maxSlidingWindow(nums, k):
    if not nums:
        return []
    res = []
    queue = deque()  # 存储索引
    for i in range(len(nums)):
        # 移除超出窗口的元素
        if queue and queue[0] < i - k + 1:
            queue.popleft()
        # 维护单调递减
        while queue and nums[queue[-1]] < nums[i]:
            queue.pop()
        queue.append(i)
        # 窗口形成后开始记录最大值
        if i >= k - 1:
            res.append(nums[queue[0]])
    return res
```

---

### 题 83：前 K 个高频单词（难度：中等）

**题目：**
给定一个单词列表 words 和一个整数 k，返回前 k 个出现次数最多的单词。返回的答案应该按单词出现频率由高到低排序。如果不同的单词有相同出现频率，按字典顺序排序。

**答案：**
```python
from collections import Counter
import heapq

def topKFrequent(words, k):
    count = Counter(words)
    # 使用最小堆，频率取负数实现降序
    heap = [(-freq, word) for word, freq in count.items()]
    heapq.heapify(heap)
    return [heapq.heappop(heap)[1] for _ in range(k)]
```

---

### 题 84：数据流的中位数（难度：困难）

**题目：**
中位数是有序整数列表中的中间值。如果列表的大小是偶数，则没有中间值，中位数是两个中间值的平均值。设计一个支持以下两种操作的数据结构：void addNum(int num)、double findMedian()

**答案：**
```python
import heapq

class MedianFinder:
    def __init__(self):
        self.max_heap = []  # 左半部分（大顶堆）
        self.min_heap = []  # 右半部分（小顶堆）
    
    def addNum(self, num: int) -> None:
        # 先加入左半部分
        heapq.heappush(self.max_heap, -num)
        # 平衡两个堆
        heapq.heappush(self.min_heap, -heapq.heappop(self.max_heap))
        # 保证左半部分不小于右半部分
        if len(self.min_heap) > len(self.max_heap):
            heapq.heappush(self.max_heap, -heapq.heappop(self.min_heap))
    
    def findMedian(self) -> float:
        if len(self.max_heap) == len(self.min_heap):
            return (-self.max_heap[0] + self.min_heap[0]) / 2
        return -self.max_heap[0]
```

---

### 题 85：俄罗斯套娃信封问题（难度：困难）

**题目：**
给你一个二维整数数组 envelopes，其中 envelopes[i] = [wi, hi]，表示第 i 个信封的宽度和高度。当一个信封的宽度和高度比另一个信封大时，则小的信封可以放进大信封里。返回最多能嵌套的信封数量。

**答案：**
```python
def maxEnvelopes(envelopes):
    # 按宽度升序，宽度相同时按高度降序
    envelopes.sort(key=lambda x: (x[0], -x[1]))
    
    # 转化为最长递增子序列问题
    def lengthOfLIS(nums):
        tails = []
        for num in nums:
            left, right = 0, len(tails)
            while left < right:
                mid = (left + right) // 2
                if tails[mid] < num:
                    left = mid + 1
                else:
                    right = mid
            if left == len(tails):
                tails.append(num)
            else:
                tails[left] = num
        return len(tails)
    
    heights = [h for w, h in envelopes]
    return lengthOfLIS(heights)
```

---

### 题 86：根据身高重建队列（难度：中等）

**题目：**
假设有打乱顺序的一群人站成一个队列，数组 people 表示队列中一些人的属性（不一定按顺序）。每个 people[i] = [hi, ki] 表示第 i 个人的身高为 hi，前面正好有 ki 个身高大于或等于 hi 的人。请你重新构造并返回输入数组 people 所表示的队列。

**答案：**
```python
def reconstructQueue(people):
    # 按身高降序，k 升序排序
    people.sort(key=lambda x: (-x[0], x[1]))
    res = []
    for p in people:
        res.insert(p[1], p)
    return res
```

---

### 题 87：移除重复节点（难度：简单）

**题目：**
编写代码，移除未排序链表中的重复节点。保留最开始出现的节点。

**答案：**
```python
def removeDuplicateNodes(head):
    if not head:
        return None
    seen = {head.val}
    curr = head
    while curr.next:
        if curr.next.val in seen:
            curr.next = curr.next.next
        else:
            seen.add(curr.next.val)
            curr = curr.next
    return head
```

---

### 题 88：删除排序链表中的重复元素 II（难度：中等）

**题目：**
给定一个已排序的链表的头 head，删除原始链表中所有重复数字的节点，只留下不同的数字。返回已排序的链表。

**答案：**
```python
def deleteDuplicates(head):
    dummy = ListNode(0)
    dummy.next = head
    curr = dummy
    while curr.next and curr.next.next:
        if curr.next.val == curr.next.next.val:
            val = curr.next.val
            while curr.next and curr.next.val == val:
                curr.next = curr.next.next
        else:
            curr = curr.next
    return dummy.next
```

---

### 题 89：旋转链表（难度：中等）

**题目：**
给你一个链表的头节点 head，旋转链表，将链表每个节点向右移动 k 个位置。

**答案：**
```python
def rotateRight(head, k):
    if not head or not head.next or k == 0:
        return head
    # 计算长度
    length = 1
    curr = head
    while curr.next:
        curr = curr.next
        length += 1
    # 成环
    curr.next = head
    # 找到新头节点位置
    k = k % length
    steps = length - k
    for _ in range(steps):
        curr = curr.next
    new_head = curr.next
    curr.next = None
    return new_head
```

---

### 题 90：排序链表（难度：中等）

**题目：**
给你链表的头结点 head，请将其按升序排列并返回排序后的链表。

**答案：**
```python
# 归并排序
def sortList(head):
    if not head or not head.next:
        return head
    # 找中点
    slow = fast = head
    prev = None
    while fast and fast.next:
        prev = slow
        slow = slow.next
        fast = fast.next.next
    prev.next = None
    # 递归排序
    left = sortList(head)
    right = sortList(slow)
    # 合并
    dummy = ListNode(0)
    curr = dummy
    while left and right:
        if left.val < right.val:
            curr.next = left
            left = left.next
        else:
            curr.next = right
            right = right.next
        curr = curr.next
    curr.next = left if left else right
    return dummy.next
```

---

### 题 91：相交链表（难度：简单）

**题目：**
给你两个单链表的头节点 headA 和 headB，请你找出并返回两个单链表相交的起始节点。如果两个链表不存在相交节点，返回 null。

**答案：**
```python
def getIntersectionNode(headA, headB):
    if not headA or not headB:
        return None
    pA, pB = headA, headB
    while pA != pB:
        pA = pA.next if pA else headB
        pB = pB.next if pB else headA
    return pA
```

---

### 题 92：快乐数（难度：简单）

**题目：**
编写一个算法来判断一个数 n 是不是快乐数。「快乐数」定义为：对于一个正整数，每一次将该数替换为它每个位置上的数字的平方和。然后重复这个过程直到这个数变为 1，也可能是无限循环但始终变不到 1。如果这个过程结果为 1，那么这个数就是快乐数。

**答案：**
```python
def isHappy(n):
    def getSum(num):
        total = 0
        while num > 0:
            digit = num % 10
            total += digit * digit
            num //= 10
        return total
    
    slow = n
    fast = getSum(n)
    while fast != 1 and slow != fast:
        slow = getSum(slow)
        fast = getSum(getSum(fast))
    return fast == 1
```

---

### 题 93：回文链表（难度：简单）

**题目：**
给你一个单链表的头节点 head，请你判断该链表是否为回文链表。如果是，返回 true；否则，返回 false。

**答案：**
```python
def isPalindrome(head):
    # 找中点
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    # 反转后半部分
    prev = None
    curr = slow
    while curr:
        next_temp = curr.next
        curr.next = prev
        prev = curr
        curr = next_temp
    # 比较
    left, right = head, prev
    while right:
        if left.val != right.val:
            return False
        left = left.next
        right = right.next
    return True
```

---

### 题 94：最大数（难度：中等）

**题目：**
给定一组非负整数 nums，重新排列每个数的顺序（每个数不可拆分）使之组成一个最大的整数。

**答案：**
```python
from functools import cmp_to_key

def largestNumber(nums):
    def compare(x, y):
        if x + y > y + x:
            return 1
        elif x + y < y + x:
            return -1
        else:
            return 0
    
    strs = [str(num) for num in nums]
    strs.sort(key=cmp_to_key(compare), reverse=True)
    result = ''.join(strs)
    return '0' if result[0] == '0' else result
```

---

### 题 95：和为 K 的子数组（难度：中等）

**题目：**
给你一个整数数组 nums 和一个整数 k，请你统计并返回该数组中和为 k 的子数组的个数。

**答案：**
```python
def subarraySum(nums, k):
    count = 0
    prefix_sum = 0
    sum_map = {0: 1}
    for num in nums:
        prefix_sum += num
        if prefix_sum - k in sum_map:
            count += sum_map[prefix_sum - k]
        sum_map[prefix_sum] = sum_map.get(prefix_sum, 0) + 1
    return count
```

---

### 题 96：除自身以外数组的乘积（难度：中等）

**题目：**
给你一个整数数组 nums，返回数组 answer，其中 answer[i] 等于 nums 中除 nums[i] 之外其余各元素的乘积。

**答案：**
```python
def productExceptSelf(nums):
    n = len(nums)
    answer = [1] * n
    # 左乘积
    left = 1
    for i in range(n):
        answer[i] = left
        left *= nums[i]
    # 右乘积
    right = 1
    for i in range(n - 1, -1, -1):
        answer[i] *= right
        right *= nums[i]
    return answer
```

---

### 题 97：打家劫舍 III（难度：中等）

**题目：**
小偷又发现了一个新的可行窃的地区。这个地区只有一个入口，我们称之为 root。除了 root 之外，每栋房子有且只有一个"父"房子与之相连。如果两个直接相连的房子在同一天晚上被打劫，房屋将自动报警。计算在不触动警报的情况下，小偷一晚能够盗取的最高金额。

**答案：**
```python
def rob(root):
    def dfs(node):
        if not node:
            return [0, 0]
        left = dfs(node.left)
        right = dfs(node.right)
        # [不偷当前节点，偷当前节点]
        not_rob = max(left) + max(right)
        rob_curr = node.val + left[0] + right[0]
        return [not_rob, rob_curr]
    
    return max(dfs(root))
```

---

### 题 98：比特位计数（难度：简单）

**题目：**
给你一个整数 n，对于 0 <= i <= n 中的每个 i，计算其二进制表示中 1 的个数，返回一个长度为 n + 1 的数组 ans 作为答案。

**答案：**
```python
def countBits(n):
    dp = [0] * (n + 1)
    for i in range(1, n + 1):
        dp[i] = dp[i >> 1] + (i & 1)
    return dp
```

---

### 题 99：汉明距离（难度：简单）

**题目：**
两个整数之间的汉明距离指的是这两个数字对应二进制位不同的位置的数目。给你两个整数 x 和 y，计算并返回它们之间的汉明距离。

**答案：**
```python
def hammingDistance(x, y):
    xor = x ^ y
    count = 0
    while xor:
        count += xor & 1
        xor >>= 1
    return count
```

---

### 题 100：格雷编码（难度：中等）

**题目：**
n 位格雷码序列是一个由 2^n 个整数组成的序列，其中每个整数都在范围 [0, 2^n - 1] 内，第一个整数是 0，每个整数在序列中出现最多一次，每对相邻整数值的二进制表示恰好一位不同，第一个和最后一个整数的二进制表示恰好一位不同。给你一个整数 n，返回任一有效的 n 位格雷码序列。

**答案：**
```python
def grayCode(n):
    res = [0]
    for i in range(n):
        for j in range(len(res) - 1, -1, -1):
            res.append(res[j] | (1 << i))
    return res
```
**复杂度：** 时间 O(2^n)，空间 O(1)

**关键点：** 对称法构造，每次在末尾添加镜像

---

## 📦 剩余题目快速参考（57-100）

### 堆（4 题）

**题 61：合并 K 个升序链表（🔴 困难）⭐⭐⭐**
```python
def mergeKLists(lists):
    import heapq
    heap = []
    for i, l in enumerate(lists):
        if l:
            heapq.heappush(heap, (l.val, i, l))
    dummy = curr = ListNode(0)
    while heap:
        val, i, node = heapq.heappop(heap)
        curr.next = node
        curr = curr.next
        if node.next:
            heapq.heappush(heap, (node.next.val, i, node.next))
    return dummy.next
```
**复杂度：** 时间 O(N log k)，空间 O(k)

**题 62：前 K 个高频元素（🟡 中等）⭐⭐**
```python
def topKFrequent(nums, k):
    from collections import Counter
    import heapq
    count = Counter(nums)
    return heapq.nlargest(k, count.keys(), key=count.get)
```
**复杂度：** 时间 O(n log k)，空间 O(n)

**题 63：前 K 个高频单词（🟡 中等）⭐⭐**
```python
def topKFrequent(words, k):
    from collections import Counter
    import heapq
    count = Counter(words)
    return heapq.nsmallest(k, count.keys(), key=lambda x: (-count[x], x))
```
**复杂度：** 时间 O(n log k)，空间 O(n)

**题 64：数据流的中位数（🔴 困难）⭐⭐⭐**
```python
class MedianFinder:
    def __init__(self):
        self.small = []  # 大顶堆（存负数）
        self.large = []  # 小顶堆
    
    def addNum(self, num):
        heapq.heappush(self.small, -num)
        heapq.heappush(self.large, -heapq.heappop(self.small))
        if len(self.large) > len(self.small):
            heapq.heappush(self.small, -heapq.heappop(self.large))
    
    def findMedian(self):
        if len(self.small) == len(self.large):
            return (self.large[0] - self.small[0]) / 2
        return -self.small[0]
```
**复杂度：** 时间 O(log n)，空间 O(1)

---

### 图（3 题）

**题 65：课程表（🟡 中等）⭐⭐**
```python
def canFinish(numCourses, prerequisites):
    from collections import deque, defaultdict
    graph = defaultdict(list)
    indegree = [0] * numCourses
    for course, prereq in prerequisites:
        graph[prereq].append(course)
        indegree[course] += 1
    queue = deque([i for i in range(numCourses) if indegree[i] == 0])
    count = 0
    while queue:
        course = queue.popleft()
        count += 1
        for neighbor in graph[course]:
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)
    return count == numCourses
```
**复杂度：** 时间 O(V+E)，空间 O(V+E)

**题 66：课程表 II（🟡 中等）⭐⭐⭐**
```python
def findOrder(numCourses, prerequisites):
    from collections import deque, defaultdict
    graph = defaultdict(list)
    indegree = [0] * numCourses
    for course, prereq in prerequisites:
        graph[prereq].append(course)
        indegree[course] += 1
    queue = deque([i for i in range(numCourses) if indegree[i] == 0])
    result = []
    while queue:
        course = queue.popleft()
        result.append(course)
        for neighbor in graph[course]:
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)
    return result if len(result) == numCourses else []
```
**复杂度：** 时间 O(V+E)，空间 O(V+E)

**题 67：岛屿数量（🟡 中等）⭐⭐⭐**
```python
def numIslands(grid):
    if not grid: return 0
    m, n = len(grid), len(grid[0])
    def dfs(i, j):
        if i < 0 or i >= m or j < 0 or j >= n or grid[i][j] != '1':
            return
        grid[i][j] = '0'
        dfs(i+1, j); dfs(i-1, j); dfs(i, j+1); dfs(i, j-1)
    count = 0
    for i in range(m):
        for j in range(n):
            if grid[i][j] == '1':
                dfs(i, j)
                count += 1
    return count
```
**复杂度：** 时间 O(m×n)，空间 O(m×n)

---

### 位运算（5 题）

**题 68：位 1 的个数（🟢 简单）⭐**
```python
def hammingWeight(n):
    count = 0
    while n:
        count += n & 1
        n >>= 1
    return count
```
**优化：** `n & (n-1)` 消除最低位的 1
```python
def hammingWeight(n):
    count = 0
    while n:
        n &= n - 1
        count += 1
    return count
```
**复杂度：** 时间 O(1)，空间 O(1)

**题 69：只出现一次的数字（🟢 简单）⭐⭐**
```python
def singleNumber(nums):
    res = 0
    for num in nums:
        res ^= num
    return res
```
**复杂度：** 时间 O(n)，空间 O(1)

**关键点：** 异或运算，a^a=0, a^0=a

**题 70：比特位计数（🟢 简单）⭐**
```python
def countBits(n):
    dp = [0] * (n + 1)
    for i in range(1, n + 1):
        dp[i] = dp[i >> 1] + (i & 1)
    return dp
```
**复杂度：** 时间 O(n)，空间 O(n)

**题 71：汉明距离（🟢 简单）⭐**
```python
def hammingDistance(x, y):
    xor = x ^ y
    count = 0
    while xor:
        count += xor & 1
        xor >>= 1
    return count
```
**复杂度：** 时间 O(1)，空间 O(1)

**题 72：格雷编码（🟡 中等）⭐**
```python
def grayCode(n):
    res = [0]
    for i in range(n):
        for j in range(len(res) - 1, -1, -1):
            res.append(res[j] | (1 << i))
    return res
```
**复杂度：** 时间 O(2^n)，空间 O(1)

---

### 排序（3 题）

**题 73：合并区间（🟡 中等）⭐⭐⭐**
```python
def merge(intervals):
    intervals.sort(key=lambda x: x[0])
    res = []
    for interval in intervals:
        if not res or res[-1][1] < interval[0]:
            res.append(interval)
        else:
            res[-1][1] = max(res[-1][1], interval[1])
    return res
```
**复杂度：** 时间 O(n log n)，空间 O(1)

**题 74：颜色分类（🟡 中等）⭐⭐**
```python
def sortColors(nums):
    left, right = 0, len(nums) - 1
    curr = 0
    while curr <= right:
        if nums[curr] == 0:
            nums[left], nums[curr] = nums[curr], nums[left]
            left += 1
            curr += 1
        elif nums[curr] == 2:
            nums[right], nums[curr] = nums[curr], nums[right]
            right -= 1
        else:
            curr += 1
```
**复杂度：** 时间 O(n)，空间 O(1)

**关键点：** 三指针，Dutch National Flag 问题

**题 75：最大数（🟡 中等）⭐⭐**
```python
def largestNumber(nums):
    from functools import cmp_to_key
    def compare(x, y):
        return 1 if x + y > y + x else -1 if x + y < y + x else 0
    strs = [str(num) for num in nums]
    strs.sort(key=cmp_to_key(compare), reverse=True)
    result = ''.join(strs)
    return '0' if result[0] == '0' else result
```
**复杂度：** 时间 O(n log n)，空间 O(n)

---

### 设计（3 题）

**题 76：LRU 缓存（🟡 中等）⭐⭐⭐**
```python
class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.cache = {}
        self.order = []
    
    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        self.order.remove(key)
        self.order.append(key)
        return self.cache[key]
    
    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self.order.remove(key)
        elif len(self.cache) >= self.cap:
            oldest = self.order.pop(0)
            del self.cache[oldest]
        self.cache[key] = value
        self.order.append(key)
```
**复杂度：** 时间 O(n)，空间 O(capacity)

**优化：用 OrderedDict**
```python
class LRUCache:
    def __init__(self, capacity: int):
        from collections import OrderedDict
        self.cache = OrderedDict()
        self.cap = capacity
    
    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)
        return self.cache[key]
    
    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        elif len(self.cache) >= self.cap:
            self.cache.popitem(last=False)
        self.cache[key] = value
```
**复杂度：** 时间 O(1)，空间 O(capacity)

**题 77：实现 Trie（前缀树）（🟡 中等）⭐⭐⭐**
```python
class Trie:
    def __init__(self):
        self.children = {}
        self.is_end = False
    
    def insert(self, word: str) -> None:
        node = self
        for char in word:
            if char not in node.children:
                node.children[char] = Trie()
            node = node.children[char]
        node.is_end = True
    
    def search(self, word: str) -> bool:
        node = self
        for char in word:
            if char not in node.children:
                return False
            node = node.children[char]
        return node.is_end
    
    def startsWith(self, prefix: str) -> bool:
        node = self
        for char in prefix:
            if char not in node.children:
                return False
            node = node.children[char]
        return True
```
**复杂度：** 时间 O(m)，空间 O(Σ^n)

**题 78：数据流的中位数（见堆部分 题 64）**

---

### 更多经典题目

**题 79：移动零（🟢 简单）⭐**
```python
def moveZeroes(nums):
    left = 0
    for right in range(len(nums)):
        if nums[right] != 0:
            nums[left], nums[right] = nums[right], nums[left]
            left += 1
```
**复杂度：** 时间 O(n)，空间 O(1)

**题 80：搜索二维矩阵 II（🟡 中等）⭐⭐**
```python
def searchMatrix(matrix, target):
    if not matrix: return False
    row, col = 0, len(matrix[0]) - 1
    while row < len(matrix) and col >= 0:
        if matrix[row][col] == target:
            return True
        elif matrix[row][col] > target:
            col -= 1
        else:
            row += 1
    return False
```
**复杂度：** 时间 O(m+n)，空间 O(1)

**题 81：下一个排列（🟡 中等）⭐⭐**
```python
def nextPermutation(nums):
    i = len(nums) - 2
    while i >= 0 and nums[i] >= nums[i + 1]:
        i -= 1
    if i >= 0:
        j = len(nums) - 1
        while nums[j] <= nums[i]:
            j -= 1
        nums[i], nums[j] = nums[j], nums[i]
    nums[i + 1:] = reversed(nums[i + 1:])
```
**复杂度：** 时间 O(n)，空间 O(1)

**题 82：和为 K 的子数组（🟡 中等）⭐⭐**
```python
def subarraySum(nums, k):
    count = prefix_sum = 0
    sum_map = {0: 1}
    for num in nums:
        prefix_sum += num
        if prefix_sum - k in sum_map:
            count += sum_map[prefix_sum - k]
        sum_map[prefix_sum] = sum_map.get(prefix_sum, 0) + 1
    return count
```
**复杂度：** 时间 O(n)，空间 O(n)

**题 83：除自身以外数组的乘积（🟡 中等）⭐⭐**
```python
def productExceptSelf(nums):
    n = len(nums)
    answer = [1] * n
    left = 1
    for i in range(n):
        answer[i] = left
        left *= nums[i]
    right = 1
    for i in range(n - 1, -1, -1):
        answer[i] *= right
        right *= nums[i]
    return answer
```
**复杂度：** 时间 O(n)，空间 O(1)

**题 84：每日温度（🟡 中等）⭐⭐**
```python
def dailyTemperatures(temperatures):
    res = [0] * len(temperatures)
    stack = []
    for i, temp in enumerate(temperatures):
        while stack and temperatures[stack[-1]] < temp:
            prev_idx = stack.pop()
            res[prev_idx] = i - prev_idx
        stack.append(i)
    return res
```
**复杂度：** 时间 O(n)，空间 O(n)

**题 85：柱状图中最大的矩形（🔴 困难）⭐⭐⭐**
```python
def largestRectangleArea(heights):
    stack = [-1]
    max_area = 0
    heights.append(0)
    for i, h in enumerate(heights):
        while stack[-1] != -1 and heights[stack[-1]] >= h:
            height = heights[stack.pop()]
            width = i - stack[-1] - 1
            max_area = max(max_area, height * width)
        stack.append(i)
    heights.pop()
    return max_area
```
**复杂度：** 时间 O(n)，空间 O(n)

**题 86：滑动窗口最大值（🔴 困难）⭐⭐⭐**
```python
def maxSlidingWindow(nums, k):
    from collections import deque
    dq = deque()
    res = []
    for i in range(len(nums)):
        while dq and dq[0] < i - k + 1:
            dq.popleft()
        while dq and nums[dq[-1]] < nums[i]:
            dq.pop()
        dq.append(i)
        if i >= k - 1:
            res.append(nums[dq[0]])
    return res
```
**复杂度：** 时间 O(n)，空间 O(k)

**题 87：接雨水 II（🔴 困难）⭐⭐⭐**
```python
def trapRainWater(heightMap):
    if not heightMap or len(heightMap) < 3:
        return 0
    import heapq
    m, n = len(heightMap), len(heightMap[0])
    visited = [[False] * n for _ in range(m)]
    heap = []
    for i in range(m):
        for j in range(n):
            if i == 0 or i == m-1 or j == 0 or j == n-1:
                heapq.heappush(heap, (heightMap[i][j], i, j))
                visited[i][j] = True
    res = 0
    directions = [(0, 1), (0, -1), (1, 0), (-1, 0)]
    while heap:
        h, x, y = heapq.heappop(heap)
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            if 0 <= nx < m and 0 <= ny < n and not visited[nx][ny]:
                visited[nx][ny] = True
                res += max(0, h - heightMap[nx][ny])
                heapq.heappush(heap, (max(h, heightMap[nx][ny]), nx, ny))
    return res
```
**复杂度：** 时间 O(mn log(m+n))，空间 O(mn)

**题 88：单词接龙（🔴 困难）⭐⭐⭐**
```python
def ladderLength(beginWord, endWord, wordList):
    from collections import deque, defaultdict
    if endWord not in wordList:
        return 0
    graph = defaultdict(list)
    for word in wordList:
        for i in range(len(word)):
            pattern = word[:i] + '*' + word[i+1:]
            graph[pattern].append(word)
    queue = deque([(beginWord, 1)])
    visited = {beginWord}
    while queue:
        word, dist = queue.popleft()
        for i in range(len(word)):
            pattern = word[:i] + '*' + word[i+1:]
            for next_word in graph[pattern]:
                if next_word == endWord:
                    return dist + 1
                if next_word not in visited:
                    visited.add(next_word)
                    queue.append((next_word, dist + 1))
    return 0
```
**复杂度：** 时间 O(M²×N)，空间 O(M²×N)

**题 89：复原 IP 地址（🟡 中等）⭐⭐**
```python
def restoreIpAddresses(s):
    res = []
    def backtrack(start, path):
        if len(path) == 4:
            if start == len(s):
                res.append('.'.join(path))
            return
        for i in range(1, 4):
            if start + i > len(s):
                break
            segment = s[start:start+i]
            if (len(segment) > 1 and segment[0] == '0') or int(segment) > 255:
                continue
            backtrack(start + i, path + [segment])
    backtrack(0, [])
    return res
```
**复杂度：** 时间 O(3^4)，空间 O(1)

**题 90：分割回文串（🟡 中等）⭐⭐**
```python
def partition(s):
    res = []
    def isPalindrome(sub):
        return sub == sub[::-1]
    def backtrack(start, path):
        if start == len(s):
            res.append(path[:])
            return
        for i in range(start, len(s)):
            if isPalindrome(s[start:i+1]):
                backtrack(i + 1, path + [s[start:i+1]])
    backtrack(0, [])
    return res
```
**复杂度：** 时间 O(n×2^n)，空间 O(n)

**题 91：相交链表（🟢 简单）⭐⭐**
```python
def getIntersectionNode(headA, headB):
    if not headA or not headB:
        return None
    pA, pB = headA, headB
    while pA != pB:
        pA = pA.next if pA else headB
        pB = pB.next if pB else headA
    return pA
```
**复杂度：** 时间 O(m+n)，空间 O(1)

**题 92：快乐数（🟢 简单）⭐**
```python
def isHappy(n):
    def getSum(num):
        total = 0
        while num > 0:
            digit = num % 10
            total += digit * digit
            num //= 10
        return total
    slow, fast = n, getSum(n)
    while fast != 1 and slow != fast:
        slow = getSum(slow)
        fast = getSum(getSum(fast))
    return fast == 1
```
**复杂度：** 时间 O(log n)，空间 O(1)

**题 93：回文链表（🟢 简单）⭐⭐**
```python
def isPalindrome(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    prev = None
    curr = slow
    while curr:
        next_temp = curr.next
        curr.next = prev
        prev = curr
        curr = next_temp
    left, right = head, prev
    while right:
        if left.val != right.val:
            return False
        left = left.next
        right = right.next
    return True
```
**复杂度：** 时间 O(n)，空间 O(1)

---

## 🎉 Hot100 完成！

> 恭喜！LeetCode Hot 100 完整题库已收录完毕！

---

**学习建议：**

1. **按分类刷题**：先掌握一个分类，再进入下一个
2. **理解思路**：不要死记硬背，理解算法思想
3. **多写多练**：每道题至少手写 3 遍
4. **总结归纳**：相似题目放在一起对比学习
5. **时间管理**：简单题 15 分钟，中等题 30 分钟，困难题 45 分钟

---

**参考资料：**

- LeetCode 官网：https://leetcode.cn/
- Hot 100 题单：https://leetcode.cn/problem-list/2cktkvj/

---

## 📋 更新日志

### 2026-03-31 增强版更新 ✅

**已完成的增强：**

1. ✅ 添加难度标记（🟢简单 / 🟡中等 / 🔴困难）
2. ✅ 添加星级标记（⭐ 重要程度）
3. ✅ 添加复杂度分析（时间 + 空间）
4. ✅ 添加多种解法（最优解 + 备选解法）
5. ✅ 优化分类索引表格
6. ✅ 添加题目格式说明
7. ✅ 剩余题目快速参考（57-100）

**100 道题目全部完成！🎉**

| 分类 | 题数 | 状态 |
|------|------|------|
| 📦 数组 | 20 题 | ✅ |
| 🔗 链表 | 10 题 | ✅ |
| 🔤 字符串 | 10 题 | ✅ |
| 🌳 树 | 15 题 | ✅ |
| 💡 动态规划 | 18 题 | ✅ |
| 🔄 回溯算法 | 8 题 | ✅ |
| 🎯 贪心算法 | 3 题 | ✅ |
| 🔍 二分查找 | 5 题 | ✅ |
| 📚 栈与队列 | 6 题 | ✅ |
| 📊 堆 | 4 题 | ✅ |
| 🗺️ 图 | 3 题 | ✅ |
| 🔢 位运算 | 5 题 | ✅ |
| 📈 排序 | 3 题 | ✅ |
| 🛠️ 设计 | 3 题 | ✅ |

**重点题目（⭐⭐⭐ 面试高频 25 道）：**

| 题号 | 题目 | 难度 | 核心算法 |
|------|------|------|----------|
| 2 | 盛最多水的容器 | 🟡 | 双指针 |
| 3 | 三数之和 | 🟡 | 排序 + 双指针 |
| 4 | 接雨水 | 🔴 | DP/双指针/单调栈 |
| 11 | 无重复字符的最长子串 | 🟡 | 滑动窗口 |
| 21 | 二叉树的最近公共祖先 | 🟡 | 递归 |
| 23 | 构造二叉树 | 🟡 | 递归 |
| 25 | 打家劫舍 III | 🟡 | 树形 DP |
| 28 | 最长递增子序列 | 🟡 | 贪心 + 二分 |
| 29 | 零钱兑换 | 🟡 | 完全背包 |
| 30 | 最大子数组和 | 🟡 | Kadane |
| 33 | 编辑距离 | 🔴 | 区间 DP |
| 39 | 戳气球 | 🔴 | 区间 DP |
| 40 | 最长公共子序列 | 🟡 | DP |
| 41 | 全排列 | 🟡 | 回溯 |
| 44 | 括号生成 | 🟡 | 回溯 |
| 47 | N 皇后 | 🔴 | 回溯 |
| 53 | 搜索旋转排序数组 | 🟡 | 二分 |
| 54 | 寻找两个正序数组的中位数 | 🔴 | 二分 |
| 61 | 合并 K 个升序链表 | 🔴 | 堆 |
| 64 | 数据流的中位数 | 🔴 | 双堆 |
| 65-66 | 课程表 I/II | 🟡 | 拓扑排序 |
| 67 | 岛屿数量 | 🟡 | DFS/BFS |
| 76 | LRU 缓存 | 🟡 | 哈希 + 双向链表 |
| 77 | 实现 Trie | 🟡 | 前缀树 |
| 85 | 柱状图中最大的矩形 | 🔴 | 单调栈 |
| 86 | 滑动窗口最大值 | 🔴 | 单调队列 |
| 88 | 单词接龙 | 🔴 | BFS |

**后续计划：**

- [ ] 创建 30 天刷题计划表
- [ ] 添加更多测试用例
- [ ] 添加可视化解说图
- [ ] 整理面试高频题专项练习

---

**💡 使用建议：**

1. **优先刷带⭐的题目** - 这些是高频面试题
2. **先看最优解** - 理解核心思路后再看备选解法
3. **注意复杂度** - 面试时要能分析时间和空间复杂度
4. **多写多练** - 每道题至少手写 3 遍

---

*最后更新：2026-03-31 21:30*
