/**
 * @param {number[]} cont
 * @return {number[]}
 */
var fraction = function (cont) {
    const dfs = i => {
        if (i === cont.length - 1) {
            return [cont[i], 1];
        }
        const [a, b] = dfs(i + 1);
        const [x, y] = [a * cont[i] + b, a];
        const g = gcd(x, y);
        return [Math.floor(x / g), Math.floor(y / g)];
    };
    const gcd = (a, b) => {
        return b === 0 ? a : gcd(b, a % b);
    };
    return dfs(0);
};
