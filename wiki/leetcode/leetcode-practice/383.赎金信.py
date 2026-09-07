#
# @lc app=leetcode.cn id=383 lang=python3
#
# [383] 赎金信
#

# @lc code=start
class Solution:
    def canConstruct(self, ransomNote: str, magazine: str) -> bool:
        if len(ransomNote) > len(magazine):
            return False
        count = Counter(magazine)
        for c in ransomNote:
            count[c] -= 1
            if count[c] < 0:
                return False
        return True
# @lc code=end

