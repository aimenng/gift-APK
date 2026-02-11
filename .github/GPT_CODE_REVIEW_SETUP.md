# GPT Codex 代码审查设置指南

本仓库已启用基于 GPT 的自动代码审查功能。

## 功能特性

- ✅ 自动审查所有 Pull Request 的代码变更
- ✅ 使用 GPT-4 模型提供智能代码建议
- ✅ 支持中文反馈
- ✅ 自动识别代码问题、潜在 bug 和改进建议

## 配置步骤

### 1. 获取 OpenAI API Key

1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 创建账号并登录
3. 进入 API Keys 页面：https://platform.openai.com/api-keys
4. 点击 "Create new secret key" 创建新的 API key
5. 复制生成的 key（只会显示一次）

### 2. 配置 GitHub Secrets

1. 进入仓库的 Settings
2. 点击左侧菜单的 "Secrets and variables" → "Actions"
3. 点击 "New repository secret"
4. 添加以下 secret：
   - Name: `OPENAI_API_KEY`
   - Value: 粘贴你的 OpenAI API key

### 3. 启用 GitHub Actions

1. 进入仓库的 Actions 页面
2. 如果 Actions 未启用，点击 "I understand my workflows, go ahead and enable them"
3. 确认 "AI Code Review" workflow 已经出现在列表中

## 使用方法

配置完成后，每当有新的 Pull Request 创建或更新时，AI 代码审查会自动触发：

1. 创建或更新 Pull Request
2. 等待 AI Code Review workflow 运行（通常需要 1-2 分钟）
3. 查看 PR 中的审查评论，AI 会直接在代码行上留下建议

## 工作流程配置

当前配置：
- **模型**: GPT-4
- **语言**: 中文 (zh-CN)
- **触发条件**: PR 创建、同步、重新打开
- **最大 token 数**: 2000
- **Temperature**: 0.3（更稳定的输出）
- **Top P**: 0.9

## 自定义配置

如需修改配置，编辑 `.github/workflows/ai-code-review.yml` 文件：

```yaml
env:
  MODEL: gpt-4              # 可选: gpt-4, gpt-4-turbo, gpt-3.5-turbo
  LANGUAGE: zh-CN           # 可选: zh-CN (中文), en-US (英文)
  MAX_TOKENS: 2000          # 每次审查的最大 token 数
  TEMPERATURE: 0.3          # 0-1 之间，值越低输出越确定
  TOP_P: 0.9               # 0-1 之间，控制输出多样性
```

## 成本估算

- GPT-4: 约 $0.03 / 1K tokens (输入) + $0.06 / 1K tokens (输出)
- 每次代码审查通常使用 500-2000 tokens
- 建议设置 OpenAI 账户的月度预算上限

## 注意事项

1. **API Key 安全**: 
   - 永远不要在代码中硬编码 API key
   - 只通过 GitHub Secrets 管理敏感信息
   
2. **成本控制**:
   - 建议在 OpenAI 账户中设置使用限额
   - 可以根据需要调整 MAX_TOKENS 降低成本

3. **审查质量**:
   - AI 建议仅供参考，最终决策由开发者做出
   - 对于关键代码，仍需人工审查

4. **隐私考虑**:
   - 代码会发送到 OpenAI API 进行分析
   - 确保符合项目的隐私和安全要求

## 故障排除

### Workflow 未触发
- 检查 GitHub Actions 是否已启用
- 确认 `.github/workflows/ai-code-review.yml` 文件存在

### API Key 错误
- 验证 `OPENAI_API_KEY` secret 是否正确配置
- 确认 API key 有效且有足够的配额

### 无审查评论
- 检查 PR 是否有代码变更
- 查看 Actions 日志了解详细错误信息

## 更多资源

- [ChatGPT-CodeReview Action](https://github.com/anc95/ChatGPT-CodeReview)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
