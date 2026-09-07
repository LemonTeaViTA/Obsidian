class Solution {
    public int[] constructArr(int[] a) {
        int n = a.length;
        int[] ans = new int[n];
        for (int i = 0, left = 1; i < n; ++i) {
            ans[i] = left;
            left *= a[i];
        }
        for (int i = n - 1, right = 1; i >= 0; --i) {
            ans[i] *= right;
            right *= a[i];
        }
        return ans;
    }
}