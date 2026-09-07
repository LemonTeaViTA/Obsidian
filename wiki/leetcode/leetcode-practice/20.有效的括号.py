#
# @lc app=leetcode.cn id=20 lang=python3
#
# [20] 有效的括号
#

# @lc code=start
class Solution:
    def isValid(self, s: str) -> bool:
        dict = {')': '(', ']':'[', '}': '{'}
        stack = []
        for c in s:
            if c in '[{(':
                stack.append(c)
            elif c in ')]}':
                if not stack or stack.pop() != dict[c]:
                    return False
        return len(stack) == 0
# @lc code=end

