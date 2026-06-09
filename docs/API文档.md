# MechSim 后端 API 接口文档

> 基础路径: `http://{host}:8000/api/v1/sim`
> 认证方式: 请求头 `X-User` 携带用户名

---

## 通用响应格式

```json
{
  "success": true,        // bool, 请求是否成功
  "message": "操作成功",   // string, 提示信息
  "data": { ... }         // object | null, 响应数据
}
```

---

## 一、用例管理 (Case)

### 1.1 创建用例

`POST /add_case`

**请求体 (JSON):**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | 用例名称 |
| description | string | 否 | 用例描述 |
| create_by | string | 是 | 创建者用户名 |
| sys_name | string | 是 | 系统名称 |
| model_name | string | 是 | 模型名称 |
| model_verison | string | 是 | 模型版本 |
| model_productivity | string | 是 | 产率 |
| model_param | string | 是 | 模型参数 JSON 字符串 |
| disturbance | string | 否 | 扰动配置 JSON 字符串 |
| sim_time | float | 否 | 仿真时间 (秒) |
| sim_step | float | 否 | 仿真步长 |

**请求示例:**
```json
{
  "name": "测试用例1",
  "description": "验证基础仿真流程",
  "create_by": "user1",
  "sys_name": "SysA",
  "model_name": "ModelX",
  "model_verison": "3X",
  "model_productivity": "100WPH",
  "model_param": "{\"SysA\":{\"param1\":1.0}}",
  "disturbance": "",
  "sim_time": 10.0,
  "sim_step": 0.01
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "用例创建成功",
  "data": { "id": 1 }
}
```

---

### 1.2 删除用例

`DELETE /delete_case/{id}`

**请求头:** `X-User` (只有创建者可删除)

**路径参数:**

| 参数 | 类型 | 说明 |
|---|---|---|
| id | int | 用例 ID |

**响应示例:**
```json
{
  "success": true,
  "message": "用例删除成功"
}
```

---

### 1.3 更新用例

`PUT /update_case/{id}`

**请求头:** `X-User` (只有创建者可修改)

**路径参数:**

| 参数 | 类型 | 说明 |
|---|---|---|
| id | int | 用例 ID |

**请求体:** 同 `AddCaseRequest`（所有字段均可更新）

**响应示例:**
```json
{
  "success": true,
  "message": "用例更新成功"
}
```

---

### 1.4 查询用例列表

`GET /queue_cases`

**请求头:** `X-User` (返回自己创建的 + 共享给自己的)

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "测试用例1",
      "description": "验证基础仿真流程",
      "create_by": "user1",
      "sys_name": "SysA",
      "model_name": "ModelX",
      "model_verison": "3X",
      "model_productivity": "100WPH",
      "model_param": "{\"SysA\":{\"param1\":1.0}}",
      "disturbance": "",
      "sim_time": 10.0,
      "sim_step": 0.01,
      "create_time": "2025-01-01T00:00:00"
    }
  ]
}
```

---

### 1.5 对比参数差异

`POST /diff_case/{id}`

**说明:** 将用例的 model_param 与系统默认参数进行对比，返回 DeepDiff 差异结果。

**路径参数:**

| 参数 | 类型 | 说明 |
|---|---|---|
| id | int | 用例 ID |

**请求体:**

| 字段 | 类型 | 说明 |
|---|---|---|
| sys_name | string | 系统名称 |
| model_param | string | 模型参数 JSON 字符串 |

**响应示例:**
```json
{
  "success": true,
  "data": {
    "values_changed": {
      "root['param1']": {
        "new_value": 2.0,
        "old_value": 1.0
      }
    }
  }
}
```

---

## 二、用例共享 (Share)

### 2.1 共享用例

`POST /share_case/{id}`

**请求头:** `X-User` (只有创建者可共享)

**路径参数:**

| 参数 | 类型 | 说明 |
|---|---|---|
| id | int | 用例 ID |

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| shared_to_user | string | 是 | 要共享给的用户名 |

**响应示例:**
```json
{
  "success": true,
  "message": "共享成功"
}
```

---

### 2.2 取消共享

`POST /unshare_case/{id}`

**请求头:** `X-User` (只有创建者可操作)

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| shared_to_user | string | 是 | 要取消共享的用户名 |

**响应示例:**
```json
{
  "success": true,
  "message": "已取消共享"
}
```

---

### 2.3 查看共享列表

`GET /case_shares/{id}`

**请求头:** `X-User` (只有创建者可查看)

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "case_id": 1,
      "shared_to_user": "user2"
    }
  ]
}
```

---

## 三、任务管理 (Task)

### 3.1 创建任务

`POST /add_tasks`

**说明:** 为一个用例创建仿真任务。后端自动计算用例参数与系统默认参数的差异。

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| case_id | int | 是 | 用例 ID |
| param_diff | string | 否 | 参数差异 JSON (后端会自动计算) |

**响应示例:**
```json
{
  "success": true,
  "message": "任务创建成功",
  "data": { "task_ids": [1] }
}
```

---

### 3.2 查询任务列表

`GET /queue_tasks`

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "测试用例1",
      "case_id": 1,
      "sys_name": "SysA",
      "model_name": "ModelX",
      "model_version": "3X",
      "model_productivity": "100WPH",
      "param_diff": "{...}",
      "disturbance": "",
      "sim_time": 10.0,
      "sim_step": 0.01,
      "status": "done",
      "result": null,
      "error": null,
      "create_time": "2025-01-01T00:00:00"
    }
  ]
}
```

**任务状态说明:**

| 状态 | 说明 |
|---|---|
| pending | 等待中 |
| running | 运行中 |
| done | 已完成 |
| failed | 失败 |
| cancelled | 已取消 |

---

### 3.3 删除任务

`DELETE /delete_task/{id}`

**路径参数:**

| 参数 | 类型 | 说明 |
|---|---|---|
| id | int | 任务 ID |

---

### 3.4 运行任务

`POST /run_tasks`

**说明:** 将待执行的任务提交到 MATLAB 引擎池开始仿真。

**请求体:**

| 字段 | 类型 | 说明 |
|---|---|---|
| task_ids | int[] | 要运行的任务 ID 列表 |

**响应示例:**
```json
{
  "success": true,
  "message": "任务已提交",
  "data": { "submitted": [1, 2] }
}
```

---

### 3.5 查询任务状态

`GET /get_task_status/{task_id}`

**响应示例:**
```json
{
  "success": true,
  "data": {
    "task_id": 1,
    "status": "running",
    "result": null,
    "error": null
  }
}
```

---

### 3.6 取消任务

`POST /cancel_task/{task_id}`

**说明:** 强制终止仿真，杀掉对应 MATLAB 进程。

**响应示例:**
```json
{
  "success": true,
  "message": "任务已取消",
  "data": { "task_id": 1, "cancelled": true }
}
```

---

### 3.7 测试任务 (仅调试)

`POST /run_task_test`

**说明:** 使用假数据提交一个测试任务（task_id 为负数），用于调试 MATLAB 引擎。

**响应示例:**
```json
{
  "success": true,
  "message": "测试任务已提交",
  "data": { "task_id": -1718000000000 }
}
```

---

## 四、任务数据 (Task Data)

### 4.1 获取数据列名

`GET /task_data/{task_id}?names_only=true`

**查询参数:**

| 参数 | 类型 | 说明 |
|---|---|---|
| names_only | bool | 仅返回信号名称列表 |

**响应示例:**
```json
{
  "success": true,
  "data": {
    "column_names": ["signal1", "signal2"],
    "fft_column_names": ["signal1", "signal2"],
    "task_status": "done"
  }
}
```

---

### 4.2 获取信号数据

`POST /task_data/{task_id}/signals`

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| signal_names | string[] | 是 | 信号名称列表 |
| domain | "time"\|"fft" | 否 | 时域或频域，默认 "time" |
| start | float | 否 | x 轴范围起始 (缩放) |
| end | float | 否 | x 轴范围结束 (缩放) |
| raw | bool | 否 | 跳过降采样，返回原始数据 |

**请求示例:**
```json
{
  "signal_names": ["signal1", "signal2"],
  "domain": "time",
  "start": 0.0,
  "end": 5.0,
  "raw": false
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "columns": [
      { "name": "time", "data": [0.0, 0.01, 0.02, ...] },
      { "name": "signal1", "data": [1.0, 1.2, 1.5, ...] },
      { "name": "signal2", "data": [0.5, 0.6, 0.8, ...] }
    ]
  }
}
```

> **降采样机制:** 每个信号超过 20000 点时自动均匀降采样，确保前端渲染性能。传 `raw: true` 获取原始数据。

---

## 五、模型信息 (Model Info)

### 5.1 构建模型信息

`POST /update_model_info`

**说明:** 扫描 SYS_ROOT 下的 MechSimConfig.xlsx 和参数 Excel 文件，生成 model_info.json。

**响应示例:**
```json
{
  "success": true,
  "message": "模型信息已更新",
  "data": { "path": "/data/sysroot/model_info.json" }
}
```

---

### 5.2 获取模型信息

`POST /queue_model_info`

**说明:** 读取已生成的 model_info.json，返回所有系统的模型信息。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "SysA": {
      "Model": "aa.slx",
      "variables": {
        "param_group": {
          "param1": 1.0,
          "param2": 2.0,
          "_labels": { "param1": "参数1" },
          "_units": { "param1": "m/s" }
        }
      }
    }
  }
}
```

---

### 5.3 获取模型图片

`GET /model_image/{sys_name}`

**说明:** 在 SYS_ROOT 中递归查找系统配置的 PictureFile 图片并返回。

**路径参数:**

| 参数 | 类型 | 说明 |
|---|---|---|
| sys_name | string | 系统名称 |

**响应:** 图片二进制流 (Content-Type: image/png 等)

---

## 六、扰动数据 (Disturbance)

### 6.1 获取扰动目录树

`GET /queue_disturbances`

**说明:** 扫描 DISTURBANCE_ROOT/data_raw 目录，返回 Excel/CSV 文件的目录树。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "dirs": {
      "GroupA": {
        "files": [
          { "name": "dist1.xlsx", "path": "/data/disturb/data_raw/GroupA/dist1.xlsx" }
        ]
      }
    }
  }
}
```

---

### 6.2 读取扰动文件数据

`POST /get_disturbance_info`

**请求体:**

| 字段 | 类型 | 说明 |
|---|---|---|
| file_path | string | 文件绝对路径 |

**响应示例:**
```json
{
  "success": true,
  "data": {
    "columns": [
      { "name": "time", "data": [0.0, 0.1, 0.2, ...] },
      { "name": "value", "data": [1.0, 1.5, 2.0, ...] }
    ]
  }
}
```

> **路径安全:** 服务端校验文件路径必须在 DISTURBANCE_ROOT 下，防止目录遍历攻击。

---

## 附录 A: 接口汇总表

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | /add_case | 否 | 创建用例 |
| DELETE | /delete_case/{id} | X-User | 删除用例 |
| PUT | /update_case/{id} | X-User | 更新用例 |
| GET | /queue_cases | X-User | 查询用例列表 |
| POST | /diff_case/{id} | 否 | 对比参数差异 |
| POST | /share_case/{id} | X-User | 共享用例 |
| POST | /unshare_case/{id} | X-User | 取消共享 |
| GET | /case_shares/{id} | X-User | 查看共享列表 |
| POST | /add_tasks | 否 | 创建仿真任务 |
| GET | /queue_tasks | 否 | 查询任务列表 |
| DELETE | /delete_task/{id} | 否 | 删除任务 |
| POST | /run_tasks | 否 | 提交运行任务 |
| GET | /get_task_status/{id} | 否 | 查询任务状态 |
| POST | /cancel_task/{id} | 否 | 取消任务 |
| GET | /task_data/{id} | 否 | 获取数据列名 |
| POST | /task_data/{id}/signals | 否 | 获取信号数据 |
| POST | /update_model_info | 否 | 构建模型信息 |
| POST | /queue_model_info | 否 | 获取模型信息 |
| GET | /model_image/{sys_name} | 否 | 获取模型图片 |
| GET | /queue_disturbances | 否 | 扰动目录树 |
| POST | /get_disturbance_info | 否 | 扰动文件数据 |
| POST | /run_task_test | 否 | [调试] 测试任务 |

## 附录 B: 错误码

| HTTP 状态码 | 说明 |
|---|---|
| 200 | 正常 (通过 response.success 判断) |
| 401 | 缺少 X-User 请求头 |
| 404 | 资源不存在 |
| 503 | MATLAB 引擎池未就绪 |

> 一般业务错误通过 `success: false` + `message` 字段返回，HTTP 状态码仍为 200。
