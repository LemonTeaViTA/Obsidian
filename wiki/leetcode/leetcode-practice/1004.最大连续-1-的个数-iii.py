#
# @lc app=leetcode.cn id=1004 lang=python3
#
# [1004] 最大连续1的个数 III
#

# @lc code=start
class Solution:
    def longestOnes(self, nums: List[int], k: int) -> int:
        left = ans = count = 0 
        for right, num in enumerate(nums):
            if num == 0:
                count += 1
            while count > k:
                if nums[left] == 0:
                    count -= 1
                left += 1
            ans = max(ans, right - left + 1)
        return ans
# @lc code=end

