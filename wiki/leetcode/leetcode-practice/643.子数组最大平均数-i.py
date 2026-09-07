#
# @lc app=leetcode.cn id=643 lang=python3
#
# [643] 子数组最大平均数 I
#

# @lc code=start
class Solution:
    def findMaxAverage(self, nums: List[int], k: int) -> float:
        if len(nums) == 1:
            return nums[0]
        max_sum = left = 0
        ans = float('-inf')
        for right, num in enumerate(nums):
            max_sum += num
            if right - left + 1 == k:
                ans = max(max_sum, ans)
                max_sum -= nums[left]
                left += 1
        return ans/k
# @lc code=end

