# 客户端-TDD-咪淘导播-Android-执行编译集成打包

模板类型：客户端

版本：1.6

创建时间：2026-07-18 20:31:51

更新时间：2026-07-18 20:31:51

描述：20260718 v8

来源：用户于 2026-07-19 在当前 Codex 对话中提供

整理说明：以下内容按用户提供的系统模板原文记录，未做逻辑分析或内容改写。

---

# 咪淘导播 Android App 编译与 Zeus 打包工作流 V2（脚本驱动）

执行咪淘导播 Android App 从当前已推送 Git 分支、Zeus APK 构建到 `pack_result_info.json` 产出的完整交付。

固定 zeus jobId=759 （咪淘导播 Android mcp测试）
固定 Git 校验、Zeus Job、构建参数、状态检查点和结果文件校验由软件工厂提供的 Android App 交付脚本执行；Agent 只负责串行编排 `zeus_app` MCP。不得使用 Flutter Plugin、iOS Pod 或其他 App 的交付流程替代。

## 0. 当前 Android 工程事实

以下事实来自咪淘导播 Android 仓库，执行时仍须在当前分支复核：

- 仓库：`ssh://git@gitlab.vdian.net:60022/android-ep/app-live.git`
- 工程类型：完整 Android App，不是 Flutter Plugin，不存在 Flutter 产物集成流程
- Gradle Module：`:app`、`:xmagic`
- Application ID：`com.mitao.direct`
- 构建入口：仓库自带 `./gradlew`
- Android Gradle Plugin：`3.5.4`
- Gradle Wrapper：`6.5.1`
- Java/Kotlin：Java 8、Kotlin `1.5.32`
- minSdk / compileSdk / targetSdk：`21 / 30 / 30`
- ABI：`arm64-v8a`
- Build Type：`debug`、`release`
- 版本配置：`app/app_config.properties`
- 本地 Module 依赖：`implementation project(path: ':xmagic')`

禁止加入以下不存在的流程：

- Flutter Plugin 仓库准备、Flutter module 分支或 `update_plugins.sh` 更新；
- `bundle-flutter` 校验、Flutter Jenkins 构建、Flutter Router 更新；
- `PLUGIN_BRANCH_NAME_*`、`SO_AOT`、`NEW_PACKAGE_MODE` 等 Flutter 参数；
- `app-weishop,buildsystem,location,main,flutter` 五插件组合；
- iOS Pod、Podfile、workspace、Scheme 或 IPA 交付步骤。

## 1. 输入与固定配置

业务侧无需提供组件名、仓库地址、Zeus Job ID 或 Zeus 请求参数。

```yaml
change_id: "{{CHANGE_ID}}"
expected_commit_sha: "{{EXPECTED_COMMIT_SHA}}" # 可选
delivery_script: "{{ANDROID_APP_DELIVERY_SCRIPT}}"
delivery_script_version: "{{ANDROID_APP_DELIVERY_SCRIPT_VERSION}}"
```

其中：

- `{{CHANGE_ID}}` = 当前任务 `task_id`；
- 目标分支固定取当前 `app-live-android` 仓库的实际 Git 分支；detached HEAD 立即失败；
- `expected_commit_sha` 非空时必须与远端目标分支 SHA 完全一致；
- 交付脚本路径、版本、Zeus Job ID、Job Name 和请求参数必须由软件工厂任务上下文提供；
- 任何占位符未替换、脚本不存在、版本不匹配或脚本未输出完整固定配置时，立即标记 blocked；不得向用户索取或由 LLM 猜测。

禁止让用户提供或由 LLM 猜测目标分支、仓库地址、Change ID、Zeus Job ID、Job Name、App ID、构建参数或 APK 地址。脚本失败时报告原始错误并停止，不得手工绕过脚本门禁。

## 2. MCP 边界

- 本流程不调用 Jenkins。咪淘导播当前是完整 Android App，不需要 Flutter Plugin 产物预构建。
- Zeus 只使用 `zeus_app`：
  - Job 占用检查：`mcp__zeus_app__zeusGetJobDetail`
  - 创建构建：`mcp__zeus_app__zeusJobAction`
  - 状态查询：`mcp__zeus_app__zeusGetBuildDetail`
- 不调用 `jenkins_app`、`jenkins`、`zeus` 或其他同名 MCP server 作为降级方案。
- 不调用创建、删除或修改 Zeus Job 配置的工具。
- 必要工具不可用时按 MCP 配置错误停止，不得改写工具名或跳过平台闭环。

只有收到工具的成功输出和 `Result` 才算调用完成。仅显示 `MCP Tool Call`、工具名或 `Arguments`，但没有返回 `Result`，不代表创建成功。

同一次构建尝试中，创建调用超时、连接中断或结果不明时保留 `zeus_triggering` 状态，立即停止并要求人工核对；禁止重试该次创建。只有上一构建已取得明确失败终态、完成失败归因和必要修复并推送新 Commit 后，才允许发起下一次独立构建尝试。工具明确返回 rejected、declined、permission denied 或用户拒绝授权时，立即结束并反馈原始拒绝原因，不得重试。

## 3. 交付脚本门禁

执行任何 Git、Zeus 或结果文件步骤前，先校验软件工厂注入的交付脚本：

```bash
delivery_script="{{ANDROID_APP_DELIVERY_SCRIPT}}"
required_version="{{ANDROID_APP_DELIVERY_SCRIPT_VERSION}}"

test -n "$delivery_script"
test -n "$required_version"
test "$delivery_script" != "{{ANDROID_APP_DELIVERY_SCRIPT}}"
test "$required_version" != "{{ANDROID_APP_DELIVERY_SCRIPT_VERSION}}"
test -f "$delivery_script"
test "$(python3 "$delivery_script" --version 2>/dev/null)" = "$required_version"
```

本提示词不擅自指定不存在的 Android 交付脚本文件名、下载 Git Ref 或版本。脚本必须由软件工厂任务上下文注入并完成可信缓存；不得使用 `flutter_android_delivery.py`、`ios_delivery.py` 或从其他本机工程搜索相似脚本。

脚本必须至少提供以下语义能力，具体命令和参数以脚本 `--help` 的真实输出为准：

- `prepare`：校验仓库、分支、Change ID、远端 SHA，输出 Zeus 固定配置并写入检查点；
- `claim-zeus`：原子申请一次性 Zeus 创建权；
- `record-zeus-trigger`：记录唯一 Zeus 内部 Build ID；
- Job 繁忙轮询记录：保存 `job_busy_check_count`、每次查询时间和 Job 759 返回的忙闲状态，并阻止超过 30 次；
- 构建尝试记录：按 attempt 保存失败归因、修复 Commit、Zeus Build ID 和终态，并阻止超过 5 次；
- `finalize`：校验构建终态和结果字段，原子生成 `pack_result_info.json`；
- `status`：读取中断恢复状态。

缺少任一必需能力时立即 blocked，不得在 Agent 中手工仿造脚本状态机。

## 4. 串行执行与状态约束

本流程由一个前台 owner 串行持有。禁止创建 detached subagent，禁止后台轮询未 join 就进入下一阶段，禁止创建重复任务卡。任何构建未到终态时不得输出完成响应。

检查点由脚本原子写入任务根目录的 `delivery_state.json`，至少记录：

- `changeId`、仓库 URL、目标分支、远端 Commit；
- Zeus Job ID、Job Name、当前 attempt、每次 claim ID、内部 Build ID、构建终态；
- 每次失败的证据、根因分类、修复文件、修复 Commit 和重建结果；
- 当前状态、轮询次数、最后查询时间、连续查询失败次数；
- `job_busy_check_count`：当前构建触发前已返回“繁忙”的查询次数，范围为 0～30；
- `job_busy_history[]`：每项只记录查询序号、查询时间、`jobId=759` 和明确忙闲状态，不记录或判断历史构建成功失败；
- `repair_attempts`：已执行的自动修复重试次数，范围为 0～4；
- `repair_history[]`：每项记录 `attempt_no`、`prev_build_id`、`prev_build_url`、`classified_cause`、失败日志摘要、修改文件清单、修复 Commit、`new_build_id` 和结果；
- 最后完成阶段和下一动作。

检查点与当前 Change ID、仓库、分支或远端 Commit 不一致时立即停止，不得覆盖或借用其他任务的 Queue ID、Build ID 或构建结果。

## 5. 执行流程

### 5.1 准备 Git 交付状态

当前目录必须是已经完成开发的 `app-live-android` 仓库。先检查当前分支和工作区：

```bash
git branch --show-current
git status --short
git diff --check
git diff
git diff --cached
```

Git 准备规则：

1. 当前分支为空或处于 detached HEAD 时立即停止，禁止自动 checkout 或创建替代分支；
2. 如果本地仓库存在未提交改动，必须逐文件检查 `git status`、未暂存 diff 和已暂存 diff，结合当前 Change ID、`tasks.md`、`apply_result.md` 与实际代码改动判断该文件是否需要进入本次交付；
3. 需要提交的改动：必须完整暂存，使用当前 Change ID 提交，并把最新提交推送到当前远程分支；提交信息例如：`[TDD-DELIVERY] {{CHANGE_ID}} prepare Git delivery`；
4. 不需要提交的改动：保留在本地并从本次提交范围中忽略，不得恢复、删除、stash、覆盖或通过修改 `.gitignore` 隐藏；
5. “不需要提交”必须有明确依据，仅限与当前任务无关的本地文件、日志、缓存、构建产物或其他任务改动；判断依据和忽略文件清单必须写入检查点；
6. 无法确认某项改动是否需要提交时，不得擅自提交或处理，立即标记 blocked 并列出待确认文件；
7. 禁止使用 `git reset --hard`、`git clean`、目录级通配删除或其他批量破坏性命令；
8. 不得提交本地密钥、账号、日志、缓存、构建产物或其他任务的无关文件；
9. 处理完成后再次执行 `git status --short`、`git diff --cached` 和 `git log -1 --oneline`，确认需要交付的代码全部进入最新 `HEAD`；允许已确认不需要提交的改动继续留在本地工作区；
10. 如果工作区原本没有未提交改动，直接复用当前 `HEAD`，禁止制造空提交；
11. 当前任务代码已提交并成功推送到远程仓库，或原本无改动且当前 `HEAD` 已在远端精确存在，即表示“准备 Git 交付状态”完成；
12. “准备 Git 交付状态”完成后，仍须由脚本复核远端分支和 Commit，校验通过后才能触发 Zeus。

允许的 Git 写操作仅限本小节为完成交付所需的 `git add`、`git commit` 和当前分支 `git push`。禁止 merge、rebase、reset、clean、强制推送、修改历史、删除远端分支，禁止恢复、删除、stash 或覆盖不需要提交的本地改动。

若本小节产生了新提交，新的 `HEAD` 是唯一规范交付 Commit。`{{EXPECTED_COMMIT_SHA}}` 非空时必须与新 `HEAD` 完全一致；不一致时停止，不得回滚新提交或改写 expected Commit。

Git 提交和推送完成后，执行脚本的实际 `prepare` 命令。若脚本采用位置参数，可参考：

```bash
python3 "$delivery_script" prepare \
  --change-id "{{CHANGE_ID}}" \
  --expected-commit-sha "{{EXPECTED_COMMIT_SHA}}"
```

脚本必须完成：

1. 校验当前目录 Git origin 与 `ssh://git@gitlab.vdian.net:60022/android-ep/app-live.git` 完全一致；
2. 读取实际当前分支，detached HEAD 立即失败，禁止自动 checkout；
3. 校验 `change_id` 是 `openspec/changes/` 下的单个安全目录名，不含 `/`、`..` 或路径穿越；
4. 使用精确 `refs/heads/<current_branch>` 读取远端分支，必须恰好匹配一条；
5. 确认远端 SHA 等于当前 `HEAD`；提供 expected Commit 时再校验完全一致；
6. 输出唯一 Zeus Job ID、Job Name 和创建请求参数；这些值不得由 Agent补全或改写；
7. 写入检查点，并返回下一动作。

提交失败、推送失败、远端 SHA 不一致、配置缺失或脚本返回失败时立即停止，不触发 Zeus。除本小节明确允许的 add、commit、push 外，不得执行其他 Git 写操作。

### 5.2 检查 Zeus Job 占用

本步骤固定只检查当前 `jobId=759` 是否繁忙。每次准备触发首次构建或修复后的下一 attempt 前，都必须重新执行本步骤。

调用：

```text
mcp__zeus_app__zeusGetJobDetail(jobId=759)
```

判定边界：

- 只读取 `zeusGetJobDetail` 对 Job 759 当前时刻返回的明确忙闲状态；
- 不读取、不查询、不判断该 Job 的“最后构建”“最近构建”或历史构建是否成功；
- 不通过 `mcp__zeus_app__zeusGetBuildDetail` 判断 Job 是否空闲；`zeusGetBuildDetail` 只用于本任务已经触发并记录的 Build ID；
- 不从活动 Build ID、历史状态、缺失字段或 Job 默认配置推断忙闲。

执行规则：

1. 首次查询前将 `job_busy_check_count` 置为 0；
2. Job 759 明确空闲：立即停止占用查询，清除等待定时器，进入 5.3 创建构建；
3. Job 759 明确繁忙：将 `job_busy_check_count` 加 1，并把查询时间和“繁忙”写入 `job_busy_history[]`；
4. 第 1～29 次查询返回繁忙时，设置 1 分钟定时器；定时器触发后再次调用同一个 `mcp__zeus_app__zeusGetJobDetail(jobId=759)`；
5. 任意一次重新查询明确空闲：立即进入 5.3，不再等待剩余定时器；
6. 第 30 次查询仍明确繁忙：立即停止，不触发 Zeus 构建，将当前阶段和自动化构建任务标记 failed；
7. 30 次上限包含第一次查询；两次繁忙查询之间固定间隔 60 秒，不得缩短、并行查询或创建多个定时器；
8. 每一时刻只能有一个 Job 占用查询定时器；中断恢复时从检查点中的 `job_busy_check_count` 继续，不得清零规避 30 次上限；
9. 查询失败、超时、没有 `Result` 或忙闲状态不明确，不计作“繁忙”也不计入 30 次；立即标记 blocked 或 pending，禁止触发构建，禁止把未知状态当作空闲；
10. 本步骤完成的唯一成功条件是 Job 759 当前明确空闲，与最后一次或任何历史构建的结果无关。

### 5.3 原子认领并创建 Zeus 构建

Job 明确空闲后，先从检查点读取当前构建尝试次数：首次构建为 attempt 1；每次取得明确失败终态并完成修复后加 1；总尝试次数不得超过 5。attempt 已达到 5 且上一构建失败时，禁止再次创建，自动化构建任务标记 failed。

按脚本真实命令为当前 attempt 执行 `claim-zeus`。只有 `allowed=true` 时，才把脚本输出的请求对象原样传给一次：

```text
mcp__zeus_app__zeusJobAction
```

要求：

- 请求必须使用脚本输出的 Job ID、当前规范目标分支及既有 Job 所需字段；
- 不得加入 `pluginBranch`、`baselineBranch`、`plugins` 或任何 Flutter 参数；脚本若输出这些字段，判定为交付脚本配置错误并停止；
- Agent 不得增删字段、试错参数或使用历史构建参数；
- 每个 attempt 的创建调用只允许一次；同一次 attempt 不自动重试。

收到明确且唯一的 Zeus 内部 Build ID 后，立即按脚本真实命令执行 `record-zeus-trigger`，传入 attempt、claim ID 和该 Build ID。若 `allowed=false`，只恢复脚本为当前 attempt 已记录的同一 Build ID，不得重新创建。

### 5.4 监控同一 Zeus 构建

每 30 秒只调用：

```text
mcp__zeus_app__zeusGetBuildDetail(buildId=<zeus_internal_build_id>)
```

单次 MCP 查询超时为 90 秒。外层 MCP 请求成功不等于 App 构建成功；必须等待业务字段 `buildStatus` 到达明确终态。

- 排队或运行中：继续查询同一 Build ID；
- 成功：进入结果校验；
- 失败、取消或其他错误终态：记录原始状态和 `buildUrl`，在停止当前 Build ID 的构建轮询前进入 5.4B 诊断闭环；
- 连续 3 次查询失败：停止本轮，保留检查点，状态为 pending；
- 创建结果不明、构建状态不明或平台中断：禁止重新触发，从检查点恢复同一 Build ID。

禁止因为 MCP 外层返回 `status=COMPLETED` 就判定 APK 构建成功。禁止读取全部构建历史或猜测“最新构建”作为本次结果。

### 5.4B 构建失败自动诊断与有限次修复

`mcp__zeus_app__zeusGetBuildDetail` 返回的 `buildStatus` 明确为失败、取消或其他错误终态时，在停止当前 Build ID 的构建轮询前必须执行以下诊断闭环。不得仅记录失败后结束，也不得不看日志直接重复构建。

#### A. 读取 Console 日志

从本次构建返回的 `buildUrl` 推导 Console 地址：去除 `buildUrl` 末尾 `/` 后追加 `/consoleText`。

```text
<buildUrl 去除末尾 />/consoleText
```

示例：

```text
https://ci.vdian.net/job/live/job/<jobName URLENCODED>/<buildNumber>/consoleText
```

通过 Bash `curl` 拉取内网 HTTPS Console 全文，但只允许把最后 500 行送入分析上下文：

```bash
build_url="<zeusGetBuildDetail.buildUrl>"
console_url="${build_url%/}/consoleText"
console_file="$(mktemp "${TMPDIR:-/tmp}/mitao-zeus-console.XXXXXX")"
trap 'rm -f "$console_file"' EXIT HUP INT TERM
if ! console_meta="$(curl -sS --max-time 30 -L \
    -o "$console_file" \
    -w '%{http_code}\n%{url_effective}\n' \
    "$console_url")"; then
  exit 1
fi
http_code="$(printf '%s\n' "$console_meta" | sed -n '1p')"
effective_url="$(printf '%s\n' "$console_meta" | sed -n '2p')"
case "$http_code" in 2??) ;; *) exit 1 ;; esac
case "$effective_url" in *login*|*auth*|*sso*) exit 1 ;; esac
tail -n 500 "$console_file"
rm -f "$console_file"
trap - EXIT HUP INT TERM
```

执行约束：

- `curl` 必须使用 `-sS --max-time 30 -L`；
- HTTP 最终状态不是 2xx、请求超时、连接失败、有效 URL 跳转到 login/auth/sso，或响应明显是认证页面时，视为日志拉取失败；
- 日志拉取失败时不得猜测构建原因、不得修改代码、不得触发下一次构建，立即标记 blocked 并交人工；
- 只保留最后 500 行用于分析和检查点摘要，不把完整 Console 日志塞入对话上下文；
- 临时日志文件使用完立即删除，不提交仓库。

#### B. 失败原因分类

必须基于最后 500 行 Console 输出，将根因归入且只归入下列类别之一：

| 类别 | 典型特征关键词 | Agent 可自动修复 | 处理方式 |
|---|---|---|---|
| 参数错误 | `Could not find property`、`unknown option`、`invalid value`、`VERSION_NAME_*` | 是，但仅限可控参数 | 修改脚本明确声明可变的构建参数或仓库内对应配置；禁止修改固定 Job 759、MCP schema 和外部平台固定约束 |
| 分支/SHA 问题 | `Couldn't find any revision`、`ERROR: Branch not found` | 是 | 重新读取当前分支、远端 ref 和 remote HEAD；修正未推送或引用不一致后重试，禁止改用相似分支 |
| Gradle 编译错误 | `BUILD FAILED`、`error:`、`compileDebugJavaWithJavac`、`Unresolved reference` | 是 | 定位日志明确指出的源码、资源或 Gradle 文件，最小修复后提交 |
| Lint / ProGuard 错误 | `Lint found`、`ProGuard`、`R8` | 是 | 仅修复日志明确命中的代码或规则文件 |
| 环境/基础设施 | `Connection refused`、`nexus.vdian.net`、`gradle-*-bin.zip download failed`、`No space left`、`slave went offline` | 否 | 立即停止并交人工排查，不自动重建 |
| 权限/密钥 | `Permission denied`、`signing`、`keystore not found` | 否 | 立即停止并交人工排查，不修改密钥、签名或权限配置 |
| 未知 | 上述均不匹配，或同时命中多个类别且无法确定主因 | 否 | 立即停止并交人工排查，不猜测修复 |

分类结果、命中关键词、最后 500 行中的最小必要证据和不可修复原因必须写入 `repair_history[]`。

#### C. 有限次自动修复

本流程选择“首次触发计入总次数”：总构建尝试最多 5 轮，即首次构建加最多 4 次自动修复重试。

只有分类为 Agent 可自动修复且失败证据明确的情况才允许进入下一 attempt。每次修复必须：

1. 只修改明确对应根因的精确文件；禁止批量重构、禁止修改无关模块、禁止顺带升级依赖；
2. 修改前确认文件属于当前 `app-live-android` 仓库和当前 Change 的合理影响范围；
3. 参数错误只能修改脚本明确声明可变的参数或仓库内对应配置，不得改写 `mcp__zeus_app__zeusJobAction` 工具名、调用 schema、固定 `jobId=759` 或其他外部平台约束；
4. 修复完成后执行 `git diff --check` 并审查完整 diff；
5. 只暂存修复涉及的精确文件，提交信息包含 attempt：`[BUILD-FIX][attempt-<N>] {{CHANGE_ID}} <分类与根因摘要>`；
6. 推送当前分支，取得新的 remote HEAD，并确认远端 SHA 等于最新本地 `HEAD`；
7. 重新检查 Zeus Job 占用，为下一 attempt 申请新的 claim；
8. 使用新 remote HEAD 调用一次 `mcp__zeus_app__zeusJobAction`，必须取得新的内部 Build ID，不得复用旧 claim ID 或旧 Build ID；
9. 将 `repair_attempts` 加 1，并在 `repair_history[]` 写入 `attempt_no`、`prev_build_id`、`classified_cause`、修改文件清单、修复 Commit 和 `new_build_id`；
10. 新 attempt 只轮询自己的 Build ID；构建成功立即进入 5.5，失败则重新执行本节，但总轮数不得超过 5。

创建结果不明不属于明确失败终态，不得开始下一 attempt；保持 pending 并人工核对，不能通过再次创建绕过防重复约束。

#### D. 终止条件

命中以下任一条件立即停止自动修复：

1. 累计构建尝试达到 5 次仍失败：自动化构建任务标记 failed，输出全部历史 Build ID、Build URL、分类原因、修改文件和修复 Commit，禁止第 6 次构建；
2. 命中环境/基础设施、权限/密钥或未知等 Agent 不可修复分类：标记 blocked，输出根因摘要和 Console 证据，交人工处理；
3. Console 日志无法可靠获取：标记 blocked，禁止猜测和重建；
4. 修复将引入与当前 Change 无关的改动：立即停止并标记 blocked，防止越权修复；
5. 无法确认新 remote HEAD、claim ID 或新 Build ID：保持 pending，禁止重复创建。

### 5.5 校验并生成结果文件

Zeus 成功后，将本次构建返回字段原样交给脚本 `finalize`。参数名以脚本 `--help` 为准，语义至少包括：

```bash
python3 "$delivery_script" finalize \
  --zeus-build-id "<zeus_internal_build_id>" \
  --build-number "<zeus_build_number>" \
  --job-id "<jobId>" \
  --job-name "<script_job_name>" \
  --build-status "<zeus_build_status>" \
  --download-url "<apk_download_url>" \
  --qr-code-url "<qr_code_url>" \
  --build-url "<build_url>"
```

脚本必须校验：

- Job ID、Job Name 与 `prepare` 输出一致；
- 构建状态是明确成功终态；
- Build Number 是本次构建的数字编号；
- APK 下载地址、二维码地址和构建地址非空；
- Zeus 返回目标分支或 Commit 时，必须与已验证远端分支和 SHA 一致；
- Zeus 未返回 Android 分支或 Commit 字段时，不得由 Agent 猜测填充，由脚本按既有 Job 协议判定是否允许缺省。

## 6. `pack_result_info.json` 协议

只有 `finalize` 返回 `ok=true` 且结果 JSON 可解析，才能宣布交付完成。

结果文件固定写入：

```text
<app-live-android-repo>/openspec/changes/<change_id>/pack_result_info.json
```

文件必须是合法 UTF-8 JSON，且固定只包含下游 UI 自动化约定的三个字段：

```json
{
  "jobId": 759,
  "buildId": "0",
  "jobName": "<script_job_name>"
}
```

约束：

- 示例中的 `0` 不是默认值，不得直接使用；
- `jobId` 必须取脚本确认的 Android Zeus Job ID；
- `buildId` 字段名按上下游协议保持不变，值必须取 Zeus `buildNumber` 并转换为 JSON string，不是供 MCP 查询使用的内部 Build ID；
- `jobName` 必须取脚本确认的既有 Job Name；
- 禁止增加额外字段、注释或代码围栏；
- 不得写入 Flutter Plugin、五插件组合或 iOS IPA 字段；
- 失败、超时、状态不明或字段不全时禁止生成成功结果；
- 文件默认不提交、不推送，避免改变本次构建对应的远端 HEAD。

## 7. 中断、失败与日志

- 查看恢复状态时按脚本真实命令执行 `status`；
- `prepare` 必须可重入；已有检查点时只返回下一动作，不覆盖 claim ID 或 Build ID；
- Zeus 创建结果不明时禁止对同一 attempt 自动重试，由人工核对服务端是否已创建构建后再恢复；
- Zeus 构建失败时保存 attempt、`buildStatus`、内部 Build ID、Build Number、Job ID、目标分支、Commit（若返回）、`buildUrl` 和原始错误摘要；
- 没有读取实际日志前，不猜测源码、Gradle、依赖、签名或基础设施根因；
- 连续 3 次状态查询失败或单次调用超过 90 秒时停止本轮，保留检查点并报告最后一次错误；
- 查询超时或 Agent 被平台终止时不回滚、不删除远端分支，也不伪造成功结果；
- 构建失败后的源码或工程修改只能按 5.4B 的真实归因执行；不修改 Zeus Job 配置，不自动回滚上游提交，不进行无关改动。

## 8. 最终响应格式

```markdown
## 执行结果

- 总体状态：成功 / blocked / pending / 失败
- Change ID：<change_id>
- 目标分支：<current_branch>
- 远端 Commit：<remote_commit_sha>
- 构建尝试：<成功 attempt / 总尝试次数，最大 5>

## 构建尝试记录

| attempt | Build ID | Build Number | Commit | 构建状态 | 失败根因 | 修复 Commit | 结果 |
|---|---|---|---|---|---|---|---|

## Zeus Job 占用检查

- Job ID：759
- 查询次数：<1～30>
- 查询间隔：60 秒
- 最后忙闲状态：空闲 / 繁忙 / 未知
- 是否读取历史构建结果：否

## Zeus Android 构建

- Job ID / Job Name：<job_id> / <job_name>
- 内部 Build ID：<zeus_internal_build_id>
- Build Number：<build_number>
- 状态：<build_status>
- Build URL：<build_url>
- APK：<download_url>
- 二维码：<qr_code_url>

## 打包结果文件

- 状态：已生成并校验 / 未生成
- 路径：<app-live-android-repo>/openspec/changes/<change_id>/pack_result_info.json
- 内容：<完整 JSON>

## 异常与恢复

- 失败阶段：<script / git / zeus-job / trigger / poll / diagnose / fix / finalize / none>
- 原始错误：<summary>
- 恢复状态：<delivery_state.json status / next action>
```

禁止把“已触发 Zeus”或“MCP 调用完成”描述成“Android App 已打包成功”。只有读取 Zeus 最终成功状态、完成构建字段和 APK 地址校验，并成功生成 `pack_result_info.json` 后，才能宣布本阶段完成。

## 9. 完成标准（软件工厂可判定）

- [ ] 当前工作区是 `android-ep/app-live.git`，当前分支非 detached HEAD
- [ ] Change ID、交付脚本路径和脚本版本均已解析，无未替换占位符
- [ ] 交付脚本版本匹配，且具备 prepare、claim、record、Job busy timer/history、attempt/repair history、finalize、status 能力
- [ ] 本地所有未提交改动均已逐文件检查并分类为“需要提交”或“不需要提交”
- [ ] 需要提交的改动已全部提交并推送到当前远程分支
- [ ] 不需要提交的改动未进入提交，已保留在本地，且检查点记录了判断依据和忽略文件清单
- [ ] 不存在归属不明或未经确认即提交的改动；如无改动，未制造空提交
- [ ] “准备 Git 交付状态”已完成，远端分支与最新 `HEAD` Commit 精确匹配
- [ ] Zeus Job ID、Job Name 和请求参数全部来自交付脚本，未由 Agent 猜测或改写
- [ ] Zeus Job 占用检查只查询 `mcp__zeus_app__zeusGetJobDetail(jobId=759)` 的当前忙闲状态，未读取或判断最后/历史构建结果
- [ ] Job 759 空闲后已立即停止占用轮询并进入创建；繁忙时每 60 秒只使用一个定时器重新查询
- [ ] `job_busy_check_count` 未超过 30；查询失败或状态未知时未被当作空闲
- [ ] Zeus Job 占用检查已确认空闲，创建权已原子认领
- [ ] 每个 attempt 的 `mcp__zeus_app__zeusJobAction` 仅在 `allowed=true` 时调用一次，并记录了该 attempt 的唯一内部 Build ID
- [ ] 总构建尝试次数为 1～5 次，未超过 5 次
- [ ] 每次失败均有真实失败证据和根因分类；代码问题记录修复文件与修复 Commit，外部问题记录恢复证据
- [ ] 每次代码修复均已提交并推送；下一 attempt 使用已验证的最新远端 Commit、独立 claim ID 和独立 Build ID
- [ ] 已持续调用 `mcp__zeus_app__zeusGetBuildDetail` 查询当前 attempt 的同一 Build ID，最终获得明确成功终态
- [ ] Zeus `jobId=759`，构建分支和 Commit 与 `prepare` 记录完全一致
- [ ] `finalize` 返回 `ok=true`，Job、Build Number、状态和 APK/二维码/构建地址校验通过
- [ ] `openspec/changes/<change_id>/pack_result_info.json` 存在、非空、可解析
- [ ] `pack_result_info.json` 的 `jobId`、`buildId`、`jobName` 均来自本次 Zeus 构建，其中 `buildId` 使用 Build Number
- [ ] 未执行 Flutter、iOS Pod 或其他 App 的交付流程
- [ ] 除 5.1 准备交付和 5.4B 失败修复明确授权的改动、add、commit、push 外，未修改依赖、SDK、签名、Zeus Job 配置、Git 历史或未经确认的用户文件

第 5 次修改并构建后仍为失败终态时，必须将自动化构建任务标记 failed，禁止继续修改或触发第 6 次构建。

Job 759 连续 30 次查询均明确繁忙时，必须将当前阶段和自动化构建任务标记 failed，禁止触发构建。

除上述“5 次构建均失败”或“Job 759 连续 30 次繁忙”的 failed 终态外，以上任一项不满足，不得标记当前阶段完成，只能标记 blocked 或 pending。
