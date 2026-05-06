#!/bin/bash
# Obsidian Markdown 质量检查脚本
# PostToolUse Hook: 每次 Edit/Write .md 文件后自动运行

FILE="$1"
ERRORS=0
WARNINGS=0

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
    exit 0
fi

# 只检查 wiki 目录下的 md 文件
case "$FILE" in
    */wiki/*) ;;
    *) exit 0 ;;
esac

echo "--- MD Check: $(basename "$FILE") ---"

# 1. 检测乱码 (UTF-8 replacement character)
GARBLED=$(grep -nP '\xEF\xBF\xBD' "$FILE" 2>/dev/null)
if [ -n "$GARBLED" ]; then
    echo "[ERROR] 检测到乱码字符:"
    echo "$GARBLED" | head -5
    ERRORS=$((ERRORS + 1))
fi

# 2. 检测 Java 代��块中可能的未定义返回变量
UNDEFINED=$(awk '/^```java/,/^```/' "$FILE" 2>/dev/null | grep -n 'return [a-z][a-zA-Z]*;' | grep -v 'return null' | grep -v 'return true' | grep -v 'return false' | grep -v 'return this' | grep -v 'return new' | grep -v 'return super')
if [ -n "$UNDEFINED" ]; then
    echo "[WARN] Java 代码中可能存在未定义的返回变量:"
    echo "$UNDEFINED" | head -3
    WARNINGS=$((WARNINGS + 1))
fi

# 3. 检测断链
WIKI_DIR=$(dirname "$FILE")
while [ "$(basename "$WIKI_DIR")" != "wiki" ] && [ "$WIKI_DIR" != "/" ]; do
    WIKI_DIR=$(dirname "$WIKI_DIR")
done

BROKEN_COUNT=0
while IFS= read -r link; do
    target=$(echo "$link" | sed 's/#.*//;s/|.*//')
    if [ -n "$target" ]; then
        found=$(find "$WIKI_DIR" -name "${target}.md" 2>/dev/null | head -1)
        if [ -z "$found" ]; then
            if [ $BROKEN_COUNT -eq 0 ]; then
                echo "[WARN] 断链:"
            fi
            echo "  - [[$link]]"
            BROKEN_COUNT=$((BROKEN_COUNT + 1))
        fi
    fi
done < <(grep -oP '\[\[\K[^\]]+' "$FILE" 2>/dev/null)

if [ $BROKEN_COUNT -gt 0 ]; then
    WARNINGS=$((WARNINGS + 1))
fi

# 4. 检测 frontmatter
HEAD=$(head -1 "$FILE")
if [ "$HEAD" != "---" ]; then
    echo "[WARN] 缺少 frontmatter (文件应以 --- 开头)"
    WARNINGS=$((WARNINGS + 1))
fi

# 5. 检测未闭合的代码块 (反引号围栏数量应为偶数)
FENCE_COUNT=$(grep -c '^```' "$FILE")
if [ $((FENCE_COUNT % 2)) -ne 0 ]; then
    echo "[ERROR] 代码块未闭合 (围栏数量为奇数: $FENCE_COUNT)"
    ERRORS=$((ERRORS + 1))
fi

# 6. 检测表格列数不一致
TABLE_ERR=""
prev_cols=0
in_table=0
in_code=0
while IFS= read -r line; do
    case "$line" in
        '```'*) in_code=$((1 - in_code)); continue ;;
    esac
    if [ $in_code -eq 1 ]; then continue; fi
    case "$line" in
        '|'*)
            cols=$(echo "$line" | awk -F'|' '{print NF}')
            if [ $in_table -eq 1 ] && [ $prev_cols -ne 0 ] && [ $cols -ne $prev_cols ]; then
                TABLE_ERR="表格列数不一致 (期望 $prev_cols, 实际 $cols)"
                break
            fi
            prev_cols=$cols
            in_table=1
            ;;
        *)
            in_table=0
            prev_cols=0
            ;;
    esac
done < "$FILE"

if [ -n "$TABLE_ERR" ]; then
    echo "[ERROR] $TABLE_ERR"
    ERRORS=$((ERRORS + 1))
fi

# 汇总
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "OK"
else
    echo "--- Result: $ERRORS error(s), $WARNINGS warning(s) ---"
fi

if [ $ERRORS -gt 0 ]; then
    exit 1
fi
exit 0
