#
# @lc app=leetcode.cn id=350 lang=python3
#
# [350] 两个数组的交集 II
#

# @lc code=start
class Solution:
    def intersect(self, nums1: List[int], nums2: List[int]) -> List[int]:
        # nums1.sort()
        # nums2.sort()
        # i = j = 0
        # ans = []
        # while i < len(nums1) and j < len(nums2):
        #     if nums1[i] == nums2[j]:
        #         ans.append(nums1[i])
        #         i += 1
        #         j += 1
        #     elif nums1[i] < nums2[j]:
        #         i += 1
        #     else:
        #         j += 1
        # return ans

        cnt = Counter(nums1)
        ans = []
        for x in nums2:
            if cnt[x]:
                ans.append(x)
                cnt[x] -= 1
        return ans

# @lc code=end

