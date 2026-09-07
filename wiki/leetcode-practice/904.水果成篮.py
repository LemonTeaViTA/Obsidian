#
# @lc app=leetcode.cn id=904 lang=python3
#
# [904] 水果成篮
#

# @lc code=start
class Solution:
    def totalFruit(self, fruits: List[int]) -> int:
        left = ans = 0
        count = defaultdict(int)
        for right, fruit in enumerate(fruits):
            count[fruit] += 1
            while len(count.keys()) > 2:
                count[fruits[left]] -= 1
                if count[fruits[left]] == 0:
                    del count[fruits[left]]
                left += 1
            ans = max(ans, right - left + 1)
        return ans
# @lc code=end

