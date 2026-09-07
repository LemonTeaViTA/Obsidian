#
# @lc app=leetcode.cn id=347 lang=python3
#
# [347] 前 K 个高频元素
#

# @lc code=start
class Solution:
    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        count = defaultdict(int)
        for num in nums:
            count[num] += 1
        sorted_nums = sorted(
            count.keys(),
            key = lambda num: count[num],
            reverse=True
        )
        return sorted_nums[:k]

# @lc code=end

