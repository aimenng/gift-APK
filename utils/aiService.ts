// AI Service for image analysis
import { getNow } from './timeService';

export interface AIAnalysisResult {
    location?: string;
    date?: string;
    description?: string;
    tags?: string[];
    confidence?: number;
}

/**
 * Get API key from localStorage
 */
function getAPIKey(): string | null {
    return localStorage.getItem('doubao_api_key');
}

/**
 * Set API key to localStorage
 */
export function setAPIKey(key: string): void {
    localStorage.setItem('doubao_api_key', key);
}

/**
 * Check if API key is configured
 */
export function hasAPIKey(): boolean {
    return !!getAPIKey();
}

/**
 * Analyze image using Doubao API
 */
export async function analyzeImage(imageBase64: string): Promise<AIAnalysisResult> {
    const apiKey = getAPIKey();

    if (!apiKey) {
        throw new Error('请先在设置中配置豆包 API Key');
    }

    try {
        const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'doubao-vision',
                messages: [{
                    role: 'user',
                    content: [{
                        type: 'image_url',
                        image_url: { url: imageBase64 }
                    }, {
                        type: 'text',
                        text: '请分析这张照片，以JSON格式返回：{"location": "拍摄地点", "date": "拍摄日期(YYYY-MM-DD格式)", "description": "场景描述", "tags": ["标签1", "标签2"]}'
                    }]
                }],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`API 调用失败: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('API 返回数据格式错误');
        }

        // Try to parse JSON from response
        try {
            const result = JSON.parse(content);
            return {
                location: result.location,
                date: result.date,
                description: result.description,
                tags: result.tags,
                confidence: 0.8
            };
        } catch {
            // If not JSON, return a simple description
            return {
                description: content,
                confidence: 0.5
            };
        }
    } catch (error) {
        console.error('AI 分析失败:', error);
        throw error;
    }
}

/**
 * Mock analysis for testing (when no API key)
 * Accepts an optional fileDate to use instead of today's date
 */
export async function mockAnalyzeImage(fileDate?: string): Promise<AIAnalysisResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
        location: '未知地点',
        date: fileDate || getNow().format('YYYY-MM-DD'),
        description: '一张美好的照片',
        tags: ['回忆', '美好时光'],
        confidence: 0.5
    };
}
