#
# @lc app=leetcode.cn id=713 lang=python3
#
# [713] 乘积小于 K 的子数组
#

# @lc code=start
class Solution:
    def numSubarrayProductLessThanK(self, nums: List[int], k: int) -> int:
        left = ans = 0
        max_sum = 1
        for right, num in enumerate(nums):
            max_sum *= num
            while max_sum >= k:
                max_sum //= nums[left]
                left += 1
            ans += right - left + 1
        return ans

# @lc code=end

