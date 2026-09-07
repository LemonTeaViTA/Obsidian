#
# @lc app=leetcode.cn id=217 lang=python3
#
# [217] 存在重复元素
#

# @lc code=start
class Solution:
    def containsDuplicate(self, nums: List[int]) -> bool:
        ans = set()
        for x in nums:
            if x in ans:
                return True
            ans.add(x)
        return False

# @lc code=end

