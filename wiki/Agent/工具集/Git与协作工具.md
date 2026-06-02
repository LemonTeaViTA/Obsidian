---
module: Agent
tags: [Agent, Coding Agent, Tool Use, Git, Collaboration]
difficulty: medium
last_reviewed: 2026-06-01
---

# Git与协作工具

> Git与协作工具让 Agent 不只是改代码，还能管理版本、提交 PR、审查代码。本文详解 git_* / create_project / install_dependency 等工具的实现与最佳实践。

---

## 一、工具清单

| 工具 | 作用 | 安全等级 |
|------|------|---------|
| ==`git_status`== | 查看当前状态 | ✓ 安全 |
| ==`git_diff`== | 查看改动 | ✓ 安全 |
| ==`git_commit`== | 提交改动 | ⚠️ 需确认 |
| ==`git_push`== | 推送到远程 | ⚠️ 高危 |
| ==`git_create_branch`== | 创建分支 | ✓ 安全 |
| ==`create_project`== | 初始化新项目 | ✓ 安全 |
| ==`install_dependency`== | 安装依赖 | ⚠️ 中危 |
| ==`create_pr`== / ==`create_mr`== | 创建 Pull Request | ⚠️ 需确认 |

---

## 二、Git 操作工具

### 2.1 git_status：查看当前状态

==最常用的 Git 工具==——查看哪些文件被修改了。

```python
def git_status() -> dict:
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True,
        text=True
    )
    
    # 解析输出
    changes = []
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        status = line[0:2].strip()
        file_path = line[3:]
        changes.append({
            "status": status,  # M=modified, A=added, D=deleted, ??=untracked
            "file": file_path
        })
    
    return {"changes": changes}
```

==返回示例==：

```json
{
  "changes": [
    {"status": "M", "file": "src/auth.py"},
    {"status": "A", "file": "tests/test_auth.py"},
    {"status": "??", "file": "config.local.json"}
  ]
}
```

### 2.2 git_diff：查看改动内容

==查看具体改了什么==：

```python
def git_diff(file_path: str = None) -> str:
    cmd = ["git", "diff"]
    if file_path:
        cmd.append(file_path)
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout[:5000]  # 截断防止超长
```

==返回示例==：

```diff
diff --git a/src/auth.py b/src/auth.py
index 1234567..abcdefg 100644
--- a/src/auth.py
+++ b/src/auth.py
@@ -10,7 +10,7 @@ def authenticate(user, password):
-    return user == "admin"
+    return check_hash(user, password)
```

### 2.3 git_commit：提交改动

==核心工作流==：

```
LLM: 改了几个文件
   ↓
LLM: git_status() → 看到改动
   ↓
LLM: git_diff() → 确认改动正确
   ↓
LLM: git_commit(message="Fix authentication bug", files=["src/auth.py"])
```

==实现==：

```python
def git_commit(message: str, files: list[str] = None) -> dict:
    # 先 add
    if files:
        for f in files:
            subprocess.run(["git", "add", f])
    else:
        subprocess.run(["git", "add", "-A"])  # 全部文件
    
    # 再 commit
    result = subprocess.run(
        ["git", "commit", "-m", message],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        return {"status": "success", "message": message}
    else:
        return {"error": result.stderr}
```

==安全设计：必须用户确认==

==生产环境不应该让 Agent 自动 commit==——必须经过确认：

```python
def git_commit(message: str, files: list[str] = None) -> dict:
    # 显示将要提交的内容
    preview = git_diff()
    
    raise ConfirmationRequired(
        f"Agent wants to commit:\n"
        f"Message: {message}\n"
        f"Files: {', '.join(files) if files else 'all'}\n\n"
        f"Diff:\n{preview[:500]}\n\n"
        f"Confirm?"
    )
```

详见 [[Agent 工程实践#Human-in-the-Loop]]。

### 2.4 git_push：推送到远程

==最危险的 Git 操作==——一旦 push 就影响其他人。

```python
def git_push(branch: str = None, force: bool = False) -> dict:
    cmd = ["git", "push"]
    
    if branch:
        cmd.extend(["origin", branch])
    
    if force:
        raise PermissionError("Force push is not allowed")
    
    # 必须确认
    raise ConfirmationRequired(
        f"Agent wants to push to remote branch '{branch or 'current'}'. "
        f"This will affect other developers. Confirm?"
    )
```

==推荐策略==：

| 场景 | 策略 |
|------|------|
| 个人分支 | 允许（可选确认） |
| 共享分支（dev / staging） | ==必须确认== |
| 主分支（main / master） | ==禁止==（Agent 不应直接 push） |

### 2.5 git_create_branch：创建分支

==Agent 应该在新分支上工作==：

```python
def git_create_branch(branch_name: str, base: str = "main") -> dict:
    # 确保基分支是最新的
    subprocess.run(["git", "fetch", "origin", base])
    
    # 创建并切换到新分支
    subprocess.run(["git", "checkout", "-b", branch_name, f"origin/{base}"])
    
    return {"status": "success", "branch": branch_name}
```

==推荐命名规范==：

```python
def generate_branch_name(task_description: str) -> str:
    # agent/fix-auth-bug-20260601-143022
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    slug = re.sub(r'[^a-z0-9]+', '-', task_description.lower())[:30]
    return f"agent/{slug}-{timestamp}"
```

---

## 三、项目初始化工具

### 3.1 create_project：初始化新项目

==`create_project` 不是单独工具==——而是 ==`execute_command` + `write_file` 的组合==。

==LLM 思考流程==：

```
用户: 创建一个 React + TypeScript 项目
   ↓
LLM: execute_command("npx create-react-app my-app --template typescript")
   ↓ 脚手架自动生成所有文件
LLM: read_file("my-app/package.json") → 确认生成成功
   ↓
LLM: write_file("my-app/src/App.tsx", "...") → 改写部分文件
   ↓
LLM: execute_command("cd my-app && npm install") → 安装依赖
```

==这就是 ReAct + 工具组合的力量==——LLM 自己规划怎么用基础工具组合完成大任务。

### 3.2 常见脚手架命令

| 生态 | 命令 |
|------|------|
| React | `npx create-react-app <name>` |
| Next.js | `npx create-next-app <name>` |
| Vue | `npm create vue@latest` |
| Python | `poetry new <name>` |
| Rust | `cargo new <name>` |
| Go | `go mod init <module>` |
| Java Spring | `curl start.spring.io/starter.zip -d dependencies=web,jpa` |

### 3.3 项目模板定制

==企业内部通常有自己的项目模板==：

```python
def create_project(name: str, template: str = "default") -> dict:
    # 从企业模板仓库克隆
    template_url = f"git@github.com:company/templates/{template}.git"
    
    subprocess.run(["git", "clone", template_url, name])
    
    # 替换占位符
    replace_in_files(
        path=name,
        old="{{PROJECT_NAME}}",
        new=name
    )
    
    return {"status": "success", "path": name}
```

---

## 四、依赖管理工具

### 4.1 install_dependency：安装依赖

==根据项目类型自动选择包管理器==：

```python
def install_dependency(package: str, dev: bool = False) -> dict:
    # Node.js
    if os.path.exists("package.json"):
        cmd = f"npm install {package}"
        if dev:
            cmd += " --save-dev"
        return execute_command(cmd)
    
    # Python
    if os.path.exists("requirements.txt") or os.path.exists("pyproject.toml"):
        cmd = f"pip install {package}"
        return execute_command(cmd)
    
    # Rust
    if os.path.exists("Cargo.toml"):
        cmd = f"cargo add {package}"
        return execute_command(cmd)
    
    # Go
    if os.path.exists("go.mod"):
        cmd = f"go get {package}"
        return execute_command(cmd)
    
    raise ValueError("Cannot detect package manager")
```

### 4.2 安全风险：依赖投毒

==Agent 安装的依赖可能是恶意的==：

```python
# ❌ 危险：LLM 可能被诱导安装恶意包
install_dependency("reqeusts")  # 注意拼写错误（typosquatting）
install_dependency("numpy-dev")  # 伪装成开发版的恶意包
```

==防御措施==：

1. **包名白名单**——只允许安装常见的知名包
2. **Typo 检测**——检测是否是常见包的拼写错误
3. **Human-in-the-Loop**——安装依赖前确认

```python
KNOWN_PACKAGES = {
    "python": {"requests", "numpy", "pandas", "flask", "django", ...},
    "node": {"react", "express", "lodash", "axios", ...}
}

TYPO_MAP = {
    "reqeusts": "requests",
    "numppy": "numpy",
    "reactt": "react"
}

def install_dependency(package: str) -> dict:
    lang = detect_language()
    
    # 检测 typo
    if package in TYPO_MAP:
        suggestion = TYPO_MAP[package]
        raise ConfirmationRequired(
            f"Did you mean '{suggestion}'? "
            f"'{package}' might be a typosquatting package."
        )
    
    # 检测未知包
    if package not in KNOWN_PACKAGES.get(lang, set()):
        raise ConfirmationRequired(
            f"'{package}' is not in the known package list. "
            f"Install anyway?"
        )
    
    # 正常安装
    return execute_command(...)
```

详见 [[Agent 安全模型#依赖投毒防御]]。

---

## 五、Pull Request / Code Review 工具

### 5.1 create_pr：创建 Pull Request

==通过 GitHub CLI / GitLab CLI 创建 PR==：

```python
def create_pr(title: str, body: str = "", base: str = "main") -> dict:
    # 先确保已 push
    current_branch = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True,
        text=True
    ).stdout.strip()
    
    # GitHub CLI
    if is_github_repo():
        cmd = [
            "gh", "pr", "create",
            "--title", title,
            "--body", body,
            "--base", base
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # 提取 PR URL
        pr_url = re.search(r'https://github.com/[^\s]+', result.stdout)
        return {"status": "success", "url": pr_url.group(0) if pr_url else None}
    
    # GitLab CLI
    elif is_gitlab_repo():
        cmd = [
            "glab", "mr", "create",
            "--title", title,
            "--description", body,
            "--target-branch", base
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return {"status": "success"}
    
    raise ValueError("Unsupported Git platform")
```

### 5.2 PR 标题与描述的生成

==Agent 应该自动生成高质量的 PR 描述==：

```python
def generate_pr_description(changed_files: list[str]) -> dict:
    # 收集改动信息
    diff = git_diff()
    commit_messages = subprocess.run(
        ["git", "log", "--oneline", "origin/main..HEAD"],
        capture_output=True,
        text=True
    ).stdout
    
    # 让 LLM 总结
    prompt = f"""
    Based on the following changes, generate a PR title and description:
    
    Changed files: {', '.join(changed_files)}
    Commits: {commit_messages}
    Diff (first 1000 chars): {diff[:1000]}
    
    Format:
    Title: <50 chars, clear and concise>
    Description:
    - What changed
    - Why it changed
    - How to test
    """
    
    response = llm.complete(prompt)
    
    # 解析 LLM 输出
    title = re.search(r'Title: (.+)', response).group(1)
    description = re.search(r'Description:\n(.+)', response, re.DOTALL).group(1)
    
    return {"title": title, "description": description}
```

### 5.3 推荐 PR 工作流

```
1. LLM: git_create_branch("agent/fix-auth-bug-...")
2. LLM: 修改代码（write_file / edit_file）
3. LLM: run_test() → 确保测试通过
4. LLM: git_commit("Fix authentication bug")
5. LLM: git_push()  ← 需用户确认
6. LLM: create_pr(title="Fix auth bug", body="...")  ← 需用户确认
7. 用户: 在 GitHub 上 review + merge
```

### 5.4 Code Review 工具（高级）

==让 Agent 自动做 Code Review==：

```python
def review_pr(pr_number: int) -> dict:
    # 获取 PR 的 diff
    result = subprocess.run(
        ["gh", "pr", "diff", str(pr_number)],
        capture_output=True,
        text=True
    )
    diff = result.stdout
    
    # 让 LLM 审查
    prompt = f"""
    Review this code change and identify:
    1. Potential bugs
    2. Security issues
    3. Performance problems
    4. Style inconsistencies
    
    Diff:
    {diff[:5000]}
    """
    
    review = llm.complete(prompt)
    
    # 发布 review comment
    subprocess.run([
        "gh", "pr", "review", str(pr_number),
        "--comment", "--body", review
    ])
    
    return {"status": "reviewed"}
```

==实际产品==：
- ==GitHub Copilot Workspace== — 自动生成 PR
- ==Codium PR-Agent== — 自动 review PR
- ==Bito Code Review== — AI 驱动的 code review

---

## 六、项目操作工具（高级）

### 6.1 refactor_rename：全项目改名

==跨文件重命名变量/函数/类==：

```python
def refactor_rename(
    symbol: str,
    new_name: str,
    scope: str = "."
) -> dict:
    # 方式1：用 LSP 的 rename
    lsp_client.send_request(
        method="textDocument/rename",
        params={
            "textDocument": {"uri": f"file://{file_path}"},
            "position": {"line": line, "character": char},
            "newName": new_name
        }
    )
    
    # 方式2：用 grep + edit_file
    # 找到所有出现
    matches = grep(symbol, scope)
    
    # 逐个替换
    for match in matches:
        edit_file(
            path=match["file"],
            old_string=symbol,
            new_string=new_name
        )
    
    return {"status": "renamed", "files_changed": len(matches)}
```

==LSP 方式更准确==——能区分同名的不同符号（如局部变量 vs 全局变量）。

### 6.2 update_dependency：升级依赖

```python
def update_dependency(package: str, version: str = "latest") -> dict:
    # Node.js
    if os.path.exists("package.json"):
        cmd = f"npm install {package}@{version}"
        return execute_command(cmd)
    
    # Python
    if os.path.exists("requirements.txt"):
        # 更新 requirements.txt
        with open("requirements.txt", "r") as f:
            lines = f.readlines()
        
        new_lines = []
        for line in lines:
            if line.startswith(package):
                new_lines.append(f"{package}=={version}\n")
            else:
                new_lines.append(line)
        
        with open("requirements.txt", "w") as f:
            f.writelines(new_lines)
        
        return execute_command(f"pip install -r requirements.txt")
    
    raise ValueError("Cannot detect package manager")
```

---

## 七、工具实现量级

| 工具 | 实现量级 |
|------|---------|
| `git_status` | 10 行（subprocess + 解析） |
| `git_diff` | 5 行（subprocess） |
| `git_commit` | 15 行（git add + commit） |
| `git_push` | 10 行 + 确认机制 |
| `create_pr` | 30 行（调用 gh / glab CLI） |
| `install_dependency` | 40 行（多语言检测） |
| `refactor_rename` | 50 行（LSP 调用或 grep+edit） |

==核心就是调用 git / gh / npm / pip 命令==——没有复杂逻辑。

---

## 八、最佳实践

### 8.1 Git 操作的安全清单

==上线前必须确认==：

- [ ] `git_commit` 需用户确认
- [ ] `git_push` 禁止 force push
- [ ] `git_push` 到主分支必须拦截
- [ ] 自动创建分支（不在 main 上直接改）
- [ ] PR 创建前运行测试

### 8.2 推荐工作流

==Agent 应该遵循标准的 Git 工作流==：

```
1. 基于 main 创建新分支
2. 在新分支上修改代码
3. 运行测试确保通过
4. Commit（需确认）
5. Push 到远程分支（需确认）
6. 创建 PR（需确认）
7. 用户 review + merge
```

==不推荐==：
- ❌ 直接在 main 上改
- ❌ 不跑测试就 commit
- ❌ 自动 force push

### 8.3 企业定制

==不同公司有不同的流程==：

| 流程 | 定制点 |
|------|--------|
| 分支命名 | `feature/*` / `bugfix/*` / `agent/*` |
| Commit message | 必须包含 Jira 号 / 格式检查 |
| PR 模板 | 必须填 "测试方法" / "影响范围" |
| Code review | 必须至少 2 人 approve |

==通过 system prompt 或 Skill 注入这些规范==。

---

## 相关链接

- [[Coding Agent 工具集_MOC]] — 工具集总索引
- [[文件操作工具]] — Read / Write / Edit
- [[执行与调试工具]] — execute_command / run_test
- [[Agent 安全模型]] — 依赖投毒防御 / HITL
- [[Agent 工程实践]] — Git 工作流最佳实践
- [[Function Calling]] — 工具调用协议
