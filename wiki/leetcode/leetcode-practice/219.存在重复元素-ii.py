#
# @lc app=leetcode.cn id=219 lang=python3
#
# [219] 存在重复元素 II
#

# @lc code=start
class Solution:
    def containsNearbyDuplicate(self, nums: List[int], k: int) -> bool:
        lastindex = defaultdict(int)
        for i, x in enumerate(nums):
            if x in lastindex and abs(lastindex[x] - i) <= k:
                return True
            lastindex[x] = i
        return False


# @lc code=end

