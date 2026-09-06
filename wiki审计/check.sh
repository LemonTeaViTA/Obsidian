#!/bin/bash
# wiki 机械检查独立脚本 (简化版,移除 JSON 输出)
# 用法: ./check.sh [--encoding|--links|--structure|--callouts|--all]

# 注意: 不用 set -e, 因为 ((var++)) 在 var=0 时返回 1 会触发退出
set -uo pipefail

# 仅红色错误阻断 CI；600-800 行黄旗仍是提示，不阻断提交。
AUDIT_FAILED=0

WIKI_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WIKI_ROOT"

log_section() { echo ""; echo "=== $1 ==="; }
log_ok() { echo "✅ $1"; }
log_warn() { echo "🟡 $1"; }
log_error() { echo "🔴 $1"; }

# 1. 编码检查
check_encoding() {
    log_section "UTF-8 乱码检查"

    local scan_roots=(wiki/)
    [ -d projects/ ] && scan_roots+=(projects/)
    [ -d career/ ] && scan_roots+=(career/)
    local corrupt_files=$(grep -rl $'\xef\xbf\xbd' "${scan_roots[@]}" 2>/dev/null || true)
    local corrupt_count=0
    if [ -n "$corrupt_files" ]; then
        corrupt_count=$(echo "$corrupt_files" | wc -l)
    fi

    if [ "$corrupt_count" -eq 0 ]; then
        log_ok "UTF-8 乱码: 0 处"
    else
        log_error "UTF-8 乱码: $corrupt_count 处"
        echo "$corrupt_files"
        AUDIT_FAILED=1
    fi
}

# 2. 链接检查
check_links() {
    log_section "Wikilink 坏链检查 (全量)"

    # 先收集所有可链接的文件名（wiki/ + projects/ + career/ + raws/ + 根目录）
    declare -a wiki_files=()
    while IFS= read -r f; do
        wiki_files+=("$(basename "$f" .md)")
    done < <({ find wiki/ projects/ career/ -name '*.md' -type f; [ -d raws/ ] && find raws/ -name '*.md' -type f; find . -maxdepth 1 -name '*.md' -type f; })

    local dead_count=0 checked=0
    declare -a dead_list=()

    # 全量唯一链接
    while IFS= read -r full_link; do
        local link
        link=$(echo "$full_link" | sed -e 's/^\[\[//' -e 's/\]\]$//' -e 's/[#|].*//' -e 's|.*/||' -e 's/\.md$//')
        [[ -z "$link" ]] && continue
        [[ "$link" =~ ^(wikilink|主文档|1,|file|相关文档|相关\ wiki) ]] && continue

        ((checked++))
        if ! printf '%s\n' "${wiki_files[@]}" | grep -Fqx "$link"; then
            ((dead_count++))
            dead_list+=("$link")
        fi
    # 扫描所有公开 Markdown 内容，而不是只扫描 wiki。
    done < <(grep -rohE '\[\[[^]]+\]\]' wiki/ projects/ career/ raws/ 2>/dev/null | sort -u)

    if [ "$dead_count" -eq 0 ]; then
        log_ok "全量: $checked 个唯一链接, 0 死链"
    else
        log_error "全量: $checked 个唯一链接, $dead_count 个死链"
        printf '  死链: [[%s]]\n' "${dead_list[@]}" | head -30
        [ "$dead_count" -gt 30 ] && echo "  ...还有 $((dead_count-30)) 个"
        AUDIT_FAILED=1
    fi
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
                AUDIT_FAILED=1
            elif [ "$lines" -gt 600 ]; then
                log_warn ">600行: $file ($lines 行)"
                ((over_600++))
            fi
        fi

        # 多 H1 检查 (使用 awk 区分代码块内外)
        local h1_count=$(awk '/^```/{in_code=!in_code; next} !in_code && /^# /{c++} END{print c+0}' "$file")
        if [ "$h1_count" -gt 1 ]; then
            log_error "多H1($h1_count个): $file"
            ((multi_h1++)) || true
            AUDIT_FAILED=1
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
    local invalid=$(grep -rnE '^>[[:space:]]*\[![^]]+\]' wiki/ 2>/dev/null | grep -vE '>[[:space:]]*\[!(tip|info|note|warning|danger)(\]|[[:space:]])' || true)
    local invalid_count=0
    if [ -n "$invalid" ]; then
        invalid_count=$(echo "$invalid" | wc -l)
        log_warn "非法 callout 类型: $invalid_count 处"
        echo "$invalid" | head -5
    else
        log_ok "Callout 类型: 全部合法"
    fi

    # 嵌套 callout
    local nested=$(grep -rnE '^>[[:space:]]*>[[:space:]]*\[!' wiki/ 2>/dev/null || true)
    local nested_count=0
    if [ -n "$nested" ]; then
        nested_count=$(echo "$nested" | wc -l)
        log_error "嵌套 callout: $nested_count 处"
        echo "$nested" | head -5
        AUDIT_FAILED=1
    else
        log_ok "嵌套 callout: 0 处"
    fi
}

# 5. 敏感信息检查（仅扫描公开内容，不读取 .git 历史）
check_sensitive() {
    log_section "敏感信息检查"

    local roots=(wiki projects career raws README.md)
    local matches=""
    # 排除常见文档示例地址；其余凭据、联系方式和内部域名命中即阻断。
    matches=$(grep -RInE \
        --exclude-dir=.git \
        --exclude='*.pdf' \
        --exclude='*.png' \
        --exclude='*.jpg' \
        '(AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|Bearer[[:space:]]+[A-Za-z0-9._-]{20,}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(^|[^0-9])1[3-9][0-9]{9}([^0-9]|$)|https?://[^[:space:]]+\.(internal|corp|intra)(/|$))' \
        "${roots[@]}" 2>/dev/null || true)

    if [ -n "$matches" ]; then
        log_error "疑似敏感信息: $(echo "$matches" | wc -l | tr -d ' ') 处"
        echo "$matches" | head -30
        AUDIT_FAILED=1
    else
        log_ok "未发现疑似凭据、联系方式或内部域名"
    fi
}

# 主逻辑
case "${1:-}" in
    --encoding)
        check_encoding
        exit "$AUDIT_FAILED"
        ;;
    --links)
        check_links
        exit "$AUDIT_FAILED"
        ;;
    --structure)
        check_structure
        exit "$AUDIT_FAILED"
        ;;
    --callouts)
        check_callouts
        exit "$AUDIT_FAILED"
        ;;
    --sensitive)
        check_sensitive
        exit "$AUDIT_FAILED"
        ;;
    --all)
        check_encoding
        check_links
        check_structure
        check_callouts
        check_sensitive
        echo ""
        echo "========================================="
        echo "全量检查完成 ✅"
        exit "$AUDIT_FAILED"
        ;;
    *)
        echo "用法: $0 [--encoding|--links|--structure|--callouts|--all]"
        echo ""
        echo "选项:"
        echo "  --encoding   : UTF-8 乱码检查"
        echo "  --links      : Wikilink 坏链检查(全量)"
        echo "  --structure  : 行数/多H1检查"
        echo "  --callouts   : Callout 规范检查"
        echo "  --sensitive  : 敏感信息检查"
        echo "  --all        : 全部检查"
        exit 1
        ;;
esac
