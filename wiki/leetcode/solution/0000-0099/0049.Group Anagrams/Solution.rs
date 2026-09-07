use std::collections::HashMap;

impl Solution {
    pub fn group_anagrams(strs: Vec<String>) -> Vec<Vec<String>> {
        let mut d = HashMap::new();
        for s in strs {
            let mut t: Vec<char> = s.chars().collect();
            t.sort_unstable();
            let k: String = t.into_iter().collect();
            d.entry(k).or_insert_with(Vec::new).push(s);
        }
        d.into_values().collect()
    }
}
