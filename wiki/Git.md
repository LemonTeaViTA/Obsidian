---
module: 工具
tags: [Git]
difficulty: easy
last_reviewed: 2026-07-22
---

# Git 常用命令

## 日常开发流程

```bash
git init                                    # 初始化仓库
git config --local user.name "名字"         # 设置用户名（仅当前仓库）
git config --local user.email "邮箱"        # 设置邮箱（仅当前仓库）
git remote add origin 仓库地址              # 关联远程仓库
git remote -v                               # 查看远程仓库
```

## 分支管理

```bash
git branch                                  # 查看本地所有分支
git branch -a                               # 查看包括远程的所有分支
git checkout -b feature/功能名             # 创建并切换到新分支
git checkout main                           # 切换回 main
git merge feature/功能名                    # 把某分支合并到当前分支
git branch -d feature/功能名               # 删除本地分支（合并后清理）
git push origin --delete feature/功能名    # 删除远程分支
```

## 同步远程

```bash
git pull                                    # 拉取并合并远程最新代码
git fetch                                   # 只拉取不合并
git clone 仓库地址                          # 克隆仓库
```

## 查看历史

```bash
git log --oneline                           # 简洁提交历史
git log --oneline --graph                   # 带分支图的历史
```

## 撤销

```bash
git restore 文件名                          # 撤销未暂存的改动
git restore --staged 文件名                 # 取消暂存
git revert HEAD                             # 安全撤销最后一次提交（会新增一条记录）
git reset --hard HEAD~1                     # 强制回退到上一个提交（危险，会丢失改动）
```

## 从 git 追踪中移除

```bash
# 保留本地文件
git rm --cached 文件名                  # 移除单个文件
git rm --cached -r 目录名/              # 移除整个目录
```

## 检查 gitignore

```bash
git check-ignore -v 文件名              # 会告诉你是哪条规则忽略了它
```

## 标准工作流

### 单任务分支流程

```bash
# 1. 开始新功能
git checkout -b xxx

# 2. 开发 → 提交
git add .
git commit -m "XXX"
# 想要修改commit，可以通过
git commit --amend -m "XXX"
git push -u origin xxx

# 3. GitHub 上发 PR → 审核 → 合并

# 4. 本地同步
git checkout main
git pull
git branch -d feature/xxx   # 清理旧分支
```

### AI 并行开发工作流

> [!tip] 核心边界
> 分支只隔离提交历史，同一工作目录一次仍只能检出一个分支。真正同时运行多个 AI 开发任务，应使用**每个任务一个分支 + 一个独立 worktree**。

#### 1. 确认干净基线

```bash
git switch main
git status --short                         # 应无未提交改动
git log -1 --oneline                       # 记录并行任务的共同起点
```

#### 2. 为独立任务创建 worktree

```bash
git worktree add ../project-task-a -b ai/task-a main
git worktree add ../project-task-b -b ai/task-b main
git worktree list
```

在 `project-task-a` 和 `project-task-b` 中分别启动 AI 开发任务。两个任务应有独立验收标准，并尽量避免同时修改相同核心文件。

#### 3. 用小提交保存 checkpoint

```bash
git status --short
git diff --check
git add <本任务的文件>
git commit -m "feat: complete task a checkpoint"
```

checkpoint 应对应一个可解释、可测试、可回退的小步，不要等到整个长任务结束才第一次提交。

#### 4. 逐个合并并重新验证

```bash
git switch main
git merge --no-ff ai/task-a
# 运行项目测试
git merge --no-ff ai/task-b
# 再次运行项目测试
```

> [!warning] 不适合并行的任务
> 高耦合重构、共享 schema 变更、同一核心文件的大量修改，应优先串行完成公共接口，再分配并行任务。否则并行节省的时间很可能会被合并冲突抵消。

任务合并并确认不再需要独立工作区后，再执行：

```bash
git worktree remove ../project-task-a
git worktree remove ../project-task-b
git branch -d ai/task-a
git branch -d ai/task-b
```

这套流程的核心是：**分支提供变更边界，worktree 提供并行空间，commit 提供可追溯 checkpoint，测试提供合并信心**。
