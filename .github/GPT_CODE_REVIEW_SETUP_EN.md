# GPT-4 Turbo Premium Code Review Setup Guide

This repository has **GPT-4 Turbo Preview** powered automated code review enabled with premium configuration for the best code review experience.

## Features

- ✅ Automatically reviews all Pull Request code changes
- ✅ Uses **GPT-4 Turbo Preview** model (latest and most powerful)
- ✅ Supports Chinese feedback
- ✅ Identifies code issues, potential bugs, and improvement suggestions
- ✅ **Premium Configuration**: Higher token capacity, more precise output

## Setup Steps

### 1. Get OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create an account and login
3. Go to API Keys page: https://platform.openai.com/api-keys
4. Click "Create new secret key"
5. Copy the generated key (it will only be shown once)

### 2. Configure GitHub Secrets

1. Go to repository Settings
2. Click "Secrets and variables" → "Actions" in the left menu
3. Click "New repository secret"
4. Add the following secret:
   - Name: `OPENAI_API_KEY`
   - Value: Paste your OpenAI API key

### 3. Enable GitHub Actions

1. Go to the repository's Actions page
2. If Actions are not enabled, click "I understand my workflows, go ahead and enable them"
3. Confirm that "AI Code Review" workflow appears in the list

## Usage

Once configured, AI code review will automatically trigger when a Pull Request is created or updated:

1. Create or update a Pull Request
2. Wait for the AI Code Review workflow to run (typically 1-2 minutes)
3. Check the review comments in the PR - AI will leave suggestions directly on code lines

## Workflow Configuration

Current configuration:
- **Model**: GPT-4
- **Language**: Chinese (zh-CN)
- **Trigger**: PR open, synchronize, reopen
- **Max Tokens**: 2000
- **Temperature**: 0.3 (more stable output)
- **Top P**: 0.9

## Custom Configuration

To modify settings, edit `.github/workflows/ai-code-review.yml`:

```yaml
env:
  MODEL: gpt-4              # Options: gpt-4, gpt-4-turbo, gpt-3.5-turbo
  LANGUAGE: zh-CN           # Options: zh-CN (Chinese), en-US (English)
  MAX_TOKENS: 2000          # Maximum tokens per review
  TEMPERATURE: 0.3          # 0-1, lower = more deterministic
  TOP_P: 0.9               # 0-1, controls output diversity
```

## Cost Estimation

GPT-4 Turbo Preview pricing (**More Affordable**):
- Input: $0.01/1K tokens (67% cheaper than GPT-4)
- Output: $0.03/1K tokens (50% cheaper than GPT-4)
- Each code review typically uses 1000-4000 tokens
- Estimated cost: ~$0.05-0.15 per review
- Recommend setting monthly budget limits in OpenAI account

💡 **Tip**: Despite using a more powerful model and larger token capacity, GPT-4 Turbo is more cost-effective!

## Important Notes

1. **API Key Security**: 
   - Never hardcode API keys in code
   - Only manage sensitive information through GitHub Secrets
   
2. **Cost Control**:
   - Set usage limits in your OpenAI account
   - Adjust MAX_TOKENS to reduce costs if needed

3. **Review Quality**:
   - AI suggestions are for reference only, final decisions are made by developers
   - Critical code still requires human review

4. **Privacy Considerations**:
   - Code will be sent to OpenAI API for analysis
   - Ensure compliance with project privacy and security requirements

## Troubleshooting

### Workflow Not Triggering
- Check if GitHub Actions is enabled
- Confirm `.github/workflows/ai-code-review.yml` file exists

### API Key Error
- Verify `OPENAI_API_KEY` secret is correctly configured
- Confirm API key is valid and has sufficient quota

### No Review Comments
- Check if PR has code changes
- Review Actions logs for detailed error messages

## Additional Resources

- [ChatGPT-CodeReview Action](https://github.com/anc95/ChatGPT-CodeReview)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
