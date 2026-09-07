#
# @lc app=leetcode.cn id=921 lang=python3
#
# [921] 使括号有效的最少添加
#

# @lc code=start
class Solution:
    def minAddToMakeValid(self, s: str) -> int:
        count = 0
        stack = []
        for c in s:
            if c == '(':
                stack.append(c)
            elif c == ')':
                if stack:
                    stack.pop()
                else:
                    count += 1
        return count + len(stack)


# @lc code=end

