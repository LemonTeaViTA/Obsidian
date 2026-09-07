#
# @lc app=leetcode.cn id=389 lang=python3
#
# [389] 找不同
#

# @lc code=start
class Solution:
    def findTheDifference(self, s: str, t: str) -> str:
        count = Counter(s)
        for c in t:
            count[c] -= 1
            if count[c] < 0:
                return c
# @lc code=end

