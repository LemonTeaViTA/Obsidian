#!/bin/bash
# wiki 机械检查独立脚本 (简化版,移除 JSON 输出)
# 用法: ./check.sh [--encoding|--links|--structure|--callouts|--all]

set -euo pipefail

WIKI_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WIKI_ROOT"

log_section() { echo ""; echo "=== $1 ==="; }
log_ok() { echo "✅ $1"; }
log_warn() { echo "🟡 $1"; }
log_error() { echo "🔴 $1"; }

# 1. 编码检查
check_encoding() {
    log_section "UTF-8 乱码检查"

    local corrupt_files=$(grep -rlP '\xef\xbf\xbd' wiki/ 2>/dev/null || true)
    local corrupt_count=0
    if [ -n "$corrupt_files" ]; then
        corrupt_count=$(echo "$corrupt_files" | wc -l)
    fi

    if [ "$corrupt_count" -eq 0 ]; then
        log_ok "UTF-8 乱码: 0 处"
    else
        log_error "UTF-8 乱码: $corrupt_count 处"
        echo "$corrupt_files"
    fi
}

# 2. 链接检查
check_links() {
    log_section "Wikilink 坏链检查 (抽样)"

    local dead_count=0
    local checked=0

    # 抽样检查(全量太慢,抽 50 个)
    local sample_links=$(grep -rohP '\[\[[^\]]+\]\]' wiki/ 2>/dev/null | sort -u | head -50)

    while IFS= read -r full_link; do
        [[ -z "$full_link" ]] && continue

        # 提取 [[file]] 或 [[domain/file]]
        local link=$(echo "$full_link" | sed 's/\[\[\(�[^#|]*\).*/\1/')

        # 跳过占位符
        [[ "$link" =~ ^(wikilink|主文档|1,).*$ ]] && continue

        # 检查文件是否存在
        if [[ ! -f "wiki/$link.md" ]] && ! find wiki/ -name "$(basename "$link").md" -type f 2>/dev/null | grep -q .; then
            ((dead_count++))
            log_warn "死链: $full_link"
        fi
        ((checked++))
    done <<< "$sample_links"

    log_ok "抽样检查: $checked 个链接, $dead_count 个死链"
}

# 3. 结构检查
check_structure() {
    log_section "文档结构检查"

    local over_600=0
    local over_800=0
    local multi_h1=0

    while IFS= read -r file; do
        [[ ! -f "$file" ]] && continue

        # 行数检查(排除流水账)
        if [[ ! "$file" =~ (优化记录|思考记录) ]]; then
            local lines=$(wc -l < "$file" 2>/dev/null || echo 0)
            if [ "$lines" -gt 800 ]; then
                log_error ">800行: $file ($lines 行)"
                ((over_800++))
            elif [ "$lines" -gt 600 ]; then
                log_warn ">600行: $file ($lines 行)"
                ((over_600++))
            fi
        fi

        # 多 H1 检查
        local h1_count=$(grep -c '^# ' "$file" 2>/dev/null || echo 0)
        if [ "$h1_count" -gt 1 ]; then
            log_error "多H1($h1_count个): $file"
            ((multi_h1++))
        fi

    done < <(find wiki/ -name '*.md' -type f)

    log_ok "结构检查完成"
    echo "  >600行: $over_600 个 🟡"
    echo "  >800行: $over_800 个 🔴"
    echo "  多H1: $multi_h1 个 🔴"
}

# 4. Callout 检查
check_callouts() {
    log_section "Callout 规范检查"

    # 非法 callout 类型
    local invalid=$(grep -rnP '>\s*\[!(?!(tip|info|note|warning|danger)\b)' wiki/ 2>/dev/null || true)
    local invalid_count=0
    if [ -n "$invalid" ]; then
        invalid_count=$(echo "$invalid" | wc -l)
        log_warn "非法 callout 类型: $invalid_count 处"
        echo "$invalid" | head -5
    else
        log_ok "Callout 类型: 全部合法"
    fi

    # 嵌套 callout
    local nested=$(grep -rnP '^>\s*>\s*\[!' wiki/ 2>/dev/null || true)
    local nested_count=0
    if [ -n "$nested" ]; then
        nested_count=$(echo "$nested" | wc -l)
        log_error "嵌套 callout: $nested_count 处"
        echo "$nested" | head -5
    else
        log_ok "嵌套 callout: 0 处"
    fi
}

# 主逻辑
case "${1:-}" in
    --encoding)
        check_encoding
        ;;
    --links)
        check_links
        ;;
    --structure)
        check_structure
        ;;
    --callouts)
        check_callouts
        ;;
    --all)
        check_encoding
        check_links
        check_structure
        check_callouts
        echo ""
        echo "========================================="
        echo "全量检查完成 ✅"
        ;;
    *)
        echo "用法: $0 [--encoding|--links|--structure|--callouts|--all]"
        echo ""
        echo "选项:"
        echo "  --encoding   : UTF-8 乱码检查"
        echo "  --links      : Wikilink 坏链检查(抽样 50 个)"
        echo "  --structure  : 行数/多H1检查"
        echo "  --callouts   : Callout 规范检查"
        echo "  --all        : 全部检查"
        exit 1
        ;;
esac
