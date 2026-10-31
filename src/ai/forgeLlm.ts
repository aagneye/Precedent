import { chat, list } from '@forge/llm';
import type { LlmPort, LlmRequest, LlmResponse, ModelTier } from './llm';
import { pickModel } from './models';

let activeModels: string[] | undefined;

async function modelFor(tier: ModelTier): Promise<string> {
  if (!activeModels) {
    const { models } = await list();
    activeModels = models.filter((m) => m.status === 'active').map((m) => m.model);
  }
  const model = pickModel(activeModels, tier);
  if (!model) throw new Error('No Forge LLM models are available on this site.');
  return model;
}

/** Forge-hosted Claude. Data stays inside Atlassian; usage is billed to the app's developer account. */
export class ForgeLlm implements LlmPort {
  async complete(request: LlmRequest): Promise<LlmResponse> {
    const response = await chat({
      model: await modelFor(request.tier),
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.prompt },
      ],
      temperature: request.temperature ?? 0,
      max_completion_tokens: request.maxTokens ?? 1024,
    });
    const content = response.choices[0]?.message.content ?? '';
    const text = typeof content === 'string' ? content : content.map((part) => part.text).join('');
    return {
      text,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  }
}
