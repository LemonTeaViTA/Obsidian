#
# @lc app=leetcode.cn id=209 lang=python3
#
# [209] 长度最小的子数组
#

# @lc code=start
class Solution:
    def minSubArrayLen(self, target: int, nums: List[int]) -> int:
        left = count = 0
        ans = len(nums) + 1
        for right, x in enumerate(nums):
            count += x
            while count >= target:
                ans = min(ans, right - left + 1)
                count -= nums[left]
                left += 1
        return ans if ans <= len(nums) else 0

            
# @lc code=end

