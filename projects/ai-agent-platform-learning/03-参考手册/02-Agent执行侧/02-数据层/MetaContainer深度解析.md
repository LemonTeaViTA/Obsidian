# MetaContainer 深度解析

> 任务元信息管理的核心模块，是整个 code-agent 多机协作的数据基础。

---

## 一、核心职责

MetaContainer 是任务元数据的**唯一管理者**，负责：

1. ✅ **存储任务的所有元信息**（30+ 字段）
2. ✅ **提供线程安全的读写接口**
3. ✅ **支持多机数据共享**（通过云端存储）
4. ✅ **管理任务版本号**（防止脏数据）
5. ✅ **上报任务所在机器IP**（实现任务路由）

---

## 二、数据结构：TaskMetadata（30+ 字段）

### 2.1 核心字段分类

```python
@dataclass
class TaskMetadata:
    # ========== 基础信息 ==========
    task_id: str                      # 任务ID（必填）
    dep_id: Optional[str]             # DEP任务ID
    dep_url: Optional[str]            # DEP任务URL
    created_at: Optional[str]         # 创建时间
    updated_at: Optional[str]         # 更新时间
    
    # ========== Git 仓库信息 ==========
    git_url: Optional[str]            # 主仓库URL
    branch: Optional[str]             # 工作分支
    base_branch: Optional[str]        # 基础分支（从该分支拉取工作分支）
    project_path: Optional[str]       # 项目本地路径
    dependent_git_urls: Optional[List[str]]  # 依赖仓库列表（多仓库支持）
    dependent_git_branch: Optional[str]      # 依赖仓库基础分支
    
    # ========== 文档信息 ==========
    prd_path: Optional[str]           # PRD文档路径
    tech_design_path: Optional[str]   # 技术方案文件路径
    
    # ========== UI 设计稿相关 ==========
    # Figma（已废弃 PAT 方案，现使用 OAuth）
    figma_file_key: Optional[str]             # 已废弃
    figma_pat: Optional[str]                  # 已废弃
    figma_oauth_access_token: Optional[str]   # Figma OAuth token（主要字段）
    figma_oauth_refresh_token: Optional[str]  # 用于刷新 token
    figma_oauth_expires_at: Optional[int]     # token 过期时间
    
    # MasterGo
    mastergo_link: Optional[str]      # MasterGo 链接
    
    # UI MCP 类型（'figma' 或 'mastergo'）
    ui_mcp_type: Optional[str]
    
    # ========== 工作流配置 ==========
    flow_type: Optional[str]          # 运行流程类型（frontend_common、backend等）
    template_id: Optional[str]        # 模版ID（用于获取命令模板）
    real_template_id: Optional[str]   # 真实模版ID（归一化前的原始值）
    model: Optional[str]              # 模型名称（claude-opus-4-8等）
    
    # ========== 用户信息 ==========
    user_name: Optional[str]          # 用户名称
    
    # ========== 测试工作流相关 ==========
    related_dev_task: Optional[str]   # 关联的开发任务ID
    project_name: Optional[str]       # 项目名称
    parent_requirement_id: Optional[str]  # 父需求ID
    case_set_id: Optional[str]        # 用例集ID
    app_id: Optional[str]             # 应用ID
    
    # ========== 功能开关 ==========
    enable_document_auto_upload: Optional[bool]  # 是否启用文档自动上报 hook
    enable_tdd: Optional[bool]                   # 是否启用 TDD 工作流
    is_apply: Optional[bool]                     # 是否为 apply 模式
    
    # ========== 领域 ==========
    domain: Optional[str]             # 领域字段
```

### 2.2 字段自动管理

```python
def __post_init__(self):
    """数据类初始化后的处理"""
    if self.created_at is None:
        self.created_at = datetime.now().isoformat()  # 自动设置创建时间
    self.updated_at = datetime.now().isoformat()      # 自动设置更新时间

def update_fields(self, **kwargs) -> bool:
    """更新指定字段，自动更新 updated_at"""
    updated = False
    for field_name, value in kwargs.items():
        if hasattr(self, field_name) and getattr(self, field_name) != value:
            setattr(self, field_name, value)
            updated = True
    
    if updated:
        self.updated_at = datetime.now().isoformat()  # 自动更新时间戳
    
    return updated
```

---

## 三、MetaContainer 核心实现

### 3.1 架构设计：纯云端存储

```python
class MetaContainer:
    """
    任务元信息容器
    所有操作直接读写云端API，不使用本地文件和内存缓存
    """
    
    def __init__(self):
        self._lock = threading.RLock()  # 递归锁，支持嵌套调用
        logger.info("MetaContainer 初始化完成（云端存储模式）")
```

**关键设计决策**：
- ❌ **不使用内存缓存**（与文档中描述的不同！）
- ✅ **直接读写云端**（保证数据一致性）
- ✅ **线程安全**（使用递归锁）

### 3.2 核心方法详解

#### （1）get() - 从云端读取任务元数据

```python
def get(self, task_id: str) -> Optional[TaskMetadata]:
    """获取任务元信息（从云端读取）"""
    with self._lock:
        try:
            from task_data_api import get_data_content, TaskDataType
            
            # 从云端读取
            metadata_dict = get_data_content(task_id, TaskDataType.TASK_METADATA)
            if metadata_dict is None:
                logger.info(f"任务 {task_id} 在云端不存在")
                return None
            
            # 🔥 跨版本兼容：过滤掉 TaskMetadata 不认识的字段
            valid_fields = {f.name for f in fields(TaskMetadata)}
            filtered_dict = {k: v for k, v in metadata_dict.items() if k in valid_fields}
            
            # 解析为 TaskMetadata 对象
            return TaskMetadata(**filtered_dict)
            
        except Exception as e:
            logger.error(f"从云端获取任务 {task_id} 元信息失败: {str(e)}", exc_info=True)
            return None
```

**关键点**：
- ✅ 直接从云端读取，无缓存
- ✅ 字段过滤，支持跨版本兼容
- ✅ 异常处理，返回 None 而不是抛出

#### （2）update() - 更新任务元数据到云端

```python
def update(self, task_id: str, **kwargs) -> bool:
    """更新任务元信息（保存到云端）"""
    with self._lock:
        try:
            from task_data_api import save_or_update, TaskDataType
            from dataclasses import asdict
            
            # 1. 先从云端读取现有数据
            metadata = self.get(task_id)
            if metadata is None:
                # 不存在则创建新的
                metadata = TaskMetadata(task_id=task_id)
            
            # 2. 更新字段
            update_fields = {}
            for field_name, value in kwargs.items():
                if value is not None:
                    update_fields[field_name] = value
            
            if update_fields:
                updated = metadata.update_fields(**update_fields)
                logger.info(f"任务 {task_id} 元信息已部分更新: {list(update_fields.keys())}")
            
            # 3. 保存到云端
            save_or_update(
                task_id=task_id,
                data_type=TaskDataType.TASK_METADATA,
                data=asdict(metadata)  # 转为字典
            )
            logger.info(f"成功保存任务 {task_id} 元信息到云端")
            
            return True
            
        except Exception as e:
            logger.error(f"更新任务 {task_id} 元信息失败: {str(e)}", exc_info=True)
            return False
```

**流程**：
```
读取云端数据 → 更新字段 → 保存回云端
```

#### （3）remove() - 删除任务元数据

```python
def remove(self, task_id: str) -> bool:
    """移除任务元信息（只删除云端数据）"""
    with self._lock:
        try:
            from task_data_api import delete, TaskDataType
            
            # 删除云端数据
            delete(task_id=task_id, data_type=TaskDataType.TASK_METADATA)
            logger.info(f"任务 {task_id} 元信息已从云端删除")
            return True
            
        except Exception as e:
            logger.error(f"删除任务 {task_id} 元信息失败: {str(e)}", exc_info=True)
            return False
```

#### （4）report_task() - 上报任务信息 ⭐ 重要

```python
def report_task(self, task_id: str) -> bool:
    """
    上报任务所在机器IP地址和任务版本号
    
    版本号规则：
    1. 如果远端版本号不存在，上报版本号为1
    2. 如果远端版本号存在，但本地版本号不存在，生成version+1并保存到本地和上报
    3. 如果两者都存在，保持不变（本地和远端应该一致）
    """
    try:
        from network_utils import get_local_ip
        from task_data_api import save_or_update, get_data_content, TaskDataType
        
        # 1. 上报机器IP
        local_ip = get_local_ip()
        save_or_update(
            task_id=task_id,
            data_type=TaskDataType.CONTAINER_IP,
            data=local_ip
        )
        logger.info(f"任务 {task_id} 的机器IP已上报: {local_ip}")
        
        # 2. 处理任务版本号
        version_file_path = PathManager.get_task_version_file_path(task_id)
        
        # 获取远端版本号
        remote_version_str = get_data_content(task_id, TaskDataType.TASK_VERSION)
        remote_version = int(remote_version_str) if remote_version_str else None
        
        # 获取本地版本号
        local_version = None
        if os.path.exists(version_file_path):
            with open(version_file_path, 'r') as f:
                local_version = int(f.read().strip())
        
        # 决定要上报的版本号
        if remote_version is None:
            version_to_report = 1  # 情况1: 首次上报
        elif local_version is None:
            version_to_report = remote_version + 1  # 情况2: 本地丢失，递增
        else:
            version_to_report = local_version  # 情况3: 保持一致
        
        # 3. 保存版本号到本地
        os.makedirs(os.path.dirname(version_file_path), exist_ok=True)
        with open(version_file_path, 'w') as f:
            f.write(str(version_to_report))
        
        # 4. 上报版本号到云端
        save_or_update(
            task_id=task_id,
            data_type=TaskDataType.TASK_VERSION,
            data=str(version_to_report)
        )
        logger.info(f"任务 {task_id} 版本号已上报: {version_to_report}")
        
        return True
        
    except Exception as e:
        logger.error(f"上报任务 {task_id} 失败: {str(e)}", exc_info=True)
        return False
```

**版本号机制的价值**：
- ✅ **防止脏数据**：版本号不匹配时可以检测到数据冲突
- ✅ **任务追踪**：记录任务在不同机器间的流转
- ✅ **恢复检测**：判断任务是否被其他机器接管

---

## 四、多机协作场景

### 4.1 任务初始化流程

```
机器A (10.0.1.100):
  1. 用户发起任务 (POST /task/perform)
     ↓
  2. main.py: init_task_project(task_id, dep_id)
     - 克隆代码到本地
     - 初始化 OpenSpec
     - 创建 TaskMetadata 对象
     ↓
  3. MetaContainer.update()
     - 保存任务元数据到云端
     {
       "task_id": "task_123",
       "dep_id": 12345,
       "git_url": "ssh://git@gitlab.vdian.net:60022/team/project.git",
       "branch": "feature/task_123",
       "project_path": "/tmp/projects/task_123/project",
       "prd_path": "/tmp/projects/task_123/prd.md",
       "flow_type": "backend",
       "template_id": "default",
       ...
     }
     ↓
  4. MetaContainer.report_task()
     - 上报机器IP: TaskDataType.CONTAINER_IP → "10.0.1.100"
     - 上报版本号: TaskDataType.TASK_VERSION → "1"
     ↓
  5. 数据写入 AI24 管理平台数据服务
```

### 4.2 任务查询流程（跨机器）

```
机器B (10.0.1.200):
  1. 用户发起查询 (POST /task/query)
     ↓
  2. main.py: TaskQueryResource.post()
     ↓
  3. MetaContainer.get(task_id)
     - 从云端读取任务元数据
     - 获得：git_url, branch, project_path, flow_type, template_id等
     ↓
  4. 检查本地是否有项目目录
     - 如果没有，根据 git_url 克隆代码
     - 如果有，验证版本号
     ↓
  5. ClaudeAgentSDKService.query()
     - 使用元数据中的配置执行任务
     ↓
  6. MetaContainer.report_task()
     - 更新机器IP: TaskDataType.CONTAINER_IP → "10.0.1.200"
     - 更新版本号: TaskDataType.TASK_VERSION → "2"
```

### 4.3 版本号机制示例

```
时间线：

T1: 机器A 初始化任务
    - remote_version: None
    - local_version: None
    → version_to_report = 1
    → 保存到本地文件和云端

T2: 机器B 查询任务
    - remote_version: 1
    - local_version: None (机器B首次接手)
    → version_to_report = 2
    → 保存到本地文件和云端

T3: 机器A 再次查询任务
    - remote_version: 2 (被机器B更新了)
    - local_version: 1 (本地旧版本)
    → 检测到版本不一致！可能需要重新同步代码
```

---

## 五、关键设计要点

### 5.1 为什么不使用内存缓存？

**代码实际情况**：
```python
# ❌ 文档中说有内存缓存：self._metadata = {}
# ✅ 实际代码：没有内存缓存，每次都读云端
```

**原因分析**：
1. **多机环境**：内存缓存会导致数据不一致
2. **实时性要求**：任务可能在不同机器间切换
3. **数据一致性优先**：宁可慢一点，也要保证数据准确

### 5.2 线程安全设计

```python
self._lock = threading.RLock()  # 递归锁

# 所有公共方法都使用锁
def get(self, task_id: str):
    with self._lock:
        # ...

def update(self, task_id: str, **kwargs):
    with self._lock:
        # 可能调用 self.get()，递归锁支持嵌套
        metadata = self.get(task_id)
        # ...
```

**为什么用递归锁（RLock）**：
- `update()` 方法内部会调用 `get()` 方法
- 两者都需要获取锁
- 普通锁会导致死锁，递归锁允许同一线程多次获取

### 5.3 跨版本兼容性

```python
# 🔥 过滤掉 TaskMetadata 不认识的字段
valid_fields = {f.name for f in fields(TaskMetadata)}
filtered_dict = {k: v for k, v in metadata_dict.items() if k in valid_fields}
```

**场景**：
- 老版本代码：只有 20 个字段
- 新版本代码：有 30 个字段
- 云端数据：可能包含新字段或旧字段

**解决方案**：
- ✅ 读取时过滤，只保留当前版本认识的字段
- ✅ 写入时完整保存，避免数据丢失

---

## 六、使用示例

### 6.1 初始化任务时保存元数据

```python
from meta_container import MetaContainer

container = MetaContainer()

# 保存任务元数据
container.update(
    task_id="task_123",
    dep_id="12345",
    git_url="ssh://git@gitlab.vdian.net:60022/team/project.git",
    branch="feature/task_123",
    project_path="/tmp/projects/task_123/project",
    prd_path="/tmp/projects/task_123/prd.md",
    flow_type="backend",
    template_id="default",
    model="claude-opus-4-8",
    user_name="张三"
)

# 上报机器IP和版本号
container.report_task("task_123")
```

### 6.2 查询任务时读取元数据

```python
# 读取任务元数据
metadata = container.get("task_123")

if metadata is None:
    print("任务不存在")
else:
    print(f"Git URL: {metadata.git_url}")
    print(f"分支: {metadata.branch}")
    print(f"项目路径: {metadata.project_path}")
    print(f"流程类型: {metadata.flow_type}")
    print(f"模型: {metadata.model}")
```

### 6.3 更新部分字段

```python
# 只更新特定字段
container.update(
    task_id="task_123",
    enable_tdd=True,  # 启用 TDD
    is_apply=False    # 不是 apply 模式
)
```

### 6.4 删除任务元数据

```python
# 任务完成后清理
container.remove("task_123")
```

---

## 七、与其他模块的关系

```
MetaContainer（任务元数据）
    ↓ 依赖
task_data_api（云存储API）
    ↓ 依赖
AI24 管理平台结构化数据服务

其他模块依赖 MetaContainer：
    - main.py（任务初始化）
    - claude_agent_sdk_wrapper.py（获取配置）
    - commands_container.py（获取template_id）
    - 等等...
```

---

## 八、总结

### 核心价值

1. **任务元数据的唯一来源**：所有模块都通过 MetaContainer 读取任务信息
2. **多机协作的基础**：通过云端存储实现数据共享
3. **版本管理**：通过版本号机制追踪任务流转
4. **线程安全**：支持并发访问

### 关键设计

- ✅ **纯云端存储**：不使用内存缓存，保证数据一致性
- ✅ **递归锁**：支持方法间嵌套调用
- ✅ **跨版本兼容**：字段过滤机制
- ✅ **版本号机制**：防止脏数据，追踪任务流转

### 最佳实践

1. **初始化时立即保存**：`update()` + `report_task()`
2. **查询时先检查存在性**：`contains()` 或 `get() is None`
3. **更新时只传需要更新的字段**：避免覆盖其他字段
4. **任务完成后清理**：`remove()` 释放存储空间

---

**学习日期**：2026-07-08  
**模块重要度**：⭐⭐⭐⭐⭐（最核心）  
**代码行数**：767 行  
**理解程度**：95%+

MetaContainer 是 code-agent 多机协作的"大脑记忆"，理解它就理解了整个系统的数据流！🎯
