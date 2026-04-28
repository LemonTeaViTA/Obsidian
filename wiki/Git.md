#日常开发流程
git init                                    # 初始化仓库
git config --local user.name "名字"         # 设置用户名（仅当前仓库）
git config --local user.email "邮箱"        # 设置邮箱（仅当前仓库）
git remote add origin 仓库地址              # 关联远程仓库
git remote -v                               # 查看远程仓库


#分支管理
git branch                                  # 查看本地所有分支
git branch -a                               # 查看包括远程的所有分支
git checkout -b feature/功能名             # 创建并切换到新分支
git checkout main                           # 切换回 main
git merge feature/功能名                    # 把某分支合并到当前分支
git branch -d feature/功能名               # 删除本地分支（合并后清理）
git push origin --delete feature/功能名    # 删除远程分支


#同步远程
git pull                                    # 拉取并合并远程最新代码
git fetch                                   # 只拉取不合并
git clone 仓库地址                          # 克隆仓库

#查看历史
git log --oneline                           # 简洁提交历史
git log --oneline --graph                   # 带分支图的历史

#撤销
git restore 文件名                          # 撤销未暂存的改动
git restore --staged 文件名                 # 取消暂存
git revert HEAD                             # 安全撤销最后一次提交（会新增一条记录）
git reset --hard HEAD~1                     # 强制回退到上一个提交（危险，会丢失改动）

#从 git 追踪中移除（保留本地文件）
git rm --cached 文件名                  # 移除单个文件
git rm --cached -r 目录名/              # 移除整个目录

#检查某个文件是否会被 .gitignore 忽略
git check-ignore -v 文件名              # 会告诉你是哪条规则忽略了它


# 1. 开始新功能
git checkout -b xxx

# 2. 开发 → 提交
git add .
git commit -m "XXX"
git push -u origin xxx

# 3. GitHub 上发 PR → 审核 → 合并

# 4. 本地同步
git checkout main
git pull
git branch -d feature/xxx   # 清理旧分支
