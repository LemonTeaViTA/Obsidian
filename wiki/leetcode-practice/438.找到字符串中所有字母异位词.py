#
# @lc app=leetcode.cn id=438 lang=python3
#
# [438] 找到字符串中所有字母异位词
#

# @lc code=start
class Solution:
    def findAnagrams(self, s: str, p: str) -> List[int]:
        count_p = Counter(p)
        count_s = defaultdict(int)
        left = 0
        length = len(p)
        ans = []
        for right, c in enumerate(s):
            count_s[c] += 1
            if right - left + 1 == length:
                if count_s == count_p:
                    ans.append(left)
                count_s[s[left]] -= 1
                if count_s[s[left]] == 0:
                    del count_s[s[left]]
                left += 1
        return ans
# @lc code=end

