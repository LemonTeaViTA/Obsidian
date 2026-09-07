#
# @lc app=leetcode.cn id=49 lang=python3
#
# [49] 字母异位词分组
#

# @lc code=start
class Solution:
    def groupAnagrams(self, strs: List[str]) -> List[List[str]]:
        count = defaultdict(list)
        for s in strs:
            sorted_s = ''.join(sorted(s))
            count[sorted_s].append(s)
        return list(count.values())


# @lc code=end

